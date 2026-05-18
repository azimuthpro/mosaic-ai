"use client";

import {
  Activity,
  ArrowRight,
  Braces,
  Copy,
  Loader2,
  Pause,
  Play,
  Power,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { RunConfirmDialog } from "@/components/tiles/run-confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteTile, duplicateTile } from "@/lib/actions/tiles";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/format";
import type { TileWithSources } from "@/types/database";

import { useTileDrawerState } from "./tile-drawer/hooks/use-tile-drawer-state";
import { InputSection } from "./tile-drawer/sections/input-section";
import { OutputSection } from "./tile-drawer/sections/output-section";
import { ProcessingSection } from "./tile-drawer/sections/processing-section";
import { StatusSection } from "./tile-drawer/sections/status-section";
import { type DrawerSection, TILE_TYPE_LABELS } from "./tile-drawer/types";

interface TileDetailPageProps {
  tile: TileWithSources;
  mosaicId: string;
}

interface Tab {
  value: DrawerSection;
  label: string;
  icon: React.ElementType;
  color: string;
  borderColor: string;
}

const TABS: Tab[] = [
  {
    value: "status",
    label: "Status",
    icon: Activity,
    color: "text-amber-400",
    borderColor: "border-amber-500",
  },
  {
    value: "input",
    label: "Input",
    icon: ArrowRight,
    color: "text-cyan-400",
    borderColor: "border-cyan-500",
  },
  {
    value: "processing",
    label: "Processing",
    icon: Braces,
    color: "text-purple-400",
    borderColor: "border-purple-500",
  },
  {
    value: "output",
    label: "Output",
    icon: ArrowRight,
    color: "text-green-400",
    borderColor: "border-green-500",
  },
];

export function TileDetailPage({ tile, mosaicId }: TileDetailPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as DrawerSection) || "status";

  const state = useTileDrawerState({ tile, mosaicId, open: true });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRunConfirm, setShowRunConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Sync URL tab with drawer state so lazy-loading effects trigger correctly
  useEffect(() => {
    if (state.activeSection !== activeTab) {
      state.setActiveSection(activeTab);
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabChange(tab: DrawerSection) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "status") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    router.replace(
      `/mosaics/${mosaicId}/tiles/${tile.id}${qs ? `?${qs}` : ""}`,
    );
  }

  async function handleRun(
    debug: boolean,
    options?: { comment?: string },
  ): Promise<void> {
    state.setIsRunning(true);
    try {
      const body: Record<string, unknown> = { tileId: tile.id, debug };
      if (options?.comment) body.comment = options.comment;
      const response = await fetch("/api/tiles/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to run tile");
      }
    } catch {
      alert("Failed to run tile");
    } finally {
      state.setIsRunning(false);
      state.refreshData();
    }
  }

  async function handleDelete(): Promise<void> {
    setIsDeleting(true);
    try {
      const result = await deleteTile(tile.id);
      if (result.error) {
        alert(result.error);
      } else {
        router.push(`/mosaics/${mosaicId}`);
      }
    } catch {
      alert("Failed to delete tile");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDuplicate(): Promise<void> {
    setIsDuplicating(true);
    const result = await duplicateTile(tile.id);
    setIsDuplicating(false);
    if (result.error) {
      alert(result.error);
      return;
    }
    if (result.tileId) {
      router.push(`/mosaics/${mosaicId}/tiles/${result.tileId}`);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4">
        {/* Title row + actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${tile.color}20` }}
            >
              <div
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: tile.color }}
              />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-lg font-semibold truncate">
                {state.configState.name}
              </h1>
              <span className="shrink-0 text-xs text-muted-foreground">
                {TILE_TYPE_LABELS[tile.tile_type]}
                {" · "}
                Last run:{" "}
                {state.executionStatus?.lastJob
                  ? formatRelativeTime(state.executionStatus.lastJob.created_at)
                  : "Never"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {tile.tile_type !== "knowledge_base" && (
              <Button
                variant={state.configState.isActive ? "outline" : "secondary"}
                size="sm"
                onClick={state.handleToggleActive}
                title={
                  state.configState.isActive ? "Pause tile" : "Resume tile"
                }
              >
                {state.configState.isActive ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                {state.configState.isActive ? "Pause" : "Resume"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={state.saveConfig}
              disabled={state.isSaving}
            >
              {state.isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
            {tile.tile_type !== "knowledge_base" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRunConfirm(true)}
                disabled={state.isRunning || !state.configState.isActive}
              >
                {state.isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run
              </Button>
            )}
            <div className="mx-1 h-5 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDuplicate}
              disabled={isDuplicating}
              className="text-muted-foreground hover:text-foreground"
              title="Duplicate tile"
            >
              {isDuplicating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-muted-foreground hover:text-destructive"
              title="Delete tile"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-border px-6">
        <nav className="flex gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? `${tab.borderColor} text-foreground`
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    tab.color,
                    tab.value === "output" && "rotate-180",
                  )}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          {activeTab === "status" && (
            <StatusSection tile={tile} state={state} />
          )}
          {activeTab === "input" && (
            <InputSection tile={tile} mosaicId={mosaicId} state={state} />
          )}
          {activeTab === "processing" && (
            <ProcessingSection tile={tile} mosaicId={mosaicId} state={state} />
          )}
          {activeTab === "output" && (
            <OutputSection tile={tile} mosaicId={mosaicId} state={state} />
          )}
        </div>
      </div>

      {/* Run confirm dialog */}
      <RunConfirmDialog
        open={showRunConfirm}
        onOpenChange={setShowRunConfirm}
        tileName={tile.name}
        isRunning={state.isRunning}
        onConfirm={handleRun}
        commentMode={tile.tile_type === "offer_sender" ? "offer" : undefined}
      />

      {/* Delete confirm dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete tile</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{tile.name}&rdquo;? This
              will remove the tile, all its sources, connections, and execution
              history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
