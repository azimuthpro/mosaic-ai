"use client";

import { Brain, Check, GitBranch, Globe, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getTilesForSourceSelection } from "@/lib/actions/tiles";
import { cn } from "@/lib/utils";
import { TILE_TYPE_CONFIGS, type TileType } from "@/types/database";

interface TileSelectorProps {
  mosaicId: string;
  selectedTileIds: string[];
  onChange: (tileIds: string[]) => void;
  excludeTileId?: string;
  disabled?: boolean;
  label?: string;
}

const TILE_ICONS = {
  url_reader: Globe,
  web_search: Search,
  recursive: GitBranch,
  analyzer: Brain,
};

interface TileOption {
  id: string;
  name: string;
  tile_type: TileType;
}

export function TileSelector({
  mosaicId,
  selectedTileIds,
  onChange,
  excludeTileId,
  disabled,
  label = "Input Tiles",
}: TileSelectorProps) {
  const [tiles, setTiles] = useState<TileOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTiles() {
      setIsLoading(true);
      const data = await getTilesForSourceSelection(mosaicId, excludeTileId);
      setTiles(data);
      setIsLoading(false);
    }
    loadTiles();
  }, [mosaicId, excludeTileId]);

  const toggleTile = (tileId: string) => {
    if (selectedTileIds.includes(tileId)) {
      onChange(selectedTileIds.filter((id) => id !== tileId));
    } else {
      onChange([...selectedTileIds, tileId]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const selectedTiles = tiles.filter((t) => selectedTileIds.includes(t.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {selectedTileIds.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={disabled}
            className="h-6 text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        )}
      </div>

      {/* Selected Tiles */}
      {selectedTiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTiles.map((tile) => {
            const config = TILE_TYPE_CONFIGS[tile.tile_type];
            const Icon = TILE_ICONS[tile.tile_type];
            return (
              <Badge
                key={tile.id}
                variant="secondary"
                className="flex items-center gap-1.5 pr-1"
                style={{ backgroundColor: `${config.color}20` }}
              >
                <Icon className="h-3 w-3" style={{ color: config.color }} />
                <span>{tile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 rounded-full p-0 hover:bg-transparent"
                  onClick={() => toggleTile(tile.id)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Available Tiles */}
      {isLoading ? (
        <div className="py-4 text-center text-sm text-muted-foreground">
          Loading tiles...
        </div>
      ) : tiles.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No other tiles in this mosaic yet.
          <br />
          Create source tiles first to use them as input.
        </div>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
          {tiles.map((tile) => {
            const config = TILE_TYPE_CONFIGS[tile.tile_type];
            const Icon = TILE_ICONS[tile.tile_type];
            const isSelected = selectedTileIds.includes(tile.id);

            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => toggleTile(tile.id)}
                disabled={disabled}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/50",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
                  style={{ backgroundColor: `${config.color}20` }}
                >
                  <Icon className="h-4 w-4" style={{ color: config.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {tile.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {config.label}
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {tiles.length > 0 && selectedTileIds.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Select one or more tiles to use their data as input.
        </p>
      )}
    </div>
  );
}
