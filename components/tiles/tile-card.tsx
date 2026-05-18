"use client";

import {
  BookOpen,
  Brain,
  CircleDot,
  Copy,
  Database,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Play,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { RunConfirmDialog } from "@/components/tiles/run-confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteTile,
  duplicateTile,
  toggleTileActive,
} from "@/lib/actions/tiles";
import { cn } from "@/lib/utils";
import type { TilePattern, TileType, TileWithSources } from "@/types/database";

import { TILE_TYPE_LABELS } from "./tile-drawer/types";

interface TileCardProps {
  tile: TileWithSources;
  onSelect?: (tile: TileWithSources) => void;
  onConfigure?: (tile: TileWithSources) => void;
  selected?: boolean;
  connectedTileIds?: string[];
  incomingConnectionCount?: number;
  compact?: boolean;
  isDragging?: boolean;
  isRunning?: boolean;
  onRun?: (
    tileId: string,
    debug: boolean,
    options?: { comment?: string },
  ) => void;
}

const TILE_ICONS: Record<TileType, React.ElementType> = {
  url_reader: Globe,
  web_search: Search,
  analyzer: Brain,
  slack_reader: MessageSquare,
  catalog: Database,
  github_issue: CircleDot,
  knowledge_base: BookOpen,
  offer_sender: Mail,
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
  incomingConnectionCount = 0,
  compact = false,
  isDragging = false,
  isRunning = false,
  onRun,
}: TileCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showRunConfirm, setShowRunConfirm] = useState(false);

  const Icon = TILE_ICONS[tile.tile_type];
  const isConnected = connectedTileIds.includes(tile.id);
  const sourceCount = (tile.sources?.length || 0) + incomingConnectionCount;

  function handleRunClick(e: React.MouseEvent): void {
    e.stopPropagation();
    setShowRunConfirm(true);
  }

  function handleRunConfirm(
    debug: boolean,
    options?: { comment?: string },
  ): void {
    setShowRunConfirm(false);
    onRun?.(tile.id, debug, options);
  }

  async function handleDelete(): Promise<void> {
    if (!confirm("Are you sure you want to delete this tile?")) {
      return;
    }
    setIsDeleting(true);
    await deleteTile(tile.id);
  }

  async function handleDuplicate(): Promise<void> {
    setIsDuplicating(true);
    const result = await duplicateTile(tile.id);
    setIsDuplicating(false);
    if (result.error) {
      alert(result.error);
    }
  }

  async function handleToggleActive(): Promise<void> {
    await toggleTileActive(tile.id);
  }

  // Compact square tile for mosaic grid (MPC pad style)
  if (compact) {
    return (
      <>
        <RunConfirmDialog
          open={showRunConfirm}
          onOpenChange={setShowRunConfirm}
          tileName={tile.name}
          isRunning={isRunning}
          onConfirm={handleRunConfirm}
          commentMode={tile.tile_type === "offer_sender" ? "offer" : undefined}
        />
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
          <div
            className="absolute inset-0 opacity-15"
            style={getPatternStyle(tile.pattern, tile.color)}
          />

          <div className="relative flex flex-1 flex-col p-2">
            <div className="flex items-start justify-between gap-1">
              <div className="flex items-center gap-1.5">
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

              {/* Play button - visible on hover, always visible when running */}
              <div
                className={cn(
                  "transition-opacity",
                  isRunning
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100",
                )}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white/50 hover:text-white hover:bg-white/10"
                  onClick={handleRunClick}
                  disabled={isRunning || !tile.is_active}
                >
                  {isRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            <div className="mt-1 flex-1">
              <h3 className="line-clamp-2 text-xs font-semibold leading-tight text-white/90">
                {tile.name}
              </h3>
              <p className="mt-0.5 text-[10px] text-white/50 font-mono uppercase tracking-wider">
                {TILE_TYPE_LABELS[tile.tile_type]}
              </p>
            </div>

            <div className="mt-auto flex items-center gap-1 pt-1">
              {sourceCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 px-1 text-[9px] font-normal bg-white/10 text-white/70"
                >
                  {sourceCount}
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

          <div
            className="h-1"
            style={{
              backgroundColor: tile.color,
              boxShadow: `0 0 8px ${tile.color}40`,
            }}
          />
        </div>
      </>
    );
  }

  // Full-size card (original layout)
  return (
    <>
      <RunConfirmDialog
        open={showRunConfirm}
        onOpenChange={setShowRunConfirm}
        tileName={tile.name}
        isRunning={isRunning}
        onConfirm={handleRunConfirm}
        commentMode={tile.tile_type === "offer_sender" ? "offer" : undefined}
      />
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
        <div
          className="h-2 rounded-t-lg"
          style={getPatternStyle(tile.pattern, tile.color)}
        />

        <div className="flex flex-row items-start justify-between p-4 pb-2">
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
              onClick={handleRunClick}
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
                <DropdownMenuItem
                  onClick={handleDuplicate}
                  disabled={isDuplicating}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {isDuplicating ? "Duplicating..." : "Duplicate"}
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
              {sourceCount} sources
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
    </>
  );
}
