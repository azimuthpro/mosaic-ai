"use client";

import type { TileWithSources } from "@/types/database";

import type { TileDrawerState } from "../hooks/use-tile-drawer-state";
import { InstructionsPlugin } from "../plugins/processing/instructions-plugin";

interface ProcessingSectionProps {
  tile: TileWithSources;
  mosaicId: string;
  state: TileDrawerState;
  disabled?: boolean;
}

export function ProcessingSection({
  tile,
  mosaicId,
  state,
  disabled,
}: ProcessingSectionProps) {
  return (
    <div className="space-y-4">
      {/* Section header with accent */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-purple-500" />
        <span>Processing plugins control how data is analyzed</span>
      </div>

      {/* Plugins */}
      <div className="space-y-3">
        <InstructionsPlugin
          tile={tile}
          mosaicId={mosaicId}
          state={state}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
