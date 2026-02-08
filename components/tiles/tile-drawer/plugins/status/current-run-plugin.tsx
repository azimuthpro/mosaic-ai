"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDuration, formatRelativeTime } from "@/lib/utils/format";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import { PluginCard } from "../plugin-card";
import { getScheduleLabel } from "../utils";

const STATUS_CONFIG = {
  pending: {
    icon: <Clock className="h-4 w-4 text-muted-foreground" />,
    badgeVariant: "outline" as const,
  },
  processing: {
    icon: <Loader2 className="h-4 w-4 animate-spin text-amber-400" />,
    badgeVariant: "secondary" as const,
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4 text-green-400" />,
    badgeVariant: "secondary" as const,
  },
  failed: {
    icon: <XCircle className="h-4 w-4 text-red-400" />,
    badgeVariant: "destructive" as const,
  },
};

interface CurrentRunPluginProps {
  state: TileDrawerState;
}

export function CurrentRunPlugin({ state }: CurrentRunPluginProps) {
  const { executionStatus, pluginState, updatePluginState, configState } =
    state;
  const lastJob = executionStatus?.lastJob;

  const statusConfig = lastJob ? STATUS_CONFIG[lastJob.status] : null;

  const duration =
    lastJob?.completed_at && lastJob?.started_at
      ? new Date(lastJob.completed_at).getTime() -
        new Date(lastJob.started_at).getTime()
      : null;

  const scheduleLabel = getScheduleLabel(configState.scheduleCron);

  return (
    <PluginCard
      id="current-run"
      title="Current Run"
      description="Latest execution status"
      icon={<Play className="h-4 w-4 text-amber-400" />}
      section="status"
      collapsed={pluginState["current-run"] ?? false}
      onCollapsedChange={(collapsed) =>
        updatePluginState("current-run", collapsed)
      }
      badge={
        lastJob
          ? {
              text:
                lastJob.status.charAt(0).toUpperCase() +
                lastJob.status.slice(1),
              variant: statusConfig?.badgeVariant,
            }
          : { text: "No runs", variant: "outline" }
      }
    >
      {lastJob ? (
        <div className="space-y-3">
          {/* Status row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {statusConfig?.icon}
              <span className="font-medium capitalize">{lastJob.status}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {lastJob.started_at && (
                <span>{formatRelativeTime(lastJob.started_at)}</span>
              )}
              {duration !== null && (
                <Badge variant="outline" className="text-xs">
                  {formatDuration(duration)}
                </Badge>
              )}
            </div>
          </div>

          {/* Error box */}
          {lastJob.error_message && (
            <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-2.5 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{lastJob.error_message}</span>
            </div>
          )}

          {/* Sources processed */}
          {executionStatus && executionStatus.sourcesCount > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Sources processed</span>
                <span>
                  {executionStatus.successfulSources}/
                  {executionStatus.sourcesCount}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{
                    width: `${(executionStatus.successfulSources / executionStatus.sourcesCount) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Trigger info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
            <Clock className="h-3.5 w-3.5" />
            <span>{scheduleLabel}</span>
            <span className="text-muted-foreground/50">·</span>
            <Badge
              variant={configState.isActive ? "secondary" : "outline"}
              className="text-xs"
            >
              {configState.isActive ? "Active" : "Paused"}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-4 text-center text-muted-foreground">
          <Play className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm">No executions yet</p>
          <p className="text-xs">Run the tile to see execution status</p>
        </div>
      )}
    </PluginCard>
  );
}
