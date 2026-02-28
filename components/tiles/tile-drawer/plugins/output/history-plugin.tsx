"use client";

import {
  Check,
  Copy,
  FileText,
  History,
  Loader2,
  Maximize2,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteTileJobResult,
  type TileJobResultSummary,
} from "@/lib/actions/tile-execution";
import { formatRelativeTime } from "@/lib/utils/format";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";
import { getContentString } from "../utils";

interface HistoryPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

function ResultContent({
  result,
  bordered,
}: {
  result: TileJobResultSummary;
  bordered?: boolean;
}) {
  const contentStr = getContentString(result);
  const wrapperClass = bordered
    ? "rounded-lg border border-border bg-muted/30 p-3 max-h-[300px] overflow-y-auto select-text"
    : "";

  if (result.format === "json") {
    return (
      <div className={wrapperClass}>
        <pre className="whitespace-pre-wrap break-words text-sm font-mono">
          <code>{contentStr}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className={`prose prose-sm prose-invert max-w-none ${wrapperClass}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{contentStr}</ReactMarkdown>
    </div>
  );
}

function SourceUrlList({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <p className="text-xs font-medium text-muted-foreground mb-2">Sources:</p>
      <div className="space-y-1">
        {urls.map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-cyan-400 hover:underline break-all"
          >
            {url}
          </a>
        ))}
      </div>
    </div>
  );
}

export function HistoryPlugin({ disabled, state }: HistoryPluginProps) {
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

  const [fullscreenResult, setFullscreenResult] =
    useState<TileJobResultSummary | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    if (!fullscreenResult) return;
    const text = getContentString(fullscreenResult);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
                        {result.source_urls?.length ?? 0} sources ·{" "}
                        {result.format}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {isExpanded ? "Collapse" : "Expand"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCopied(false);
                        setFullscreenResult(result);
                      }}
                      title="View fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
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
                    <ResultContent result={result} bordered />
                    <SourceUrlList urls={result.source_urls ?? []} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Dialog
        open={!!fullscreenResult}
        onOpenChange={(open) => {
          if (!open) setFullscreenResult(null);
        }}
      >
        {fullscreenResult && (
          <DialogContent
            className="max-w-4xl h-[85vh] flex flex-col p-0"
            hideClose
          >
            <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <DialogTitle className="text-sm font-medium">
                  {formatRelativeTime(fullscreenResult.created_at)}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {fullscreenResult.source_urls?.length ?? 0} sources ·{" "}
                    {fullscreenResult.format}
                  </span>
                </DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  className="gap-1.5"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copied ? "Copied" : "Copy all"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setFullscreenResult(null)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto p-6 select-text cursor-text">
              <ResultContent result={fullscreenResult} />
              <SourceUrlList urls={fullscreenResult.source_urls ?? []} />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </PluginCard>
  );
}
