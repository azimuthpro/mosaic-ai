"use client";

import { FileText, History, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteTileJobResult } from "@/lib/actions/tile-execution";
import { formatRelativeTime } from "@/lib/utils/format";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface HistoryPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

export function HistoryPlugin({ tile, disabled, state }: HistoryPluginProps) {
  const {
    jobResults,
    setJobResults,
    isLoadingJobResults,
    expandedResultId,
    setExpandedResultId,
    deletingResultId,
    setDeletingResultId,
    pluginState,
    updatePluginState,
  } = state;

  const handleDeleteJobResult = async (resultId: string) => {
    if (!confirm("Are you sure you want to delete this job result?")) return;

    setDeletingResultId(resultId);
    try {
      const result = await deleteTileJobResult(resultId);
      if (result.error) {
        alert(result.error);
      } else {
        setJobResults((prev) => prev.filter((r) => r.id !== resultId));
        if (expandedResultId === resultId) {
          setExpandedResultId(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete job result:", error);
      alert("Failed to delete job result");
    } finally {
      setDeletingResultId(null);
    }
  };

  return (
    <PluginCard
      id="history"
      title="Job History"
      description="Previous execution results"
      icon={<History className="h-4 w-4 text-green-400" />}
      section="output"
      collapsed={pluginState["history"] ?? false}
      onCollapsedChange={(collapsed) => updatePluginState("history", collapsed)}
      badge={{
        text: `${jobResults.length} jobs`,
        variant: jobResults.length > 0 ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      {isLoadingJobResults ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : jobResults.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          No jobs yet. Run the tile to see execution history.
        </div>
      ) : (
        <div className="space-y-3">
          {jobResults.map((result) => {
            const isExpanded = expandedResultId === result.id;
            const contentObj = result.content as { text?: string } | null;
            const contentStr =
              result.format === "text" && contentObj?.text
                ? contentObj.text
                : typeof result.content === "string"
                  ? result.content
                  : JSON.stringify(result.content, null, 2);

            return (
              <div
                key={result.id}
                className="rounded-lg border border-border bg-muted/20 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() =>
                      setExpandedResultId(isExpanded ? null : result.id)
                    }
                    className="flex-1 flex items-center gap-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {formatRelativeTime(result.created_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.source_urls?.length || 0} sources ·{" "}
                        {result.format}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {isExpanded ? "Collapse" : "Expand"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJobResult(result.id);
                      }}
                      disabled={deletingResultId === result.id}
                    >
                      {deletingResultId === result.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border p-4">
                    {result.format === "json" ? (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-[300px] overflow-y-auto">
                        <pre className="whitespace-pre-wrap break-words text-sm font-mono">
                          <code>{contentStr}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="prose prose-sm prose-invert max-w-none rounded-lg border border-border bg-muted/30 p-3 max-h-[300px] overflow-y-auto">
                        <ReactMarkdown>{contentStr}</ReactMarkdown>
                      </div>
                    )}
                    {result.source_urls && result.source_urls.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Sources:
                        </p>
                        <div className="space-y-1">
                          {result.source_urls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-cyan-400 hover:underline truncate"
                            >
                              {url}
                            </a>
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
