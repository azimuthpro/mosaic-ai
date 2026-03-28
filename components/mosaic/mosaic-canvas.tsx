"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CreateTileDialog } from "@/components/tiles/create-tile-dialog";
import { TileCard } from "@/components/tiles/tile-card";
import { getTileExecutionStatus } from "@/lib/actions/tile-execution";
import { updateTilePosition } from "@/lib/actions/tiles";
import {
  TILE_TYPE_CONFIGS,
  type MosaicWithTiles,
  type TileConnection,
  type TileType,
  type TileWithSources,
} from "@/types/database";

interface MosaicCanvasProps {
  mosaic: MosaicWithTiles;
  connections: TileConnection[];
}

const GRID_COLS = 4;
const GRID_ROWS = 4;
const TILE_SIZE = 140;
const GRID_GAP = 8;

export function MosaicCanvas({ mosaic, connections }: MosaicCanvasProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawCreateTile = searchParams.get("create_tile");
  const createTileParam =
    rawCreateTile && rawCreateTile in TILE_TYPE_CONFIGS
      ? (rawCreateTile as TileType)
      : null;
  const [runningTileIds, setRunningTileIds] = useState<Set<string>>(new Set());
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [previewPosition, setPreviewPosition] = useState<{
    gridX: number;
    gridY: number;
  } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(!!createTileParam);
  const [createDialogPosition, setCreateDialogPosition] = useState<{
    gridX: number;
    gridY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);

  const tiles = useMemo(
    () => (mosaic.tiles || []) as TileWithSources[],
    [mosaic.tiles],
  );

  function handleNavigateToTile(tile: TileWithSources): void {
    if (!draggingTileId) {
      router.push(`/mosaics/${mosaic.id}/tiles/${tile.id}`);
    }
  }

  function handleEmptyCellClick(gridX: number, gridY: number): void {
    if (draggingTileId) return;
    setCreateDialogPosition({ gridX, gridY });
    setCreateDialogOpen(true);
  }

  const handleRunTile = useCallback(
    async (tileId: string, debug: boolean) => {
      setRunningTileIds((prev) => new Set(prev).add(tileId));

      // Pre-compute downstream tiles that will auto-trigger after this tile completes
      const downstreamIds = connections
        .filter((c) => c.source_tile_id === tileId)
        .map((c) => c.target_tile_id);
      const autoTriggerIds = tiles
        .filter(
          (t) =>
            downstreamIds.includes(t.id) &&
            t.trigger_on_source_update &&
            t.is_active,
        )
        .map((t) => t.id);

      try {
        const response = await fetch("/api/tiles/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileId, debug }),
        });
        const data = await response.json();
        if (!response.ok) {
          alert(data.error || "Failed to run tile");
        }
      } catch {
        alert("Failed to run tile");
      } finally {
        // Remove this tile and mark downstream auto-trigger tiles in a single update
        setRunningTileIds((prev) => {
          const next = new Set(prev);
          next.delete(tileId);
          for (const id of autoTriggerIds) {
            next.add(id);
          }
          return next;
        });
      }
    },
    [connections, tiles],
  );

  // Poll running tiles to detect when they finish
  useEffect(() => {
    if (runningTileIds.size === 0) return;
    const interval = setInterval(async () => {
      const tileIds = Array.from(runningTileIds);
      const statuses = await Promise.all(
        tileIds.map((id) => getTileExecutionStatus(id)),
      );

      const finishedIds = tileIds.filter((_, i) => {
        const status = statuses[i];
        return !status?.lastJob || status.lastJob.status !== "processing";
      });

      if (finishedIds.length > 0) {
        setRunningTileIds((prev) => {
          const next = new Set(prev);
          for (const id of finishedIds) {
            next.delete(id);
          }
          return next;
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [runningTileIds]);

  function handleCreateDialogOpenChange(open: boolean): void {
    setCreateDialogOpen(open);
    if (!open) {
      setCreateDialogPosition(null);
      // Clean up create_tile query param if present
      if (createTileParam) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }

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

  const isPositionOccupied = useCallback(
    (gridX: number, gridY: number, excludeTileId?: string) => {
      return tiles.some(
        (t) =>
          t.id !== excludeTileId && t.grid_x === gridX && t.grid_y === gridY,
      );
    },
    [tiles],
  );

  function handleDragStart(
    e: React.MouseEvent | React.TouchEvent,
    tile: TileWithSources,
  ): void {
    e.preventDefault();
    if (!canvasRef.current) return;

    canvasRectRef.current = canvasRef.current.getBoundingClientRect();

    const tileLeft = tile.grid_x * (TILE_SIZE + GRID_GAP);
    const tileTop = tile.grid_y * (TILE_SIZE + GRID_GAP);

    setDraggingTileId(tile.id);
    setDragOffset({ left: tileLeft, top: tileTop });
    setPreviewPosition({ gridX: tile.grid_x, gridY: tile.grid_y });
  }

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

  function resetDragState(): void {
    setDraggingTileId(null);
    setDragOffset(null);
    setPreviewPosition(null);
    canvasRectRef.current = null;
  }

  const handleDragEnd = useCallback(async () => {
    if (!draggingTileId || !previewPosition) {
      resetDragState();
      return;
    }

    const { gridX, gridY } = previewPosition;
    const tile = tiles.find((t) => t.id === draggingTileId);
    if (
      tile &&
      (tile.grid_x !== gridX || tile.grid_y !== gridY) &&
      !isPositionOccupied(gridX, gridY, draggingTileId)
    ) {
      await updateTilePosition(draggingTileId, gridX, gridY);
    }

    resetDragState();
  }, [draggingTileId, previewPosition, tiles, isPositionOccupied]);

  const canvasWidth = GRID_COLS * TILE_SIZE + (GRID_COLS - 1) * GRID_GAP;
  const canvasHeight = GRID_ROWS * TILE_SIZE + (GRID_ROWS - 1) * GRID_GAP;

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
                  onSelect={handleNavigateToTile}
                  onConfigure={handleNavigateToTile}
                  incomingConnectionCount={
                    connections.filter((c) => c.target_tile_id === tile.id)
                      .length
                  }
                  compact
                  isDragging={isDragging}
                  isRunning={runningTileIds.has(tile.id)}
                  onRun={handleRunTile}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Create tile dialog (triggered by clicking empty cell) */}
      <CreateTileDialog
        mosaicId={mosaic.id}
        gridX={createDialogPosition?.gridX}
        gridY={createDialogPosition?.gridY}
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        hideTrigger
        initialType={createTileParam ?? undefined}
      />

    </div>
  );
}
