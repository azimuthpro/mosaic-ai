"use client";

import { useState } from "react";

import { CreateTileDialog } from "@/components/tiles/create-tile-dialog";
import { TileCard } from "@/components/tiles/tile-card";
import type { MosaicWithTiles, TileConnection, TileWithSources } from "@/types/database";

interface MosaicCanvasProps {
  mosaic: MosaicWithTiles;
  connections: TileConnection[];
}

export function MosaicCanvas({ mosaic, connections }: MosaicCanvasProps) {
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);

  // Get tiles connected to the selected tile
  const connectedTileIds = selectedTileId
    ? [
        ...connections
          .filter((c) => c.source_tile_id === selectedTileId)
          .map((c) => c.target_tile_id),
        ...connections
          .filter((c) => c.target_tile_id === selectedTileId)
          .map((c) => c.source_tile_id),
      ]
    : [];

  const tiles = (mosaic.tiles || []) as TileWithSources[];

  const handleTileSelect = (tile: TileWithSources) => {
    setSelectedTileId(selectedTileId === tile.id ? null : tile.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{mosaic.name}</h1>
          {mosaic.description && (
            <p className="text-muted-foreground">{mosaic.description}</p>
          )}
        </div>
        <CreateTileDialog mosaicId={mosaic.id} />
      </div>

      {/* Canvas grid */}
      {tiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">No tiles yet</h3>
            <p className="text-sm text-muted-foreground">
              Add your first tile to start gathering intelligence.
            </p>
          </div>
          <div className="mt-4">
            <CreateTileDialog mosaicId={mosaic.id} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tiles.map((tile) => (
            <TileCard
              key={tile.id}
              tile={tile}
              onSelect={handleTileSelect}
              selected={selectedTileId === tile.id}
              connectedTileIds={connectedTileIds}
            />
          ))}
        </div>
      )}

      {/* Connection indicator */}
      {selectedTileId && connectedTileIds.length > 0 && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <span className="font-medium">
            {connectedTileIds.length} connected tile{connectedTileIds.length !== 1 && "s"}
          </span>
          <span className="text-muted-foreground">
            {" "}
            - Click tile to deselect
          </span>
        </div>
      )}
    </div>
  );
}
