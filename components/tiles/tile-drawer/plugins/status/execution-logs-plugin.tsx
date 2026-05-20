"use client";

import {
  ArrowDown,
  Bug,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Loader2,
  Play,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  deleteAllExecutionLogs,
  deleteExecutionLog,
  type ExecutionLogEntry,
  getTileAllExecutionLogs,
} from "@/lib/actions/tile-execution";
import { cn } from "@/lib/utils";
import { formatDuration, formatRelativeTime } from "@/lib/utils/format";
import type { TileWithSources } from "@/types/database";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import { PluginCard } from "../plugin-card";

const EVENT_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  started: {
    icon: <Play className="h-3.5 w-3.5 text-blue-400" />,
    color: "text-blue-400",
    label: "Started",
  },
  completed: {
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
    color: "text-green-400",
    label: "Completed",
  },
  failed: {
    icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
    color: "text-red-400",
    label: "Failed",
  },
  timeout: {
    icon: <Clock className="h-3.5 w-3.5 text-orange-400" />,
    color: "text-orange-400",
    label: "Timeout",
  },
  cycle_detected: {
    icon: <RefreshCw className="h-3.5 w-3.5 text-yellow-400" />,
    color: "text-yellow-400",
    label: "Cycle Detected",
  },
  depth_exceeded: {
    icon: <ArrowDown className="h-3.5 w-3.5 text-yellow-400" />,
    color: "text-yellow-400",
    label: "Depth Exceeded",
  },
  rate_limited: {
    icon: <ShieldAlert className="h-3.5 w-3.5 text-red-400" />,
    color: "text-red-400",
    label: "Rate Limited",
  },
};

const DEFAULT_CONFIG = {
  icon: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  color: "text-muted-foreground",
  label: "Unknown",
};

/** Return the first defined value from metadata for any of the given keys. */
function get(
  metadata: Record<string, unknown>,
  ...keys: string[]
): unknown | undefined {
  for (const key of keys) {
    if (metadata[key] !== undefined) return metadata[key];
  }
  return undefined;
}

function getInlineSummary(
  eventType: string,
  metadata: Record<string, unknown>,
): string | null {
  switch (eventType) {
    case "started": {
      const parts: string[] = [];
      const tileType = get(metadata, "tileType", "tile_type");
      const sourceCount = get(metadata, "sourceCount", "source_count");
      if (tileType) parts.push(String(tileType));
      if (sourceCount !== undefined) parts.push(`${sourceCount} sources`);
      return parts.length > 0 ? parts.join(", ") : null;
    }
    case "completed": {
      const parts: string[] = [];
      const durationMs = get(metadata, "durationMs", "duration_ms");
      const successSources = get(
        metadata,
        "sourcesSucceeded",
        "successful_sources",
      );
      const totalSources = get(metadata, "sourcesTotal", "total_sources");
      if (durationMs !== undefined)
        parts.push(formatDuration(Number(durationMs)));
      if (successSources !== undefined && totalSources !== undefined)
        parts.push(`${successSources}/${totalSources} sources`);
      return parts.length > 0 ? parts.join(", ") : null;
    }
    case "failed": {
      const msg = get(metadata, "error", "error_message", "message");
      if (msg) {
        const str = String(msg);
        return str.length > 60 ? str.slice(0, 60) + "…" : str;
      }
      return null;
    }
    default: {
      const depth = get(metadata, "cascadeDepth", "cascade_depth");
      if (depth !== undefined) return `depth: ${depth}`;
      return null;
    }
  }
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function MetadataDetails({
  eventType,
  metadata,
}: {
  eventType: string;
  metadata: Record<string, unknown>;
}) {
  switch (eventType) {
    case "started": {
      const trigger = get(metadata, "trigger");
      const tileType = get(metadata, "tileType", "tile_type");
      const sourceCount = get(metadata, "sourceCount", "source_count");
      const maxDepth = get(
        metadata,
        "maxDepth",
        "maxCascadeDepth",
        "max_cascade_depth",
      );
      const timeoutMs = get(metadata, "timeoutMs", "timeout_ms");
      return (
        <div className="space-y-1">
          {trigger !== undefined && (
            <MetadataRow label="Trigger" value={String(trigger)} />
          )}
          {tileType !== undefined && (
            <MetadataRow label="Tile type" value={String(tileType)} />
          )}
          {sourceCount !== undefined && (
            <MetadataRow label="Source count" value={String(sourceCount)} />
          )}
          {maxDepth !== undefined && (
            <MetadataRow label="Max depth" value={String(maxDepth)} />
          )}
          {timeoutMs !== undefined && (
            <MetadataRow
              label="Timeout"
              value={formatDuration(Number(timeoutMs))}
            />
          )}
        </div>
      );
    }

    case "completed": {
      const durationMs = get(metadata, "durationMs", "duration_ms");
      const successSources = get(
        metadata,
        "sourcesSucceeded",
        "successful_sources",
      );
      const totalSources = get(metadata, "sourcesTotal", "total_sources");
      const trigger = get(metadata, "trigger");
      return (
        <div className="space-y-1">
          {durationMs !== undefined && (
            <MetadataRow
              label="Duration"
              value={formatDuration(Number(durationMs))}
            />
          )}
          {successSources !== undefined && totalSources !== undefined && (
            <MetadataRow
              label="Sources"
              value={`${successSources} / ${totalSources} succeeded`}
            />
          )}
          {trigger !== undefined && (
            <MetadataRow label="Trigger" value={String(trigger)} />
          )}
        </div>
      );
    }

    case "failed":
    case "timeout": {
      const errorMsg = get(metadata, "error", "error_message", "message");
      const durationMs = get(metadata, "durationMs", "duration_ms");
      const trigger = get(metadata, "trigger");
      return (
        <div className="space-y-1">
          {errorMsg !== undefined && (
            <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">
              {String(errorMsg)}
            </div>
          )}
          {durationMs !== undefined && (
            <MetadataRow
              label="Duration"
              value={formatDuration(Number(durationMs))}
            />
          )}
          {trigger !== undefined && (
            <MetadataRow label="Trigger" value={String(trigger)} />
          )}
        </div>
      );
    }

    case "cycle_detected": {
      const visitedCount = get(metadata, "visitedCount", "visited_count");
      const cascadeDepth = get(metadata, "cascadeDepth", "cascade_depth");
      const triggeredBy = get(
        metadata,
        "triggeredByTileId",
        "triggered_by_tile_id",
      );
      return (
        <div className="space-y-1">
          {visitedCount !== undefined && (
            <MetadataRow label="Visited tiles" value={String(visitedCount)} />
          )}
          {cascadeDepth !== undefined && (
            <MetadataRow label="Cascade depth" value={String(cascadeDepth)} />
          )}
          {triggeredBy !== undefined && (
            <MetadataRow label="Triggered by" value={String(triggeredBy)} />
          )}
        </div>
      );
    }

    case "depth_exceeded": {
      const cascadeDepth = get(metadata, "cascadeDepth", "cascade_depth");
      const maxDepth = get(metadata, "maxCascadeDepth", "max_cascade_depth");
      return (
        <div className="space-y-1">
          {cascadeDepth !== undefined && (
            <MetadataRow label="Cascade depth" value={String(cascadeDepth)} />
          )}
          {maxDepth !== undefined && (
            <MetadataRow label="Max cascade depth" value={String(maxDepth)} />
          )}
        </div>
      );
    }

    case "rate_limited": {
      const reason = get(metadata, "reason");
      const currentCount = get(metadata, "currentCount", "current_count");
      const maxCount = get(metadata, "maxCount", "max_count");
      const cascadeDepth = get(metadata, "cascadeDepth", "cascade_depth");
      return (
        <div className="space-y-1">
          {reason !== undefined && (
            <MetadataRow label="Reason" value={String(reason)} />
          )}
          {currentCount !== undefined && maxCount !== undefined && (
            <MetadataRow
              label="Count"
              value={`${currentCount} / ${maxCount}`}
            />
          )}
          {cascadeDepth !== undefined && (
            <MetadataRow label="Cascade depth" value={String(cascadeDepth)} />
          )}
        </div>
      );
    }

    default:
      return (
        <pre className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words max-h-48 overflow-auto rounded bg-muted/30 p-2">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      );
  }
}

interface SourceDetail {
  identifier: string;
  type: string;
  success: boolean;
  contentLength: number;
  error?: string;
}

function DebugInfoSection({ debug }: { debug: Record<string, unknown> }) {
  const hasAiInfo = debug.modelId !== undefined;
  const sourceDetails = debug.sourceDetails as SourceDetail[] | undefined;

  return (
    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
      <div className="flex items-center gap-1.5 text-xs text-purple-400 font-medium">
        <Bug className="h-3 w-3" />
        Debug Info
      </div>

      {hasAiInfo && (
        <>
          <MetadataRow label="Model" value={String(debug.modelId)} />
          <MetadataRow
            label="Tokens (prompt / completion / total)"
            value={`${String(debug.promptTokens)} / ${String(debug.completionTokens)} / ${String(debug.totalTokens)}`}
          />
          <MetadataRow
            label="Finish reason"
            value={String(debug.finishReason)}
          />
        </>
      )}

      <MetadataRow
        label="Source fetch"
        value={`${String(debug.sourceFetchDurationMs)}ms`}
      />
      <MetadataRow
        label="AI analysis"
        value={`${String(debug.aiAnalysisDurationMs)}ms`}
      />
      <MetadataRow label="Total" value={`${String(debug.totalDurationMs)}ms`} />

      {hasAiInfo && typeof debug.fullPrompt === "string" && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
            Full prompt
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/30 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
            {debug.fullPrompt}
          </pre>
        </details>
      )}

      {sourceDetails && sourceDetails.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
            Source details ({sourceDetails.length})
          </summary>
          <div className="mt-1 space-y-1 text-xs">
            {sourceDetails.map((src, i) => (
              <div
                key={i}
                className={cn(
                  "rounded px-2 py-1",
                  src.success ? "bg-muted/30" : "bg-red-500/10",
                )}
              >
                <div className="flex justify-between">
                  <span className="truncate max-w-[70%]">{src.identifier}</span>
                  <span className="text-muted-foreground">{src.type}</span>
                </div>
                {src.success ? (
                  <span className="text-muted-foreground">
                    {src.contentLength.toLocaleString()} chars
                  </span>
                ) : (
                  <span className="text-red-400">{src.error}</span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

interface ExecutionLogsPluginProps {
  tile: TileWithSources;
  state: TileDrawerState;
}

function formatLogForClipboard(log: ExecutionLogEntry): string {
  const ts = new Date(log.created_at).toISOString();
  const pairs = Object.entries(log.metadata)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(", ");
  return `[${ts}] ${log.event_type.toUpperCase()}${pairs ? `: ${pairs}` : ""}`;
}

export function ExecutionLogsPlugin({ tile, state }: ExecutionLogsPluginProps) {
  const { executionStatus, pluginState, updatePluginState } = state;

  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const collapsed = pluginState["execution-logs"] ?? true;

  useEffect(() => {
    if (collapsed) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state before async fetch
    setIsLoading(true);

    getTileAllExecutionLogs(tile.id, 50).then((data) => {
      if (!cancelled) {
        setLogs(data);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tile.id, collapsed, executionStatus]);

  const handleCopyEntry = useCallback((log: ExecutionLogEntry) => {
    navigator.clipboard.writeText(formatLogForClipboard(log)).then(() => {
      setCopiedLogId(log.id);
      setTimeout(() => setCopiedLogId(null), 2000);
    });
  }, []);

  const handleDeleteEntry = useCallback(
    async (logId: string) => {
      const result = await deleteExecutionLog(logId);
      if (result.success) {
        setLogs((prev) => prev.filter((l) => l.id !== logId));
        if (expandedLogId === logId) setExpandedLogId(null);
      }
    },
    [expandedLogId],
  );

  const handleClearAll = useCallback(async () => {
    const result = await deleteAllExecutionLogs(tile.id);
    if (result.success) {
      setLogs([]);
      setExpandedLogId(null);
    }
  }, [tile.id]);

  // Build a map of job_id -> debug metadata from recentJobs
  const recentJobs = executionStatus?.recentJobs ?? [];
  const debugByJobId = new Map<string, Record<string, unknown>>();
  for (const job of recentJobs) {
    const meta = job.metadata as Record<string, unknown> | null;
    const debug = meta?.debug as Record<string, unknown> | undefined;
    if (debug) {
      debugByJobId.set(job.id, debug);
    }
  }

  return (
    <PluginCard
      id="execution-logs"
      title="Execution Logs"
      description="Granular execution events"
      icon={<ScrollText className="h-4 w-4 text-amber-400" />}
      section="status"
      collapsed={collapsed}
      onCollapsedChange={(c) => updatePluginState("execution-logs", c)}
      badge={
        logs.length > 0
          ? { text: `${logs.length} events`, variant: "secondary" }
          : undefined
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No execution logs yet
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex justify-end">
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear all</span>
            </button>
          </div>
          {logs.map((log) => {
            const config = EVENT_CONFIG[log.event_type] || DEFAULT_CONFIG;
            const isExpanded = expandedLogId === log.id;
            const summary = getInlineSummary(log.event_type, log.metadata);
            const isDebug =
              log.metadata.debug === true ||
              (log.job_id ? debugByJobId.has(log.job_id) : false);
            const debug =
              (log.event_type === "completed" || log.event_type === "failed") &&
              log.job_id
                ? debugByJobId.get(log.job_id)
                : undefined;
            const isCopied = copiedLogId === log.id;

            return (
              <div
                key={log.id}
                className="rounded-md border border-border bg-muted/20 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {config.icon}
                    <span className={cn("font-medium", config.color)}>
                      {config.label}
                    </span>
                    {isDebug && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1 py-0 h-4 border-purple-500/50 text-purple-400"
                      >
                        <Bug className="h-2.5 w-2.5 mr-0.5" />
                        Debug
                      </Badge>
                    )}
                    {summary && (
                      <span className="text-xs text-muted-foreground truncate">
                        {summary}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 ml-2">
                    <span>{formatRelativeTime(log.created_at)}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 transition-transform",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-border px-3 py-2 space-y-1">
                    <MetadataDetails
                      eventType={log.event_type}
                      metadata={log.metadata}
                    />
                    {debug && <DebugInfoSection debug={debug} />}
                    <div className="flex justify-end gap-3 pt-1">
                      <button
                        onClick={() => handleCopyEntry(log)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy this entry"
                      >
                        {isCopied ? (
                          <Check className="h-3 w-3 text-green-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{isCopied ? "Copied" : "Copy"}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteEntry(log.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 transition-colors"
                        title="Delete this entry"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PluginCard>
  );
}
