"use client";

import { CheckCircle2, Clock, Database, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDuration, formatRelativeTime } from "@/lib/utils/format";
import type { TileWithSources } from "@/types/database";

import type { TileDrawerState } from "../hooks/use-tile-drawer-state";

const STATUS_ICONS = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  processing: <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-400" />,
  failed: <XCircle className="h-4 w-4 text-red-400" />,
};

interface StatusSectionProps {
  tile: TileWithSources;
  state: TileDrawerState;
}

export function StatusSection({ tile, state }: StatusSectionProps) {
  const { executionStatus, isLoadingStatus } = state;

  return (
    <div className="space-y-6">
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
              <h4 className="mb-2 text-sm font-medium">Recent Executions</h4>
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
    </div>
  );
}
