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
