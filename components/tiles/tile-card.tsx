"use client";

import { Brain, GitBranch, Globe, Loader2, MoreHorizontal, Play, Search, Settings, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteTile, toggleTileActive } from "@/lib/actions/tiles";
import type { TilePattern, TileType, TileWithSources } from "@/types/database";

interface TileCardProps {
  tile: TileWithSources;
  onSelect?: (tile: TileWithSources) => void;
  selected?: boolean;
  connectedTileIds?: string[];
}

const TILE_ICONS: Record<TileType, React.ElementType> = {
  url_reader: Globe,
  web_search: Search,
  recursive: GitBranch,
  analyzer: Brain,
};

const TILE_TYPE_LABELS: Record<TileType, string> = {
  url_reader: "URL Reader",
  web_search: "Web Search",
  recursive: "Pipeline",
  analyzer: "Analyzer",
};

function getPatternStyle(pattern: TilePattern, color: string): React.CSSProperties {
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

export function TileCard({ tile, onSelect, selected, connectedTileIds = [] }: TileCardProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const Icon = TILE_ICONS[tile.tile_type];
  const isConnected = connectedTileIds.includes(tile.id);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const response = await fetch("/api/tiles/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tileId: tile.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to run tile");
      }
    } catch {
      alert("Failed to run tile");
    } finally {
      setIsRunning(false);
    }
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

  return (
    <Card
      className={`group relative cursor-pointer transition-all ${
        selected ? "ring-2 ring-primary" : ""
      } ${isConnected ? "ring-2 ring-offset-2" : ""} ${
        !tile.is_active ? "opacity-60" : ""
      }`}
      style={isConnected ? { "--tw-ring-color": tile.color } as React.CSSProperties : undefined}
      onClick={() => onSelect?.(tile)}
    >
      {/* Color bar */}
      <div
        className="h-2 rounded-t-lg"
        style={getPatternStyle(tile.pattern, tile.color)}
      />

      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${tile.color}20` }}
          >
            <Icon className="h-4 w-4" style={{ color: tile.color }} />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">
              {tile.name}
            </CardTitle>
            <CardDescription className="text-xs">
              {TILE_TYPE_LABELS[tile.tile_type]}
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
              <DropdownMenuItem>
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
      </CardHeader>

      <CardContent className="space-y-2">
        {tile.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {tile.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
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
      </CardContent>
    </Card>
  );
}
