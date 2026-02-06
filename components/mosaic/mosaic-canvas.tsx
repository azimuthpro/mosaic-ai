"use client";

import { Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { CreateTileDialog } from "@/components/tiles/create-tile-dialog";
import { TileCard } from "@/components/tiles/tile-card";
import { TileDrawer } from "@/components/tiles/tile-drawer";
import { useSound } from "@/hooks/use-sound";
import { updateTilePosition } from "@/lib/actions/tiles";
import type {
  MosaicWithTiles,
  TileConnection,
  TileWithSources,
} from "@/types/database";

interface MosaicCanvasProps {
  mosaic: MosaicWithTiles;
  connections: TileConnection[];
}

// Grid configuration
const GRID_COLS = 4;
const GRID_ROWS = 4;
const TILE_SIZE = 140; // px - size of each grid cell
const GRID_GAP = 8; // px - fuga/grout width

export function MosaicCanvas({ mosaic, connections }: MosaicCanvasProps) {
  const { playClick, playStop } = useSound();
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [drawerTileId, setDrawerTileId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{
    gridX: number;
    gridY: number;
  } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createDialogPosition, setCreateDialogPosition] = useState<{
    gridX: number;
    gridY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);

  // Get tiles connected to the selected tile
  const connectedTileIds = useMemo(() => {
    if (!selectedTileId) return [];
    return connections.flatMap((c) => {
      if (c.source_tile_id === selectedTileId) return [c.target_tile_id];
      if (c.target_tile_id === selectedTileId) return [c.source_tile_id];
      return [];
    });
  }, [selectedTileId, connections]);

  const tiles = useMemo(
    () => (mosaic.tiles || []) as TileWithSources[],
    [mosaic.tiles],
  );

  // Derive drawerTile from tiles array - automatically stays in sync after revalidation
  const drawerTile = useMemo(
    () =>
      drawerTileId ? (tiles.find((t) => t.id === drawerTileId) ?? null) : null,
    [tiles, drawerTileId],
  );

  function handleTileSelect(tile: TileWithSources): void {
    if (!draggingTileId) {
      playClick();
      setSelectedTileId(tile.id);
      setDrawerTileId(tile.id);
      setDrawerOpen(true);
    }
  }

  function handleConfigure(tile: TileWithSources): void {
    playClick();
    setDrawerTileId(tile.id);
    setDrawerOpen(true);
  }

  function handleEmptyCellClick(gridX: number, gridY: number): void {
    if (draggingTileId) return;
    playClick();
    setCreateDialogPosition({ gridX, gridY });
    setCreateDialogOpen(true);
  }

  function handleDrawerOpenChange(open: boolean): void {
    setDrawerOpen(open);
    if (!open) {
      playStop();
      setSelectedTileId(null);
    }
  }

  function handleCreateDialogOpenChange(open: boolean): void {
    setCreateDialogOpen(open);
    if (!open) {
      setCreateDialogPosition(null);
    }
  }

  // Calculate grid position from mouse coordinates
  const getGridPosition = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRectRef.current;
    if (!rect) return null;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Calculate grid cell including gap
    const cellWithGap = TILE_SIZE + GRID_GAP;
    const gridX = Math.floor(x / cellWithGap);
    const gridY = Math.floor(y / cellWithGap);

    // Clamp to grid bounds
    return {
      gridX: Math.max(0, Math.min(GRID_COLS - 1, gridX)),
      gridY: Math.max(0, Math.min(GRID_ROWS - 1, gridY)),
    };
  }, []);

  // Check if position is occupied by another tile
  const isPositionOccupied = useCallback(
    (gridX: number, gridY: number, excludeTileId?: string) => {
      return tiles.some(
        (t) =>
          t.id !== excludeTileId && t.grid_x === gridX && t.grid_y === gridY,
      );
    },
    [tiles],
  );

  // Drag handlers
  const handleDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    tile: TileWithSources,
  ) => {
    e.preventDefault();
    if (!canvasRef.current) return;

    // Store canvas rect for the duration of the drag
    canvasRectRef.current = canvasRef.current.getBoundingClientRect();

    // Store the actual tile position (not offset from mouse)
    const tileLeft = tile.grid_x * (TILE_SIZE + GRID_GAP);
    const tileTop = tile.grid_y * (TILE_SIZE + GRID_GAP);

    setDraggingTileId(tile.id);
    setDragOffset({ left: tileLeft, top: tileTop });
    setPreviewPosition({ gridX: tile.grid_x, gridY: tile.grid_y });
  };

  const handleDragMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!draggingTileId || !canvasRectRef.current) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      // Calculate offset position relative to canvas
      const rect = canvasRectRef.current;
      const left = clientX - rect.left - TILE_SIZE / 2;
      const top = clientY - rect.top - TILE_SIZE / 2;
      setDragOffset({ left, top });

      const gridPos = getGridPosition(clientX, clientY);
      if (gridPos) {
        setPreviewPosition(gridPos);
      }
    },
    [draggingTileId, getGridPosition],
  );

  const handleDragEnd = useCallback(async () => {
    if (!draggingTileId || !previewPosition) {
      setDraggingTileId(null);
      setDragOffset(null);
      setPreviewPosition(null);
      canvasRectRef.current = null;
      return;
    }

    const { gridX, gridY } = previewPosition;

    // Only update if position changed and not occupied
    const tile = tiles.find((t) => t.id === draggingTileId);
    if (
      tile &&
      (tile.grid_x !== gridX || tile.grid_y !== gridY) &&
      !isPositionOccupied(gridX, gridY, draggingTileId)
    ) {
      await updateTilePosition(draggingTileId, gridX, gridY);
    }

    setDraggingTileId(null);
    setDragOffset(null);
    setPreviewPosition(null);
    canvasRectRef.current = null;
  }, [draggingTileId, previewPosition, tiles, isPositionOccupied]);

  // Calculate canvas dimensions
  const canvasWidth = GRID_COLS * TILE_SIZE + (GRID_COLS - 1) * GRID_GAP;
  const canvasHeight = GRID_ROWS * TILE_SIZE + (GRID_ROWS - 1) * GRID_GAP;

  // Generate grid background pattern
  const gridBackgroundStyle: React.CSSProperties = {
    width: canvasWidth,
    height: canvasHeight,
    backgroundImage: `
      linear-gradient(to right, hsl(var(--border)) ${GRID_GAP}px, transparent ${GRID_GAP}px),
      linear-gradient(to bottom, hsl(var(--border)) ${GRID_GAP}px, transparent ${GRID_GAP}px)
    `,
    backgroundSize: `${TILE_SIZE + GRID_GAP}px ${TILE_SIZE + GRID_GAP}px`,
    backgroundPosition: `${TILE_SIZE}px ${TILE_SIZE}px`,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      {/* Canvas with grid */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto mpc-grid">
        <div
          ref={canvasRef}
          className="relative rounded-lg"
          style={gridBackgroundStyle}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          {/* Empty grid cells */}
          {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, index) => {
            const colIndex = index % GRID_COLS;
            const rowIndex = Math.floor(index / GRID_COLS);

            const isOccupied = tiles.some(
              (t) =>
                t.grid_x === colIndex &&
                t.grid_y === rowIndex &&
                t.id !== draggingTileId,
            );

            if (isOccupied) return null;

            const isPreview =
              previewPosition?.gridX === colIndex &&
              previewPosition?.gridY === rowIndex;

            const cellClassName = isPreview
              ? "bg-primary/20 ring-2 ring-primary ring-offset-2"
              : "bg-background/50 hover:bg-primary/10";

            return (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className={`group absolute flex cursor-pointer items-center justify-center rounded-md transition-colors ${cellClassName}`}
                style={{
                  left: colIndex * (TILE_SIZE + GRID_GAP),
                  top: rowIndex * (TILE_SIZE + GRID_GAP),
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                }}
                onClick={() => handleEmptyCellClick(colIndex, rowIndex)}
              >
                <Plus className="size-12 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            );
          })}

          {/* Tiles */}
          {tiles.map((tile) => {
            const isDragging = draggingTileId === tile.id;
            const isSelected = selectedTileId === tile.id;

            const gridLeft = tile.grid_x * (TILE_SIZE + GRID_GAP);
            const gridTop = tile.grid_y * (TILE_SIZE + GRID_GAP);
            const left = isDragging && dragOffset ? dragOffset.left : gridLeft;
            const top = isDragging && dragOffset ? dragOffset.top : gridTop;

            const tileClassName = isDragging
              ? "absolute z-50 cursor-grabbing scale-105 opacity-90"
              : "absolute cursor-grab transition-all";

            return (
              <div
                key={tile.id}
                className={tileClassName}
                style={{
                  left,
                  top,
                  width: TILE_SIZE,
                  height: TILE_SIZE,
                  transition: isDragging ? "none" : "all 0.2s ease-out",
                }}
                onMouseDown={(e) => handleDragStart(e, tile)}
                onTouchStart={(e) => handleDragStart(e, tile)}
              >
                <TileCard
                  tile={tile}
                  onSelect={handleTileSelect}
                  onConfigure={handleConfigure}
                  selected={isSelected}
                  connectedTileIds={connectedTileIds}
                  compact
                  isDragging={isDragging}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Connection indicator */}
      {selectedTileId && connectedTileIds.length > 0 && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <span className="font-medium">
            {connectedTileIds.length} connected tile
            {connectedTileIds.length !== 1 && "s"}
          </span>
          <span className="text-muted-foreground">
            {" "}
            - Click tile to deselect
          </span>
        </div>
      )}

      {/* Create tile dialog (triggered by clicking empty cell) */}
      <CreateTileDialog
        mosaicId={mosaic.id}
        gridX={createDialogPosition?.gridX}
        gridY={createDialogPosition?.gridY}
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        hideTrigger
      />

      {/* Tile drawer (opened when clicking a tile) */}
      <TileDrawer
        tile={drawerTile}
        mosaicId={mosaic.id}
        open={drawerOpen}
        onOpenChange={handleDrawerOpenChange}
      />
    </div>
  );
}
