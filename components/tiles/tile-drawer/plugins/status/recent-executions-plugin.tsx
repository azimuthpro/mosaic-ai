"use client";

import {
  Bug,
  CheckCircle2,
  ChevronDown,
  Clock,
  History,
  Loader2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { formatDuration, formatRelativeTime } from "@/lib/utils/format";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import { PluginCard } from "../plugin-card";

interface SourceDetail {
  identifier: string;
  type: string;
  success: boolean;
  contentLength: number;
  error?: string;
}

const STATUS_ICONS = {
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  processing: <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-400" />,
};

interface RecentExecutionsPluginProps {
  state: TileDrawerState;
}

export function RecentExecutionsPlugin({ state }: RecentExecutionsPluginProps) {
  const { executionStatus, pluginState, updatePluginState } = state;
  const recentJobs = executionStatus?.recentJobs ?? [];
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  if (recentJobs.length === 0) return null;

  return (
    <PluginCard
      id="recent-executions"
      title="Recent Executions"
      description="Execution history"
      icon={<History className="h-4 w-4 text-amber-400" />}
      section="status"
      collapsed={pluginState["recent-executions"] ?? true}
      onCollapsedChange={(collapsed) =>
        updatePluginState("recent-executions", collapsed)
      }
      badge={{
        text: `${recentJobs.length} runs`,
        variant: "secondary",
      }}
    >
      <div className="space-y-1.5">
        {recentJobs.slice(0, 5).map((job) => {
          const isExpanded = expandedJobId === job.id;
          const duration =
            job.completed_at && job.started_at
              ? new Date(job.completed_at).getTime() -
                new Date(job.started_at).getTime()
              : null;
          const metadata = job.metadata as Record<string, unknown> | null;
          const successfulSources = metadata?.successful_sources;

          return (
            <div
              key={job.id}
              className="rounded-md border border-border bg-muted/20 overflow-hidden"
            >
              <button
                onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {STATUS_ICONS[job.status]}
                  <span className="capitalize">{job.status}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {duration !== null && <span>{formatDuration(duration)}</span>}
                  <span>{formatRelativeTime(job.created_at)}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  />
                </div>
              </button>
              {isExpanded && (
                <div className="border-t border-border px-3 py-2 text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Started</span>
                    <span>
                      {job.started_at
                        ? new Date(job.started_at).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Completed</span>
                    <span>
                      {job.completed_at
                        ? new Date(job.completed_at).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  {successfulSources !== undefined && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Sources processed</span>
                      <span>{String(successfulSources)}</span>
                    </div>
                  )}
                  {job.error_message && (
                    <div className="rounded bg-red-500/10 p-2 text-red-400 mt-1">
                      {job.error_message}
                    </div>
                  )}
                  <DebugInfoSection metadata={metadata} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PluginCard>
  );
}

function DebugInfoSection({
  metadata,
}: {
  metadata: Record<string, unknown> | null;
}) {
  const debug = metadata?.debug as Record<string, unknown> | undefined;
  if (!debug) return null;

  const hasAiInfo = debug.modelId !== undefined;
  const sourceDetails = debug.sourceDetails as SourceDetail[] | undefined;

  return (
    <div className="mt-2 space-y-2 border-t border-border pt-2">
      <div className="flex items-center gap-1.5 text-purple-400 font-medium">
        <Bug className="h-3 w-3" />
        Debug Info
      </div>

      {hasAiInfo && (
        <>
          <div className="flex justify-between text-muted-foreground">
            <span>Model</span>
            <span>{String(debug.modelId)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tokens (prompt / completion / total)</span>
            <span>
              {String(debug.promptTokens)} / {String(debug.completionTokens)} /{" "}
              {String(debug.totalTokens)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Finish reason</span>
            <span>{String(debug.finishReason)}</span>
          </div>
        </>
      )}

      <div className="flex justify-between text-muted-foreground">
        <span>Source fetch</span>
        <span>{String(debug.sourceFetchDurationMs)}ms</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>AI analysis</span>
        <span>{String(debug.aiAnalysisDurationMs)}ms</span>
      </div>
      <div className="flex justify-between text-muted-foreground">
        <span>Total</span>
        <span>{String(debug.totalDurationMs)}ms</span>
      </div>

      {hasAiInfo && typeof debug.fullPrompt === "string" && (
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            Full prompt
          </summary>
          <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/30 p-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words">
            {debug.fullPrompt}
          </pre>
        </details>
      )}

      {sourceDetails && sourceDetails.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            Source details ({sourceDetails.length})
          </summary>
          <div className="mt-1 space-y-1">
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
