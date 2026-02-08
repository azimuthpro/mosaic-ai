"use client";

import {
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDuration, formatRelativeTime } from "@/lib/utils/format";
import type { TileWithSources } from "@/types/database";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import { PluginCard } from "../plugin-card";

interface QuickStatsPluginProps {
  tile: TileWithSources;
  state: TileDrawerState;
}

export function QuickStatsPlugin({ tile, state }: QuickStatsPluginProps) {
  const { executionStatus, pluginState, updatePluginState } = state;
  const recentJobs = executionStatus?.recentJobs ?? [];

  const totalJobs = recentJobs.length;
  const completedJobs = recentJobs.filter((j) => j.status === "completed");
  const successRate =
    totalJobs > 0 ? Math.round((completedJobs.length / totalJobs) * 100) : 0;

  // Average duration of completed jobs
  const durations = completedJobs
    .filter((j) => j.started_at && j.completed_at)
    .map(
      (j) =>
        new Date(j.completed_at!).getTime() - new Date(j.started_at!).getTime(),
    );
  const avgDuration =
    durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null;

  // Last success
  const lastSuccess = completedJobs[0] ?? null;

  // Sources
  const activeSources = tile.sources?.filter((s) => s.is_active).length ?? 0;
  const totalSources = tile.sources?.length ?? 0;

  let successRateColor = "text-red-400";
  if (successRate >= 80) successRateColor = "text-green-400";
  else if (successRate >= 50) successRateColor = "text-amber-400";

  return (
    <PluginCard
      id="quick-stats"
      title="Health"
      description="Execution metrics overview"
      icon={<BarChart3 className="h-4 w-4 text-amber-400" />}
      section="status"
      collapsed={pluginState["quick-stats"] ?? false}
      onCollapsedChange={(collapsed) =>
        updatePluginState("quick-stats", collapsed)
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {/* Success Rate */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Success Rate
          </div>
          <p className={cn("text-lg font-semibold", successRateColor)}>
            {totalJobs > 0 ? `${successRate}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {completedJobs.length}/{totalJobs} jobs
          </p>
        </div>

        {/* Avg Duration */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" />
            Avg Duration
          </div>
          <p className="text-lg font-semibold">
            {avgDuration !== null ? formatDuration(avgDuration) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {durations.length} completed
          </p>
        </div>

        {/* Last Success */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Last Success
          </div>
          <p className="text-lg font-semibold">
            {lastSuccess ? formatRelativeTime(lastSuccess.created_at) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            {lastSuccess ? "completed" : "no successes"}
          </p>
        </div>

        {/* Sources */}
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Database className="h-3.5 w-3.5" />
            Sources
          </div>
          <p className="text-lg font-semibold">
            {activeSources}/{totalSources}
          </p>
          <p className="text-xs text-muted-foreground">active</p>
        </div>
      </div>
    </PluginCard>
  );
}
