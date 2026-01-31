"use client";

import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Database,
  FileText,
  Globe,
  Key,
  Link2,
  Loader2,
  Play,
  Plus,
  Search,
  Settings,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AdvancedScheduler } from "@/components/tiles/advanced-scheduler";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  getTileExecutionStatus,
  getTileJobResults,
  type TileExecutionStatus,
  type TileJobResultSummary,
} from "@/lib/actions/tile-execution";
import {
  addTileSource,
  deleteTileSource,
  getTilesForSourceSelection,
  toggleTileActive,
  updateTile,
} from "@/lib/actions/tiles";
import { formatDuration, formatRelativeTime } from "@/lib/utils/format";
import type { TileType, TileWithSources } from "@/types/database";

interface TileDrawerProps {
  tile: TileWithSources | null;
  mosaicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunTile?: (tileId: string) => void;
}

const TILE_TYPE_LABELS: Record<TileType, string> = {
  url_reader: "URL Reader",
  web_search: "Web Search",
  recursive: "Pipeline",
  analyzer: "Analyzer",
};

const STATUS_ICONS = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  processing: <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  failed: <XCircle className="h-4 w-4 text-red-400" />,
};

const SOURCE_TYPE_CONFIG = {
  url: { icon: Globe, color: "text-cyan-400", label: "URL" },
  web_search: { icon: Search, color: "text-pink-400", label: "Web Search" },
  agent_report: { icon: Link2, color: "text-teal-400", label: "Tile Report" },
} as const;

const DEFAULT_SOURCE_TYPES: Record<
  TileType,
  "url" | "web_search" | "agent_report"
> = {
  url_reader: "url",
  web_search: "web_search",
  recursive: "agent_report",
  analyzer: "agent_report",
};

interface SourceIconProps {
  type: keyof typeof SOURCE_TYPE_CONFIG;
  className?: string;
}

function SourceIcon({ type, className = "h-4 w-4 shrink-0" }: SourceIconProps) {
  const config = SOURCE_TYPE_CONFIG[type];
  const Icon = config.icon;
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

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
}

export function TileDrawer({
  tile,
  mosaicId,
  open,
  onOpenChange,
  onRunTile,
}: TileDrawerProps) {
  const [activeTab, setActiveTab] = useState("status");
  const [executionStatus, setExecutionStatus] =
    useState<TileExecutionStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Config form state
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isActive, setIsActive] = useState(true);

  // API keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Scheduler state
  const [scheduleCron, setScheduleCron] = useState<string | null>(null);

  // Job results state
  const [jobResults, setJobResults] = useState<TileJobResultSummary[]>([]);
  const [isLoadingJobResults, setIsLoadingJobResults] = useState(false);
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  // Source management state
  const [newSourceType, setNewSourceType] = useState<
    "url" | "web_search" | "agent_report"
  >("url");
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newSourceName, setNewSourceName] = useState("");
  const [newSearchQuery, setNewSearchQuery] = useState("");
  const [extractDepth, setExtractDepth] = useState<"basic" | "advanced">(
    "basic",
  );
  // Tile report source state
  const [selectedTileId, setSelectedTileId] = useState<string>("");
  const [extractUrlsFromReport, setExtractUrlsFromReport] = useState(false);
  const [maxUrls, setMaxUrls] = useState(10);
  const [availableTiles, setAvailableTiles] = useState<
    { id: string; name: string; tile_type: string }[]
  >([]);
  const [isLoadingTiles, setIsLoadingTiles] = useState(false);

  const [isAddingSource, setIsAddingSource] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);

  // Load execution status when tile changes
  useEffect(() => {
    if (tile && open) {
      setIsLoadingStatus(true);
      getTileExecutionStatus(tile.id).then((status) => {
        setExecutionStatus(status);
        setIsLoadingStatus(false);
      });

      // Reset form state
      setName(tile.name);
      setInstructions(tile.system_prompt || "");
      setIsActive(tile.is_active);
      setScheduleCron(tile.schedule_cron);

      // Reset source form based on tile type
      setNewSourceType(DEFAULT_SOURCE_TYPES[tile.tile_type]);
      setNewSourceUrl("");
      setNewSourceName("");
      setNewSearchQuery("");
      setExtractDepth("basic");
      setSelectedTileId("");
      setExtractUrlsFromReport(false);
      setMaxUrls(10);
    }
  }, [tile, open]);

  // Load API keys when API tab is selected
  useEffect(() => {
    if (activeTab === "api" && tile) {
      setIsLoadingKeys(true);
      fetch(`/api/v1/mosaics/${mosaicId}/keys`)
        .then((res) => res.json())
        .then((data) => {
          setApiKeys(data.keys || []);
          setIsLoadingKeys(false);
        })
        .catch(() => {
          setIsLoadingKeys(false);
        });
    }
  }, [activeTab, tile, mosaicId]);

  // Load job results when Jobs tab is selected
  useEffect(() => {
    if (activeTab === "reports" && tile) {
      setIsLoadingJobResults(true);
      getTileJobResults(tile.id).then((data) => {
        setJobResults(data);
        setIsLoadingJobResults(false);
      });
    }
  }, [activeTab, tile]);

  // Load available tiles when Sources tab is selected (for tile report sources)
  useEffect(() => {
    if (activeTab === "sources" && tile) {
      setIsLoadingTiles(true);
      getTilesForSourceSelection(mosaicId, tile.id).then((tiles) => {
        setAvailableTiles(tiles);
        setIsLoadingTiles(false);
      });
    }
  }, [activeTab, tile, mosaicId]);

  const handleRun = async () => {
    if (!tile) return;
    setIsRunning(true);
    try {
      if (onRunTile) {
        onRunTile(tile.id);
      } else {
        const response = await fetch("/api/tiles/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileId: tile.id }),
        });
        const data = await response.json();
        if (!response.ok) {
          alert(data.error || "Failed to run tile");
        }
      }
    } catch {
      alert("Failed to run tile");
    } finally {
      setIsRunning(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!tile) return;
    setIsSaving(true);
    try {
      await updateTile(tile.id, {
        name,
        systemPrompt: instructions,
        scheduleCron: scheduleCron ?? undefined,
      });
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!tile) return;
    const newActive = !isActive;
    setIsActive(newActive);
    await toggleTileActive(tile.id);
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const response = await fetch(`/api/v1/mosaics/${mosaicId}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      const data = await response.json();
      if (response.ok) {
        setShowNewKey(data.key);
        setApiKeys((prev) => [
          {
            id: data.id,
            name: data.name,
            key_prefix: data.key_prefix,
            last_used_at: null,
            is_active: true,
            created_at: data.created_at,
          },
          ...prev,
        ]);
        setNewKeyName("");
      }
    } catch (error) {
      console.error("Failed to create key:", error);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return;
    try {
      await fetch(`/api/v1/mosaics/${mosaicId}/keys?key_id=${keyId}`, {
        method: "DELETE",
      });
      setApiKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, is_active: false } : k)),
      );
    } catch (error) {
      console.error("Failed to revoke key:", error);
    }
  };

  const copyToClipboard = useCallback(
    (text: string, type: "endpoint" | "key" | "curl") => {
      navigator.clipboard.writeText(text);
      const setters = {
        endpoint: setCopiedEndpoint,
        key: setCopiedKey,
        curl: setCopiedCurl,
      };
      const setter = setters[type];
      setter(true);
      setTimeout(() => setter(false), 2000);
    },
    [],
  );

  const handleAddSource = async () => {
    if (!tile) return;

    if (newSourceType === "url" && !newSourceUrl.trim()) {
      alert("Please enter a URL");
      return;
    }
    if (newSourceType === "web_search" && !newSearchQuery.trim()) {
      alert("Please enter a search query");
      return;
    }
    if (newSourceType === "agent_report" && !selectedTileId) {
      alert("Please select a tile");
      return;
    }

    setIsAddingSource(true);
    try {
      // Build params conditionally to avoid Next.js serializing undefined as "$undefined"
      const params: Parameters<typeof addTileSource>[0] = {
        tileId: tile.id,
        type: newSourceType,
      };

      if (newSourceName) {
        params.name = newSourceName;
      }

      if (newSourceType === "url") {
        params.url = newSourceUrl;
        params.urlConfig = { extract_depth: extractDepth };
      } else if (newSourceType === "web_search") {
        params.config = { query: newSearchQuery };
      } else if (newSourceType === "agent_report") {
        params.sourceReferenceId = selectedTileId;
        params.agentReportConfig = {
          extract_urls: extractUrlsFromReport,
          extract_depth: extractDepth,
          max_urls: maxUrls,
        };
      }

      const result = await addTileSource(params);

      if (result.error) {
        alert(result.error);
      } else {
        // Reset form
        setNewSourceUrl("");
        setNewSourceName("");
        setNewSearchQuery("");
        setExtractDepth("basic");
        setSelectedTileId("");
        setExtractUrlsFromReport(false);
        setMaxUrls(10);
      }
    } catch (error) {
      console.error("Failed to add source:", error);
      alert("Failed to add source");
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm("Are you sure you want to delete this source?")) return;

    setDeletingSourceId(sourceId);
    try {
      const result = await deleteTileSource(sourceId);
      if (result.error) {
        alert(result.error);
      }
    } catch (error) {
      console.error("Failed to delete source:", error);
      alert("Failed to delete source");
    } finally {
      setDeletingSourceId(null);
    }
  };

  if (!tile) return null;

  const apiEndpoint = `${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/tiles/${tile.id}/run`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-border px-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${tile.color}20` }}
            >
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: tile.color }}
              />
            </div>
            <div>
              <DrawerTitle className="text-left">{tile.name}</DrawerTitle>
              <DrawerDescription className="text-left">
                {TILE_TYPE_LABELS[tile.tile_type]} · Last run:{" "}
                {executionStatus?.lastJob
                  ? formatRelativeTime(executionStatus.lastJob.created_at)
                  : "Never"}
              </DrawerDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRun}
              disabled={isRunning || !tile.is_active}
              className="gap-2"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">
                Close
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="border-b border-border px-6">
            <TabsList className="h-12 w-full justify-start gap-4 bg-transparent p-0">
              <TabsTrigger
                value="status"
                className="flex items-center gap-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Activity className="h-4 w-4" />
                Status
              </TabsTrigger>
              <TabsTrigger
                value="sources"
                className="flex items-center gap-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Database className="h-4 w-4" />
                Sources
              </TabsTrigger>
              <TabsTrigger
                value="config"
                className="flex items-center gap-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Settings className="h-4 w-4" />
                Config
              </TabsTrigger>
              <TabsTrigger
                value="reports"
                className="flex items-center gap-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <FileText className="h-4 w-4" />
                Jobs
              </TabsTrigger>
              <TabsTrigger
                value="api"
                className="flex items-center gap-2 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Code2 className="h-4 w-4" />
                API
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="overflow-y-auto p-6">
            {/* Status Tab */}
            <TabsContent
              value="status"
              className="m-0 space-y-6 max-h-[60vh] overflow-y-auto"
            >
              {isLoadingStatus ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : executionStatus?.lastJob ? (
                <>
                  {/* Current Status */}
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {STATUS_ICONS[executionStatus.lastJob.status]}
                        <span className="font-medium capitalize">
                          {executionStatus.lastJob.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          Started:{" "}
                          {executionStatus.lastJob.started_at
                            ? new Date(
                                executionStatus.lastJob.started_at,
                              ).toLocaleTimeString()
                            : "-"}
                        </span>
                        {executionStatus.lastJob.completed_at &&
                          executionStatus.lastJob.started_at && (
                            <span>
                              Duration:{" "}
                              {formatDuration(
                                new Date(
                                  executionStatus.lastJob.completed_at,
                                ).getTime() -
                                  new Date(
                                    executionStatus.lastJob.started_at,
                                  ).getTime(),
                              )}
                            </span>
                          )}
                      </div>
                    </div>
                    {executionStatus.lastJob.error_message && (
                      <div className="mt-3 rounded bg-red-500/10 p-2 text-sm text-red-400">
                        {executionStatus.lastJob.error_message}
                      </div>
                    )}
                  </div>

                  {/* Recent Jobs */}
                  {executionStatus.recentJobs.length > 1 && (
                    <div>
                      <h4 className="mb-2 text-sm font-medium">
                        Recent Executions
                      </h4>
                      <div className="space-y-2">
                        {executionStatus.recentJobs.slice(0, 5).map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between rounded border border-border bg-muted/20 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              {STATUS_ICONS[job.status]}
                              <span className="capitalize">{job.status}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {formatRelativeTime(job.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-4 text-center text-muted-foreground">
                  No executions yet. Run the tile to see status.
                </div>
              )}

              {/* Sources Status - shown in all states */}
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sources:</span>
                <Badge variant="outline">
                  {tile.sources?.filter((s) => s.is_active).length || 0}/
                  {tile.sources?.length || 0} active
                </Badge>
              </div>
            </TabsContent>

            {/* Sources Tab */}
            <TabsContent
              value="sources"
              className="m-0 space-y-6 max-h-[60vh] overflow-y-auto"
            >
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
                      value={newSourceType}
                      onValueChange={(v) =>
                        setNewSourceType(
                          v as "url" | "web_search" | "agent_report",
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {/* URL Reader tiles: url and agent_report sources */}
                        {tile.tile_type === "url_reader" && (
                          <>
                            <SelectItem value="url">
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4 text-cyan-400" />
                                URL
                              </div>
                            </SelectItem>
                            <SelectItem value="agent_report">
                              <div className="flex items-center gap-2">
                                <Link2 className="h-4 w-4 text-teal-400" />
                                Tile Report
                              </div>
                            </SelectItem>
                          </>
                        )}
                        {/* Web Search tiles: web_search sources */}
                        {tile.tile_type === "web_search" && (
                          <SelectItem value="web_search">
                            <div className="flex items-center gap-2">
                              <Search className="h-4 w-4 text-pink-400" />
                              Web Search
                            </div>
                          </SelectItem>
                        )}
                        {/* Pipeline/Analyzer tiles: agent_report sources */}
                        {(tile.tile_type === "recursive" ||
                          tile.tile_type === "analyzer") && (
                          <SelectItem value="agent_report">
                            <div className="flex items-center gap-2">
                              <Link2 className="h-4 w-4 text-teal-400" />
                              Tile Report
                            </div>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {newSourceType === "url" && (
                    <>
                      <div className="space-y-2">
                        <Label>URL</Label>
                        <Input
                          value={newSourceUrl}
                          onChange={(e) => setNewSourceUrl(e.target.value)}
                          placeholder="https://example.com/page"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Extract Depth</Label>
                        <Select
                          value={extractDepth}
                          onValueChange={(v) =>
                            setExtractDepth(v as "basic" | "advanced")
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

                  {newSourceType === "agent_report" && (
                    <>
                      <div className="space-y-2">
                        <Label>Source Tile</Label>
                        <Select
                          value={selectedTileId}
                          onValueChange={setSelectedTileId}
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
                              checked={extractUrlsFromReport}
                              onCheckedChange={setExtractUrlsFromReport}
                            />
                          </div>

                          {extractUrlsFromReport && (
                            <>
                              <div className="space-y-2">
                                <Label>Extract Depth</Label>
                                <Select
                                  value={extractDepth}
                                  onValueChange={(v) =>
                                    setExtractDepth(v as "basic" | "advanced")
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
                                  value={maxUrls}
                                  onChange={(e) =>
                                    setMaxUrls(
                                      Math.min(
                                        50,
                                        Math.max(
                                          1,
                                          parseInt(e.target.value) || 10,
                                        ),
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

                  {newSourceType === "web_search" && (
                    <div className="space-y-2">
                      <Label>Search Query</Label>
                      <Input
                        value={newSearchQuery}
                        onChange={(e) => setNewSearchQuery(e.target.value)}
                        placeholder="Enter search query..."
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Name (optional)</Label>
                    <Input
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
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
                <Label>Current Sources ({tile.sources?.length || 0})</Label>
                {!tile.sources || tile.sources.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No sources configured yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {tile.sources.map((source) => {
                      const urlConfig = source.config as {
                        extract_depth?: string;
                        query?: string;
                        extract_urls?: boolean;
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
                              {source.type === "agent_report" && (
                                <span>
                                  Connected tile output
                                  {urlConfig?.extract_urls && (
                                    <span className="ml-1 text-teal-400">
                                      (URL extraction)
                                    </span>
                                  )}
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
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Config Tab */}
            <TabsContent
              value="config"
              className="m-0 space-y-6 max-h-[60vh] overflow-y-auto"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tile-name">Name</Label>
                  <Input
                    id="tile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tile name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tile-instructions">Instructions</Label>
                  <Textarea
                    id="tile-instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Instructions for the AI..."
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="tile-active">Active</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable scheduled execution
                    </p>
                  </div>
                  <Switch
                    id="tile-active"
                    checked={isActive}
                    onCheckedChange={handleToggleActive}
                  />
                </div>

                <Separator />

                <AdvancedScheduler
                  value={scheduleCron}
                  onChange={setScheduleCron}
                  disabled={isSaving}
                />

                <Button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save Changes
                </Button>
              </div>
            </TabsContent>

            {/* Jobs Tab */}
            <TabsContent
              value="reports"
              className="m-0 space-y-4 max-h-[60vh] overflow-y-auto"
            >
              {isLoadingJobResults ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : jobResults.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No jobs yet. Run the tile to see execution history.
                </div>
              ) : (
                <div className="space-y-3">
                  {jobResults.map((result) => {
                    const isExpanded = expandedResultId === result.id;
                    const contentStr =
                      typeof result.content === "string"
                        ? result.content
                        : JSON.stringify(result.content, null, 2);

                    return (
                      <div
                        key={result.id}
                        className="rounded-lg border border-border bg-muted/20 overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setExpandedResultId(isExpanded ? null : result.id)
                          }
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div className="text-left">
                              <p className="text-sm font-medium">
                                {formatRelativeTime(result.created_at)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {result.source_urls?.length || 0} sources ·{" "}
                                {result.format}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {isExpanded ? "Collapse" : "Expand"}
                          </Badge>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border p-4">
                            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 rounded p-3 max-h-[300px] overflow-y-auto">
                              {contentStr}
                            </pre>
                            {result.source_urls &&
                              result.source_urls.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Sources:
                                  </p>
                                  <div className="space-y-1">
                                    {result.source_urls.map((url, i) => (
                                      <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block text-xs text-cyan-400 hover:underline truncate"
                                      >
                                        {url}
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* API Tab */}
            <TabsContent
              value="api"
              className="m-0 space-y-6 max-h-[60vh] overflow-y-auto"
            >
              {/* Endpoint */}
              <div className="space-y-2">
                <Label>Endpoint</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={`POST ${apiEndpoint}`}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(apiEndpoint, "endpoint")}
                  >
                    {copiedEndpoint ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* curl Example */}
              <div className="space-y-2">
                <Label>Example Request</Label>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs font-mono">{`curl -X POST "${apiEndpoint}" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"urls": ["https://example.com"]}'`}</pre>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() =>
                    copyToClipboard(
                      `curl -X POST "${apiEndpoint}" \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"urls": ["https://example.com"]}'`,
                      "curl",
                    )
                  }
                >
                  {copiedCurl ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  Copy curl
                </Button>
              </div>

              {/* Request Schema */}
              <div className="space-y-2">
                <Label>Request Body (optional)</Label>
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <pre className="text-xs font-mono">{`{
  "urls": string[]  // Optional: Override configured sources
}`}</pre>
                </div>
                <p className="text-xs text-muted-foreground">
                  If urls array is provided, these take priority over configured
                  tile sources.
                </p>
              </div>

              {/* Response Schema (SSE Events) */}
              <Collapsible>
                <div className="space-y-2">
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-left hover:bg-muted/30 transition-colors">
                    <Label className="cursor-pointer">
                      Response (Server-Sent Events)
                    </Label>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        SSE Event Types:
                      </p>
                      <div className="space-y-1.5 text-xs font-mono">
                        <p>
                          <span className="text-cyan-400">started</span>:{" "}
                          {"{ jobId, tileId }"}
                        </p>
                        <p>
                          <span className="text-cyan-400">progress</span>:{" "}
                          {"{ jobId, sourceId, type, status }"}
                        </p>
                        <p>
                          <span className="text-cyan-400">result</span>:
                          {
                            " { jobId, report: { id, content, format, source_urls } }"
                          }
                        </p>
                        <p>
                          <span className="text-cyan-400">done</span>:{" "}
                          {"{ jobId }"}
                        </p>
                        <p>
                          <span className="text-red-400">error</span>:{" "}
                          {"{ message, code }"}
                        </p>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              <Separator />

              {/* Create New Key */}
              <div className="space-y-2">
                <Label>Create API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="Key name (e.g., Production)"
                  />
                  <Button
                    onClick={handleCreateKey}
                    disabled={isCreatingKey || !newKeyName.trim()}
                  >
                    {isCreatingKey ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Show newly created key */}
              {showNewKey && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                  <p className="mb-2 text-sm font-medium text-green-400">
                    API Key Created - Copy it now!
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={showNewKey}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(showNewKey, "key")}
                    >
                      {copiedKey ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    This key will not be shown again.
                  </p>
                </div>
              )}

              {/* Existing Keys */}
              <div className="space-y-2">
                <Label>API Keys</Label>
                {isLoadingKeys ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : apiKeys.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No API keys yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {apiKeys.map((key) => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between rounded border border-border px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{key.name}</span>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {key.key_prefix}...
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {key.is_active ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevokeKey(key.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              Revoke
                            </Button>
                          ) : (
                            <Badge variant="secondary">Revoked</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
