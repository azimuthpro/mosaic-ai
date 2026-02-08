"use client";

import { Loader2 } from "lucide-react";

import type { TileWithSources } from "@/types/database";

import type { TileDrawerState } from "../hooks/use-tile-drawer-state";
import { CurrentRunPlugin } from "../plugins/status/current-run-plugin";
import { LastResultPreviewPlugin } from "../plugins/status/last-result-preview-plugin";
import { QuickStatsPlugin } from "../plugins/status/quick-stats-plugin";
import { RecentExecutionsPlugin } from "../plugins/status/recent-executions-plugin";

interface StatusSectionProps {
  tile: TileWithSources;
  state: TileDrawerState;
}

export function StatusSection({ tile, state }: StatusSectionProps) {
  const { isLoadingStatus } = state;

  return (
    <div className="space-y-4">
      {/* Section header with accent */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-amber-500" />
        <span>Status plugins show tile health and execution history</span>
      </div>

      {isLoadingStatus ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          <CurrentRunPlugin state={state} />
          <QuickStatsPlugin tile={tile} state={state} />
          <RecentExecutionsPlugin state={state} />
          <LastResultPreviewPlugin state={state} />
        </div>
      )}
    </div>
  );
}
