"use client";

import {
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
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PluginCard>
  );
}
