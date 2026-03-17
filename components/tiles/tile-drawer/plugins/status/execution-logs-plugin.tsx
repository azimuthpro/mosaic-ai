"use client";

import {
  ArrowDown,
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
                  <div className="border-t border-border px-3 py-2">
                    <pre className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words max-h-48 overflow-auto rounded bg-muted/30 p-2">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
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
