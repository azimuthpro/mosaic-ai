"use client";

import type { TileWithSources } from "@/types/database";

import type { TileDrawerState } from "../hooks/use-tile-drawer-state";
import { CatalogBrowserPlugin } from "../plugins/output/catalog-browser-plugin";
import { CatalogDiffPlugin } from "../plugins/output/catalog-diff-plugin";
import { FormatPlugin } from "../plugins/output/format-plugin";
import { HistoryPlugin } from "../plugins/output/history-plugin";
import { SheetsOutputPlugin } from "../plugins/output/sheets-output-plugin";
import { SlackOutputPlugin } from "../plugins/output/slack-output-plugin";
import { WebhooksPlugin } from "../plugins/output/webhooks-plugin";

interface OutputSectionProps {
  tile: TileWithSources;
  mosaicId: string;
  state: TileDrawerState;
  disabled?: boolean;
}

export function OutputSection({
  tile,
  mosaicId,
  state,
  disabled,
}: OutputSectionProps) {
  const isCatalog = tile.tile_type === "catalog";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {isCatalog ? (
          <>
            <CatalogBrowserPlugin
              tile={tile}
              mosaicId={mosaicId}
              state={state}
              disabled={disabled}
            />
            <CatalogDiffPlugin
              tile={tile}
              mosaicId={mosaicId}
              state={state}
              disabled={disabled}
            />
            <SheetsOutputPlugin
              tile={tile}
              mosaicId={mosaicId}
              state={state}
              disabled={disabled}
            />
          </>
        ) : (
          <>
            <HistoryPlugin
              tile={tile}
              mosaicId={mosaicId}
              state={state}
              disabled={disabled}
            />
            <FormatPlugin
              tile={tile}
              mosaicId={mosaicId}
              state={state}
              disabled={disabled}
            />
          </>
        )}

        <WebhooksPlugin
          tile={tile}
          mosaicId={mosaicId}
          state={state}
          disabled={disabled}
        />

        <SlackOutputPlugin
          tile={tile}
          mosaicId={mosaicId}
          state={state}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
