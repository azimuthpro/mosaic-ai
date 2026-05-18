"use client";

import type { TileWithSources } from "@/types/database";

import type { TileDrawerState } from "../hooks/use-tile-drawer-state";
import { ApiTriggerPlugin } from "../plugins/input/api-trigger-plugin";
import { GitHubReposPlugin } from "../plugins/input/github-repos-plugin";
import { KnowledgeBasePlugin } from "../plugins/input/knowledge-base-plugin";
import { OfferSenderConfigPlugin } from "../plugins/input/offer-sender-config-plugin";
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
  if (tile.tile_type === "knowledge_base") {
    return (
      <div className="space-y-3">
        <KnowledgeBasePlugin tile={tile} disabled={disabled} />
      </div>
    );
  }

  // Offer Sender doesn't use scraped sources or a schedule — its inputs are
  // the configured HTML template plus a comment / Slack thread at run time.
  if (tile.tile_type === "offer_sender") {
    return (
      <div className="space-y-3">
        <OfferSenderConfigPlugin tile={tile} disabled={disabled} />
        <ApiTriggerPlugin
          tile={tile}
          mosaicId={mosaicId}
          state={state}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tile.tile_type === "github_issue" && (
        <GitHubReposPlugin tile={tile} disabled={disabled} />
      )}

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
  );
}
