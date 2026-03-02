"use client";

import type { TileWithSources } from "@/types/database";

import type { TileDrawerState } from "../hooks/use-tile-drawer-state";
import { ApiTriggerPlugin } from "../plugins/input/api-trigger-plugin";
import { SchedulerPlugin } from "../plugins/input/scheduler-plugin";
import { SourcesPlugin } from "../plugins/input/sources-plugin";

interface InputSectionProps {
  tile: TileWithSources;
  mosaicId: string;
  state: TileDrawerState;
  disabled?: boolean;
}

export function InputSection({
  tile,
  mosaicId,
  state,
  disabled,
}: InputSectionProps) {
  return (
    <div className="space-y-4">
      {/* Plugins */}
      <div className="space-y-3">
        <SourcesPlugin
          tile={tile}
          mosaicId={mosaicId}
          state={state}
          disabled={disabled}
        />

        <SchedulerPlugin
          tile={tile}
          mosaicId={mosaicId}
          state={state}
          disabled={disabled}
        />

        <ApiTriggerPlugin
          tile={tile}
          mosaicId={mosaicId}
          state={state}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
