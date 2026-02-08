"use client";

import { ArrowRight, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import { PluginCard } from "../plugin-card";
import { getContentString } from "../utils";

interface LastResultPreviewPluginProps {
  state: TileDrawerState;
}

export function LastResultPreviewPlugin({
  state,
}: LastResultPreviewPluginProps) {
  const { executionStatus, pluginState, updatePluginState } = state;
  const lastResult = executionStatus?.lastResult;

  if (!lastResult) return null;

  const contentStr = getContentString(lastResult);
  const sourceUrls = lastResult.source_urls ?? [];

  return (
    <PluginCard
      id="last-result-preview"
      title="Last Result"
      description="Preview of latest output"
      icon={<FileText className="h-4 w-4 text-amber-400" />}
      section="status"
      collapsed={pluginState["last-result-preview"] ?? true}
      onCollapsedChange={(collapsed) =>
        updatePluginState("last-result-preview", collapsed)
      }
      badge={{
        text: lastResult.format,
        variant: "outline",
      }}
    >
      <div className="space-y-3">
        {/* Truncated content preview */}
        <div className="relative max-h-24 overflow-hidden rounded-md border border-border bg-muted/20 p-3">
          <pre className="whitespace-pre-wrap break-words text-xs font-mono text-muted-foreground">
            {contentStr.slice(0, 500)}
          </pre>
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-muted/80 to-transparent" />
        </div>

        {/* Source URLs count */}
        {sourceUrls.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {sourceUrls.length} source{sourceUrls.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        )}

        {/* View in Output button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => state.setActiveSection("output")}
        >
          View in Output
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </PluginCard>
  );
}
