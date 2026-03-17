"use client";

import {
  ArrowDown,
  Bug,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
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

function getInlineSummary(
  eventType: string,
  metadata: Record<string, unknown>,
): string | null {
  switch (eventType) {
    case "started": {
      const parts: string[] = [];
      if (metadata.tile_type) parts.push(String(metadata.tile_type));
      if (metadata.source_count !== undefined)
        parts.push(`${metadata.source_count} sources`);
      return parts.length > 0 ? parts.join(", ") : null;
    }
    case "completed": {
      const parts: string[] = [];
      if (metadata.duration_ms !== undefined)
        parts.push(formatDuration(Number(metadata.duration_ms)));
      if (
        metadata.successful_sources !== undefined &&
        metadata.total_sources !== undefined
      )
        parts.push(
          `${metadata.successful_sources}/${metadata.total_sources} sources`,
        );
      return parts.length > 0 ? parts.join(", ") : null;
    }
    case "failed": {
      const msg = metadata.error_message || metadata.error || metadata.message;
      if (msg) {
        const str = String(msg);
        return str.length > 60 ? str.slice(0, 60) + "…" : str;
      }
      return null;
    }
    default: {
      if (metadata.cascade_depth !== undefined)
        return `depth: ${metadata.cascade_depth}`;
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
    case "started":
      return (
        <div className="space-y-1">
          {metadata.trigger !== undefined && (
            <MetadataRow label="Trigger" value={String(metadata.trigger)} />
          )}
          {metadata.tile_type !== undefined && (
            <MetadataRow label="Tile type" value={String(metadata.tile_type)} />
          )}
          {metadata.source_count !== undefined && (
            <MetadataRow
              label="Source count"
              value={String(metadata.source_count)}
            />
          )}
          {metadata.max_cascade_depth !== undefined && (
            <MetadataRow
              label="Max depth"
              value={String(metadata.max_cascade_depth)}
            />
          )}
          {metadata.timeout_ms !== undefined && (
            <MetadataRow
              label="Timeout"
              value={formatDuration(Number(metadata.timeout_ms))}
            />
          )}
        </div>
      );

    case "completed":
      return (
        <div className="space-y-1">
          {metadata.duration_ms !== undefined && (
            <MetadataRow
              label="Duration"
              value={formatDuration(Number(metadata.duration_ms))}
            />
          )}
          {metadata.successful_sources !== undefined &&
            metadata.total_sources !== undefined && (
              <MetadataRow
                label="Sources"
                value={`${metadata.successful_sources} / ${metadata.total_sources} succeeded`}
              />
            )}
          {metadata.trigger !== undefined && (
            <MetadataRow label="Trigger" value={String(metadata.trigger)} />
          )}
        </div>
      );

    case "failed":
    case "timeout": {
      const errorMsg =
        metadata.error_message ?? metadata.error ?? metadata.message;
      return (
        <div className="space-y-1">
          {errorMsg !== undefined && (
            <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">
              {String(errorMsg)}
            </div>
          )}
          {metadata.duration_ms !== undefined && (
            <MetadataRow
              label="Duration"
              value={formatDuration(Number(metadata.duration_ms))}
            />
          )}
          {metadata.trigger !== undefined && (
            <MetadataRow label="Trigger" value={String(metadata.trigger)} />
          )}
        </div>
      );
    }

    case "cycle_detected":
      return (
        <div className="space-y-1">
          {metadata.visited_count !== undefined && (
            <MetadataRow
              label="Visited tiles"
              value={String(metadata.visited_count)}
            />
          )}
          {metadata.cascade_depth !== undefined && (
            <MetadataRow
              label="Cascade depth"
              value={String(metadata.cascade_depth)}
            />
          )}
          {metadata.triggered_by_tile_id !== undefined && (
            <MetadataRow
              label="Triggered by"
              value={String(metadata.triggered_by_tile_id)}
            />
          )}
        </div>
      );

    case "depth_exceeded":
      return (
        <div className="space-y-1">
          {metadata.cascade_depth !== undefined && (
            <MetadataRow
              label="Cascade depth"
              value={String(metadata.cascade_depth)}
            />
          )}
          {metadata.max_cascade_depth !== undefined && (
            <MetadataRow
              label="Max cascade depth"
              value={String(metadata.max_cascade_depth)}
            />
          )}
        </div>
      );

    case "rate_limited":
      return (
        <div className="space-y-1">
          {metadata.reason !== undefined && (
            <MetadataRow label="Reason" value={String(metadata.reason)} />
          )}
          {metadata.current_count !== undefined &&
            metadata.max_count !== undefined && (
              <MetadataRow
                label="Count"
                value={`${metadata.current_count} / ${metadata.max_count}`}
              />
            )}
          {metadata.cascade_depth !== undefined && (
            <MetadataRow
              label="Cascade depth"
              value={String(metadata.cascade_depth)}
            />
          )}
        </div>
      );

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

export function ExecutionLogsPlugin({ tile, state }: ExecutionLogsPluginProps) {
  const { executionStatus, pluginState, updatePluginState } = state;

  const [logs, setLogs] = useState<ExecutionLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

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
          {logs.map((log) => {
            const config = EVENT_CONFIG[log.event_type] || DEFAULT_CONFIG;
            const isExpanded = expandedLogId === log.id;
            const summary = getInlineSummary(log.event_type, log.metadata);
            const debug =
              (log.event_type === "completed" || log.event_type === "failed") &&
              log.job_id
                ? debugByJobId.get(log.job_id)
                : undefined;

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
