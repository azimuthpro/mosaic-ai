"use client";

import {
  ChevronDown,
  ChevronRight,
  GitCompareArrows,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { getCatalogDiffs } from "@/lib/actions/catalog";
import { formatRelativeTime } from "@/lib/utils/format";
import type { CatalogDiff, CatalogDiffPayload } from "@/types/database";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface CatalogDiffPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

type DiffEntry = CatalogDiffPayload["added_entries"][number];
type DiffUpdate = CatalogDiffPayload["updated_entries"][number];
type DiffEvent = CatalogDiffPayload["new_events"][number];

export function CatalogDiffPlugin({
  tile,
  disabled,
  state,
}: CatalogDiffPluginProps) {
  const { pluginState, updatePluginState } = state;

  const [diffs, setDiffs] = useState<CatalogDiff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    getCatalogDiffs(tile.id, 20).then((data) => {
      setDiffs(data);
      setIsLoading(false);
    });
  }, [tile.id]);

  return (
    <PluginCard
      id="catalog-diffs"
      title="Change History"
      description="Entity changes per execution"
      icon={<GitCompareArrows className="h-4 w-4 text-green-400" />}
      section="output"
      collapsed={pluginState["catalog-diffs"] ?? true}
      onCollapsedChange={(c) => updatePluginState("catalog-diffs", c)}
      badge={{
        text: `${diffs.length} runs`,
        variant: diffs.length > 0 ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : diffs.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No changes yet. Run the tile to see change history.
        </div>
      ) : (
        <div className="space-y-2">
          {diffs.map((diff) => {
            const isExpanded = expandedDiffId === diff.id;
            const added = (diff.added_entries || []) as unknown as DiffEntry[];
            const updated = (diff.updated_entries ||
              []) as unknown as DiffUpdate[];
            const events = (diff.new_events || []) as unknown as DiffEvent[];

            const hasChanges =
              added.length > 0 || updated.length > 0 || events.length > 0;

            return (
              <div
                key={diff.id}
                className="rounded-lg border border-border bg-muted/20 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedDiffId(isExpanded ? null : diff.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {formatRelativeTime(diff.created_at)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {added.length > 0 && (
                        <Badge className="text-xs bg-green-500/20 text-green-400">
                          +{added.length} new
                        </Badge>
                      )}
                      {updated.length > 0 && (
                        <Badge className="text-xs bg-amber-500/20 text-amber-400">
                          ~{updated.length} updated
                        </Badge>
                      )}
                      {events.length > 0 && (
                        <Badge className="text-xs bg-blue-500/20 text-blue-400">
                          {events.length} events
                        </Badge>
                      )}
                      {!hasChanges && (
                        <span className="text-xs text-muted-foreground">
                          No changes
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-4 space-y-3">
                    {/* Summary */}
                    {diff.summary && (
                      <p className="text-sm text-muted-foreground whitespace-pre-line">
                        {diff.summary}
                      </p>
                    )}

                    {/* New Entities */}
                    {added.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          New Entities
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {added.map((e, i) => {
                            const data = e.data as Record<
                              string,
                              unknown
                            > | null;
                            const name = (data?.name as string) || e.match_key;
                            return (
                              <Badge
                                key={i}
                                className="text-xs bg-green-500/20 text-green-400"
                              >
                                {name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Updated Entities */}
                    {updated.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          Updated Entities
                        </p>
                        <div className="space-y-1">
                          {updated.map((e, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Badge className="text-xs bg-amber-500/20 text-amber-400">
                                {e.id.substring(0, 8)}...
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {e.changed_fields.join(", ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* New Events */}
                    {events.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                          New Events
                        </p>
                        <div className="space-y-1">
                          {events.map((e, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Badge className="text-xs bg-blue-500/20 text-blue-400">
                                {e.event_type}
                              </Badge>
                              <span className="text-sm">
                                <span className="font-medium">
                                  {e.entry_name}
                                </span>
                                : {e.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PluginCard>
  );
}
