"use client";

import {
  Database,
  Globe,
  Link2,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatRelativeTime } from "@/lib/utils/format";
import type {
  FetchMode,
  TileConnection,
  TileType,
} from "@/types/database";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps, SourceTypeKey } from "../../types";
import { SOURCE_TYPE_CONFIG } from "../../types";
import { PluginCard } from "../plugin-card";

interface SourcesPluginProps extends PluginBaseProps {
  tile: PluginBaseProps["tile"] & {
    incoming_connections?: TileConnection[];
  };
  state: TileDrawerState;
}

function renderSourceTypeOptions(tileType: TileType): React.ReactNode {
  const urlOption = (
    <SelectItem key="url" value="url">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-cyan-400" />
        URL
      </div>
    </SelectItem>
  );

  const tileReportOption = (
    <SelectItem key="tile_connection" value="tile_connection">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-teal-400" />
        Tile Connection
      </div>
    </SelectItem>
  );

  const webSearchOption = (
    <SelectItem key="web_search" value="web_search">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-pink-400" />
        Web Search
      </div>
    </SelectItem>
  );

  switch (tileType) {
    case "url_reader":
      return [urlOption, tileReportOption];
    case "web_search":
      return webSearchOption;
    case "recursive":
    case "analyzer":
      return tileReportOption;
  }
}

interface SourceIconProps {
  type: SourceTypeKey;
  className?: string;
}

function SourceIcon({ type, className = "h-4 w-4 shrink-0" }: SourceIconProps) {
  const config = SOURCE_TYPE_CONFIG[type];
  const icons = {
    Globe: Globe,
    Search: Search,
    Link2: Link2,
  };
  const Icon = icons[config.icon as keyof typeof icons];
  return <Icon className={`${className} ${config.color}`} />;
}

function getSourceDisplayName(source: {
  name: string | null;
  url: string | null;
  config: unknown;
}): string {
  const config = source.config as { query?: string } | null;
  return source.name || source.url || config?.query || "Unnamed source";
}

export function SourcesPlugin({ tile, disabled, state }: SourcesPluginProps) {
  const {
    sourceForm,
    updateSourceField,
    handleAddSource,
    handleDeleteSource,
    availableTiles,
    isLoadingTiles,
    isAddingSource,
    deletingSourceId,
    pluginState,
    updatePluginState,
    handleDeleteConnection,
    deletingConnectionId,
  } = state;

  const activeSourceCount =
    (tile.sources?.filter((s) => s.is_active).length || 0) +
    (tile.incoming_connections?.length || 0);
  const totalSourceCount =
    (tile.sources?.length || 0) + (tile.incoming_connections?.length || 0);

  return (
    <PluginCard
      id="sources"
      title="Sources"
      description="Configure data inputs"
      icon={<Database className="h-4 w-4 text-cyan-400" />}
      section="input"
      collapsed={pluginState["sources"] ?? false}
      onCollapsedChange={(collapsed) => updatePluginState("sources", collapsed)}
      badge={{
        text: `${activeSourceCount}/${totalSourceCount}`,
        variant: activeSourceCount > 0 ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      <div className="space-y-4">
        {/* Add New Source */}
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Source
          </h4>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={sourceForm.type}
                onValueChange={(v) =>
                  updateSourceField("type", v as SourceTypeKey)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {renderSourceTypeOptions(tile.tile_type)}
                </SelectContent>
              </Select>
            </div>

            {sourceForm.type === "url" && (
              <>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={sourceForm.url}
                    onChange={(e) => updateSourceField("url", e.target.value)}
                    placeholder="https://example.com/page"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Extract Depth</Label>
                  <Select
                    value={sourceForm.extractDepth}
                    onValueChange={(v) =>
                      updateSourceField(
                        "extractDepth",
                        v as "basic" | "advanced",
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="advanced">
                        Advanced (deeper extraction)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Advanced extracts more content but uses more credits
                  </p>
                </div>
              </>
            )}

            {sourceForm.type === "tile_connection" && (
              <>
                <div className="space-y-2">
                  <Label>Source Tile</Label>
                  <Select
                    value={sourceForm.selectedTileId}
                    onValueChange={(v) =>
                      updateSourceField("selectedTileId", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a tile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingTiles ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : availableTiles.length === 0 ? (
                        <div className="py-2 px-2 text-sm text-muted-foreground">
                          No other tiles available
                        </div>
                      ) : (
                        availableTiles.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fetch mode toggle */}
                <div className="space-y-2">
                  <Label>Fetch Mode</Label>
                  <Select
                    value={sourceForm.fetchMode}
                    onValueChange={(v) =>
                      updateSourceField("fetchMode", v as FetchMode)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Fast (latest only)</SelectItem>
                      <SelectItem value="memory">
                        Memory (with history)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {sourceForm.fetchMode === "fast"
                      ? "Fetches only the latest report from the source tile"
                      : "Includes historical summaries from the last month"}
                  </p>
                </div>

                {/* URL extraction options for url_reader tiles */}
                {tile.tile_type === "url_reader" && (
                  <>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                      <div>
                        <Label className="text-sm">
                          Extract URLs from report
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Find URLs in the report and fetch their content
                        </p>
                      </div>
                      <Switch
                        checked={sourceForm.extractUrlsFromReport}
                        onCheckedChange={(v) =>
                          updateSourceField("extractUrlsFromReport", v)
                        }
                      />
                    </div>

                    {sourceForm.extractUrlsFromReport && (
                      <>
                        <div className="space-y-2">
                          <Label>Extract Depth</Label>
                          <Select
                            value={sourceForm.extractDepth}
                            onValueChange={(v) =>
                              updateSourceField(
                                "extractDepth",
                                v as "basic" | "advanced",
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="basic">Basic</SelectItem>
                              <SelectItem value="advanced">
                                Advanced (deeper extraction)
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Max URLs to extract</Label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={sourceForm.maxUrls}
                            onChange={(e) =>
                              updateSourceField(
                                "maxUrls",
                                Math.min(
                                  50,
                                  Math.max(1, parseInt(e.target.value) || 10),
                                ),
                              )
                            }
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {sourceForm.type === "web_search" && (
              <div className="space-y-2">
                <Label>Search Query</Label>
                <Input
                  value={sourceForm.searchQuery}
                  onChange={(e) =>
                    updateSourceField("searchQuery", e.target.value)
                  }
                  placeholder="Enter search query..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Name (optional)</Label>
              <Input
                value={sourceForm.name}
                onChange={(e) => updateSourceField("name", e.target.value)}
                placeholder="Friendly name for this source"
              />
            </div>

            <Button
              onClick={handleAddSource}
              disabled={isAddingSource}
              className="w-full"
            >
              {isAddingSource ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Source
            </Button>
          </div>
        </div>

        <Separator />

        {/* Existing Sources */}
        <div className="space-y-2">
          <Label>Current Sources ({totalSourceCount})</Label>
          {!tile.sources || tile.sources.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No sources configured yet
            </p>
          ) : (
            <div className="space-y-2">
              {/* External Sources */}
              {tile.sources?.map((source) => {
                const urlConfig = source.config as {
                  extract_depth?: string;
                  query?: string;
                } | null;
                return (
                  <div
                    key={source.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <SourceIcon
                      type={source.type}
                      className="h-5 w-5 shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {getSourceDisplayName(source)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {source.type === "url" && (
                          <span className="truncate block">
                            {source.url}
                            {urlConfig?.extract_depth === "advanced" && (
                              <span className="ml-1 text-cyan-400">
                                (advanced)
                              </span>
                            )}
                          </span>
                        )}
                        {source.type === "web_search" && (
                          <span>Query: {urlConfig?.query}</span>
                        )}
                      </p>
                      {source.last_scraped_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last fetched:{" "}
                          {formatRelativeTime(source.last_scraped_at)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!source.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDeleteSource(source.id)}
                        disabled={deletingSourceId === source.id}
                      >
                        {deletingSourceId === source.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Tile Connections */}
              {tile.incoming_connections?.map((conn) => {
                const sourceTile = availableTiles.find(
                  (t) => t.id === conn.source_tile_id,
                );
                const tileName = sourceTile?.name || "Connected Tile";

                return (
                  <div
                    key={conn.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <Link2 className="h-5 w-5 shrink-0 text-teal-400" />

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{tileName}</p>
                      <p className="text-xs text-muted-foreground">
                        Connected tile output
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDeleteConnection(conn.id)}
                        disabled={deletingConnectionId === conn.id}
                      >
                        {deletingConnectionId === conn.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PluginCard>
  );
}
