"use client";

import {
  Check,
  Database,
  Globe,
  Hash,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { SlackChannelPicker } from "@/components/slack/slack-channel-picker";
import { SlackConnectButton } from "@/components/slack/slack-connect-button";
import { AddUrlSourceDialog } from "@/components/tiles/add-url-source-dialog";
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
import { MAX_URLS_PER_TILE } from "@/lib/constants/tiles";
import { formatRelativeTime } from "@/lib/utils/format";
import type { FetchMode, TileConnection, TileType } from "@/types/database";

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
  const tileReportOption = (
    <SelectItem key="tile_connection" value="tile_connection">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-teal-400" />
        Tile Connection
      </div>
    </SelectItem>
  );

  const slackChannelOption = (
    <SelectItem key="slack_channel" value="slack_channel">
      <div className="flex items-center gap-2">
        <Hash className="h-4 w-4 text-[#4A154B]" />
        Slack Channel
      </div>
    </SelectItem>
  );

  if (tileType === "slack_reader") {
    return [slackChannelOption];
  }

  return [
    <SelectItem key="url" value="url">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-cyan-400" />
        URL
      </div>
    </SelectItem>,
    <SelectItem key="web_search" value="web_search">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-pink-400" />
        Web Search
      </div>
    </SelectItem>,
    tileReportOption,
    slackChannelOption,
  ];
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
    Hash: Hash,
  };
  const Icon = icons[config.icon as keyof typeof icons];
  return <Icon className={`${className} ${config.color}`} />;
}

function getSourceDisplayName(source: {
  name: string | null;
  url: string | null;
  config: unknown;
}): string {
  const config = source.config as {
    query?: string;
    channel_name?: string;
  } | null;
  return (
    source.name ||
    config?.channel_name ||
    source.url ||
    config?.query ||
    "Unnamed source"
  );
}

function getConnectionBehaviorHint(tileType: TileType): string {
  switch (tileType) {
    case "url_reader":
      return "URLs will be extracted from the connected tile's report and fetched";
    case "web_search":
      return "Keywords will be extracted from the connected tile's report and searched";
    case "analyzer":
    case "slack_reader":
      return "Full report content from the connected tile will be used as input";
  }
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
    editingConnectionId,
    editConnectionSourceTileId,
    setEditConnectionSourceTileId,
    isSavingConnection,
    handleStartEditConnection,
    handleCancelEditConnection,
    handleSaveConnection,
    editingSourceId,
    editForm,
    isSavingSource,
    handleStartEditSource,
    handleCancelEditSource,
    updateEditField,
    handleSaveSource,
  } = state;

  const isAnyEditing = !!editingSourceId || !!editingConnectionId;

  const urlSourceCount =
    tile.sources?.filter((s) => s.type === "url").length || 0;
  const isUrlLimitReached = urlSourceCount >= MAX_URLS_PER_TILE;

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
            {tile.tile_type !== "slack_reader" && (
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={sourceForm.type}
                  onValueChange={(v) =>
                    updateSourceField("type", v as SourceTypeKey)
                  }
                >
                  <SelectTrigger>
                    <SelectValue className="text-left" />
                  </SelectTrigger>
                  <SelectContent>
                    {renderSourceTypeOptions(tile.tile_type)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sourceForm.type === "url" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  URL sources are validated for accessibility and format before
                  being added.
                </p>
                <Button
                  onClick={() => state.openAddUrlDialog()}
                  disabled={isUrlLimitReached}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add URL Source
                </Button>
                {isUrlLimitReached && (
                  <p className="text-xs text-amber-400">
                    URL limit reached ({MAX_URLS_PER_TILE} max per tile)
                  </p>
                )}
              </div>
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
                      <SelectValue
                        placeholder="Select a tile..."
                        className="text-left"
                      />
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
                      <SelectValue className="text-left" />
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

                {/* Connection behavior hint */}
                <p className="text-xs text-muted-foreground rounded-md bg-muted/40 p-2">
                  {getConnectionBehaviorHint(tile.tile_type)}
                </p>

                {/* URL extraction options (for url_reader tiles) */}
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
                              <SelectValue className="text-left" />
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
                            max={MAX_URLS_PER_TILE}
                            value={sourceForm.maxUrls}
                            onChange={(e) =>
                              updateSourceField(
                                "maxUrls",
                                Math.min(
                                  MAX_URLS_PER_TILE,
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

            {sourceForm.type === "slack_channel" && (
              <div className="space-y-3">
                <SlackConnectButton returnTo={`/mosaics/${tile.mosaic_id}`} />
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <SlackChannelPicker
                    value={sourceForm.slackChannelId || null}
                    onChange={(id, name, teamId, teamName) => {
                      updateSourceField("slackChannelId", id);
                      updateSourceField("slackChannelName", name);
                      updateSourceField("slackTeamId", teamId);
                      updateSourceField("slackTeamName", teamName);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time window (days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={sourceForm.slackDays}
                    onChange={(e) =>
                      updateSourceField(
                        "slackDays",
                        Math.min(
                          30,
                          Math.max(1, parseInt(e.target.value) || 1),
                        ),
                      )
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div>
                    <Label className="text-sm">Include threads</Label>
                    <p className="text-xs text-muted-foreground">
                      Include threaded replies from channel messages
                    </p>
                  </div>
                  <Switch
                    checked={sourceForm.slackIncludeThreads}
                    onCheckedChange={(v) =>
                      updateSourceField("slackIncludeThreads", v)
                    }
                  />
                </div>
              </div>
            )}

            {sourceForm.type !== "url" && (
              <>
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
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Existing Sources */}
        <div className="space-y-2">
          <Label>Current Sources ({totalSourceCount})</Label>
          {totalSourceCount === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No sources configured yet
            </p>
          ) : (
            <div className="space-y-2">
              {/* External Sources */}
              {tile.sources?.map((source) => {
                const isEditing = editingSourceId === source.id;
                const urlConfig = source.config as {
                  extract_depth?: string;
                  query?: string;
                  hours_back?: number;
                  include_threads?: boolean;
                  channel_name?: string;
                  team_name?: string;
                } | null;

                if (isEditing && source.type === "slack_channel") {
                  return (
                    <div
                      key={source.id}
                      className="rounded-lg border border-cyan-500/40 bg-muted/20 p-3 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <SourceIcon
                          type={source.type}
                          className="h-5 w-5 shrink-0"
                        />
                        <span className="text-sm font-medium">
                          Edit Slack Channel
                        </span>
                      </div>

                      <div className="space-y-2">
                        <Label>Channel</Label>
                        <Input
                          value={urlConfig?.channel_name || ""}
                          disabled
                          className="opacity-60"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Time window (days)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={editForm.slackDays}
                          onChange={(e) =>
                            updateEditField(
                              "slackDays",
                              Math.min(
                                30,
                                Math.max(1, parseInt(e.target.value) || 1),
                              ),
                            )
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                        <div>
                          <Label className="text-sm">Include threads</Label>
                          <p className="text-xs text-muted-foreground">
                            Include threaded replies from channel messages
                          </p>
                        </div>
                        <Switch
                          checked={editForm.slackIncludeThreads}
                          onCheckedChange={(v) =>
                            updateEditField("slackIncludeThreads", v)
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                        <Label className="text-sm">Active</Label>
                        <Switch
                          checked={editForm.isActive}
                          onCheckedChange={(v) =>
                            updateEditField("isActive", v)
                          }
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={handleCancelEditSource}
                          disabled={isSavingSource}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleSaveSource}
                          disabled={isSavingSource}
                        >
                          {isSavingSource ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                }

                if (isEditing && source.type === "web_search") {
                  return (
                    <div
                      key={source.id}
                      className="rounded-lg border border-cyan-500/40 bg-muted/20 p-3 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <SourceIcon
                          type={source.type}
                          className="h-5 w-5 shrink-0"
                        />
                        <span className="text-sm font-medium">
                          Edit {SOURCE_TYPE_CONFIG[source.type].label}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <Label>Search Query</Label>
                        <Input
                          value={editForm.searchQuery}
                          onChange={(e) =>
                            updateEditField("searchQuery", e.target.value)
                          }
                          placeholder="Enter search query..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Name (optional)</Label>
                        <Input
                          value={editForm.name}
                          onChange={(e) =>
                            updateEditField("name", e.target.value)
                          }
                          placeholder="Friendly name for this source"
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                        <Label className="text-sm">Active</Label>
                        <Switch
                          checked={editForm.isActive}
                          onCheckedChange={(v) =>
                            updateEditField("isActive", v)
                          }
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={handleCancelEditSource}
                          disabled={isSavingSource}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleSaveSource}
                          disabled={isSavingSource}
                        >
                          {isSavingSource ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                }

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
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {getSourceDisplayName(source)}
                        </p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${SOURCE_TYPE_CONFIG[source.type].color}`}
                        >
                          {SOURCE_TYPE_CONFIG[source.type].label}
                        </Badge>
                      </div>
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
                        {source.type === "slack_channel" && (
                          <span>
                            {urlConfig?.team_name
                              ? `${urlConfig.team_name} \u00B7 `
                              : ""}
                            {(urlConfig?.hours_back ?? 24) / 24}d &middot;{" "}
                            {urlConfig?.include_threads !== false
                              ? "threads"
                              : "no threads"}
                          </span>
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
                        className="h-8 w-8 text-muted-foreground hover:text-cyan-400"
                        onClick={() =>
                          source.type === "url"
                            ? state.openEditUrlDialog(source)
                            : handleStartEditSource(source)
                        }
                        disabled={isAnyEditing}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDeleteSource(source.id)}
                        disabled={
                          deletingSourceId === source.id || isAnyEditing
                        }
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
                const isEditingConn = editingConnectionId === conn.id;

                if (isEditingConn) {
                  return (
                    <div
                      key={conn.id}
                      className="rounded-lg border border-cyan-500/40 bg-muted/20 p-3 space-y-3"
                    >
                      <div className="flex items-center gap-2">
                        <Link2 className="h-5 w-5 shrink-0 text-teal-400" />
                        <span className="text-sm font-medium">
                          Edit Tile Connection
                        </span>
                      </div>

                      <div className="space-y-2">
                        <Label>Source Tile</Label>
                        <Select
                          value={editConnectionSourceTileId}
                          onValueChange={setEditConnectionSourceTileId}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder="Select a tile..."
                              className="text-left"
                            />
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

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={handleCancelEditConnection}
                          disabled={isSavingConnection}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={handleSaveConnection}
                          disabled={isSavingConnection}
                        >
                          {isSavingConnection ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-1 h-4 w-4" />
                          )}
                          Save
                        </Button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={conn.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3"
                  >
                    <Link2 className="h-5 w-5 shrink-0 text-teal-400" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{tileName}</p>
                        <Badge
                          variant="outline"
                          className="text-[10px] shrink-0 text-teal-400"
                        >
                          Tile Connection
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Connected tile output
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-cyan-400"
                        onClick={() =>
                          handleStartEditConnection(
                            conn.id,
                            conn.source_tile_id,
                          )
                        }
                        disabled={isAnyEditing}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => handleDeleteConnection(conn.id)}
                        disabled={
                          deletingConnectionId === conn.id || isAnyEditing
                        }
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

          {/* Auto-run trigger */}
          {(tile.incoming_connections?.length ?? 0) > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 mt-2">
              <div>
                <Label className="text-sm">Auto-run on source update</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically run when a connected source tile completes
                </p>
              </div>
              <Switch
                checked={state.configState.triggerOnSourceUpdate}
                onCheckedChange={() =>
                  state.handleToggleTriggerOnSourceUpdate()
                }
                disabled={state.isSaving || disabled}
              />
            </div>
          )}
        </div>
      </div>

      {/* URL Source Modal */}
      <AddUrlSourceDialog
        tile={tile}
        mode={state.editingUrlSource ? "edit" : "add"}
        existingSource={state.editingUrlSource || undefined}
        open={state.isUrlDialogOpen}
        onOpenChange={state.setIsUrlDialogOpen}
        onSuccess={state.handleUrlSourceSaved}
      />
    </PluginCard>
  );
}
