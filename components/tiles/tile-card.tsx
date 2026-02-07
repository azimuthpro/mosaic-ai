"use client";

import {
  Brain,
  Globe,
  Loader2,
  MoreHorizontal,
  Play,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteTile, toggleTileActive } from "@/lib/actions/tiles";
import { cn } from "@/lib/utils";
import type { TilePattern, TileType, TileWithSources } from "@/types/database";

interface TileCardProps {
  tile: TileWithSources;
  onSelect?: (tile: TileWithSources) => void;
  onConfigure?: (tile: TileWithSources) => void;
  selected?: boolean;
  connectedTileIds?: string[];
  compact?: boolean;
  isDragging?: boolean;
  isRunning?: boolean;
  onRun?: (tileId: string) => void;
}

const TILE_ICONS: Record<TileType, React.ElementType> = {
  url_reader: Globe,
  web_search: Search,
  analyzer: Brain,
};

const TILE_TYPE_LABELS: Record<TileType, string> = {
  url_reader: "URL Reader",
  web_search: "Web Search",
  analyzer: "Analyzer",
};

function getPatternStyle(
  pattern: TilePattern,
  color: string,
): React.CSSProperties {
  switch (pattern) {
    case "stripes":
      return {
        background: `repeating-linear-gradient(
          45deg,
          ${color},
          ${color} 10px,
          ${color}dd 10px,
          ${color}dd 20px
        )`,
      };
    case "dots":
      return {
        background: `radial-gradient(circle, ${color}cc 2px, ${color} 2px)`,
        backgroundSize: "10px 10px",
      };
    case "gradient":
      return {
        background: `linear-gradient(135deg, ${color} 0%, ${color}88 100%)`,
      };
    default:
      return { backgroundColor: color };
  }
}

export function TileCard({
  tile,
  onSelect,
  onConfigure,
  selected,
  connectedTileIds = [],
  compact = false,
  isDragging = false,
  isRunning = false,
  onRun,
}: TileCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const Icon = TILE_ICONS[tile.tile_type];
  const isConnected = connectedTileIds.includes(tile.id);

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRun?.(tile.id);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this tile?")) {
      return;
    }
    setIsDeleting(true);
    await deleteTile(tile.id);
  };

  const handleToggleActive = async () => {
    await toggleTileActive(tile.id);
  };

  // Compact square tile for mosaic grid (MPC pad style)
  if (compact) {
    return (
      <div
        className={cn(
          "group relative flex h-full w-full flex-col overflow-hidden rounded-lg mpc-pad transition-all",
          selected && "ring-2 ring-primary",
          isConnected && "ring-2 ring-offset-2",
          !tile.is_active && "opacity-50",
          isDragging && "shadow-xl scale-105",
          isRunning && "animate-glow-pulse",
        )}
        style={
          {
            ...(isConnected && { "--tw-ring-color": tile.color }),
            ...(isRunning && { "--glow-color": tile.color }),
          } as React.CSSProperties
        }
        onClick={() => onSelect?.(tile)}
      >
        {/* Pattern background */}
        <div
          className="absolute inset-0 opacity-15"
          style={getPatternStyle(tile.pattern, tile.color)}
        />

        {/* Content */}
        <div className="relative flex flex-1 flex-col p-2">
          {/* Header row with LED indicator */}
          <div className="flex items-start justify-between gap-1">
            <div className="flex items-center gap-1.5">
              {/* LED Indicator */}
              <div
                className={cn(
                  "led-indicator",
                  tile.is_active && "active",
                  isRunning && "running",
                )}
              />
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: `${tile.color}25` }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: tile.color }} />
              </div>
            </div>

            {/* Actions */}
            <div
              className="flex items-center opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 hover:bg-white/10"
                onClick={handleRun}
                disabled={isRunning || !tile.is_active}
              >
                {isRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-white/10"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={handleToggleActive}>
                    {tile.is_active ? "Disable" : "Enable"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onConfigure?.(tile)}>
                    <Settings className="mr-2 h-3 w-3" />
                    Configure
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    {isDeleting ? "..." : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Title */}
          <div className="mt-1 flex-1">
            <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">
              {tile.name}
            </h3>
            <p className="mt-0.5 text-[10px] text-white/50 font-mono uppercase tracking-wider">
              {TILE_TYPE_LABELS[tile.tile_type]}
            </p>
          </div>

          {/* Bottom badges */}
          <div className="mt-auto flex items-center gap-1 pt-1">
            {tile.sources?.length > 0 && (
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[9px] font-normal bg-white/10 text-white/70"
              >
                {tile.sources.length}
              </Badge>
            )}
            {tile.schedule_cron && (
              <div
                className="h-1.5 w-1.5 rounded-full shadow-sm"
                style={{
                  backgroundColor: tile.color,
                  boxShadow: `0 0 6px ${tile.color}`,
                }}
                title="Scheduled"
              />
            )}
            {!tile.is_active && (
              <Badge
                variant="outline"
                className="h-4 px-1 text-[9px] font-normal opacity-70 border-white/20 text-white/50"
              >
                Off
              </Badge>
            )}
          </div>
        </div>

        {/* Color accent bar at bottom with glow */}
        <div
          className="h-1"
          style={{
            backgroundColor: tile.color,
            boxShadow: `0 0 8px ${tile.color}40`,
          }}
        />
      </div>
    );
  }

  // Full-size card (original layout)
  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:shadow-md",
        selected && "ring-2 ring-primary",
        isConnected && "ring-2 ring-offset-2",
        !tile.is_active && "opacity-60",
        isRunning && "animate-glow-pulse",
      )}
      style={
        {
          ...(isConnected && { "--tw-ring-color": tile.color }),
          ...(isRunning && { "--glow-color": tile.color }),
        } as React.CSSProperties
      }
      onClick={() => onSelect?.(tile)}
    >
      {/* Color bar */}
      <div
        className="h-2 rounded-t-lg"
        style={getPatternStyle(tile.pattern, tile.color)}
      />

      <div className="flex flex-row items-start justify-between space-y-0 p-4 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${tile.color}20` }}
          >
            <Icon className="h-4 w-4" style={{ color: tile.color }} />
          </div>
          <div>
            <h3 className="text-base font-semibold">{tile.name}</h3>
            <p className="text-xs text-muted-foreground">
              {TILE_TYPE_LABELS[tile.tile_type]}
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRun}
            disabled={isRunning || !tile.is_active}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggleActive}>
                {tile.is_active ? "Disable" : "Enable"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConfigure?.(tile)}>
                <Settings className="mr-2 h-4 w-4" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2 px-4 pb-4">
        {tile.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {tile.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {tile.sources?.length || 0} sources
          </Badge>
          {tile.schedule_cron && (
            <Badge variant="secondary" className="text-xs">
              Scheduled
            </Badge>
          )}
          {!tile.is_active && (
            <Badge variant="secondary" className="text-xs">
              Disabled
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
