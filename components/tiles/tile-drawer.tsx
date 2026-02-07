"use client";

import {
  Activity,
  ArrowRight,
  Braces,
  Loader2,
  Play,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/utils/format";
import type { TileWithSources } from "@/types/database";

import { useTileDrawerState } from "./tile-drawer/hooks/use-tile-drawer-state";
import { InputSection } from "./tile-drawer/sections/input-section";
import { OutputSection } from "./tile-drawer/sections/output-section";
import { ProcessingSection } from "./tile-drawer/sections/processing-section";
import { StatusSection } from "./tile-drawer/sections/status-section";
import { type DrawerSection, TILE_TYPE_LABELS } from "./tile-drawer/types";

interface TileDrawerProps {
  tile: TileWithSources | null;
  mosaicId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRunTile?: (tileId: string) => Promise<void>;
}

export function TileDrawer({
  tile,
  mosaicId,
  open,
  onOpenChange,
  onRunTile,
}: TileDrawerProps) {
  const state = useTileDrawerState({ tile, mosaicId, open });

  const handleRun = async () => {
    if (!tile) return;
    state.setIsRunning(true);
    try {
      if (onRunTile) {
        await onRunTile(tile.id);
      } else {
        const response = await fetch("/api/tiles/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tileId: tile.id }),
        });
        const data = await response.json();
        if (!response.ok) {
          alert(data.error || "Failed to run tile");
        }
      }
    } catch {
      alert("Failed to run tile");
    } finally {
      state.setIsRunning(false);
      state.refreshData();
    }
  };

  if (!tile) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="flex flex-row items-center justify-between border-b border-border px-6 pb-4">
          <DrawerTitle className="sr-only">{tile.name || "Tile Settings"}</DrawerTitle>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${tile.color}20` }}
            >
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: tile.color }}
              />
            </div>
            <div className="flex-1 min-w-0">
              {/* Editable name */}
              <div className="flex items-center gap-2">
                <Input
                  value={state.configState.name}
                  onChange={(e) =>
                    state.updateConfigField("name", e.target.value)
                  }
                  className="h-7 px-2 text-lg font-semibold border-transparent hover:border-border focus:border-primary bg-transparent"
                />
              </div>
              <DrawerDescription className="text-left">
                {TILE_TYPE_LABELS[tile.tile_type]} · Last run:{" "}
                {state.executionStatus?.lastJob
                  ? formatRelativeTime(state.executionStatus.lastJob.created_at)
                  : "Never"}
              </DrawerDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={state.saveConfig}
              disabled={state.isSaving}
              className="gap-2"
            >
              {state.isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRun}
              disabled={state.isRunning || !state.configState.isActive}
              className="gap-2"
            >
              {state.isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Run
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm">
                Close
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <Tabs
          value={state.activeSection}
          onValueChange={(v) => state.setActiveSection(v as DrawerSection)}
          className="flex-1"
        >
          <div className="border-b border-border px-6">
            <TabsList className="h-12 w-full justify-start gap-1 bg-transparent p-0">
              <TabsTrigger
                value="status"
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Activity className="h-4 w-4" />
                Status
              </TabsTrigger>
              <TabsTrigger
                value="input"
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-cyan-500 data-[state=active]:bg-transparent"
              >
                <ArrowRight className="h-4 w-4 text-cyan-400" />
                Input
              </TabsTrigger>
              <TabsTrigger
                value="processing"
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-purple-500 data-[state=active]:bg-transparent"
              >
                <Braces className="h-4 w-4 text-purple-400" />
                Processing
              </TabsTrigger>
              <TabsTrigger
                value="output"
                className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-green-500 data-[state=active]:bg-transparent"
              >
                <ArrowRight className="h-4 w-4 rotate-180 text-green-400" />
                Output
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="overflow-y-auto p-6 max-h-[60vh]">
            <TabsContent value="status" className="m-0">
              <StatusSection tile={tile} state={state} />
            </TabsContent>

            <TabsContent value="input" className="m-0">
              <InputSection tile={tile} mosaicId={mosaicId} state={state} />
            </TabsContent>

            <TabsContent value="processing" className="m-0">
              <ProcessingSection
                tile={tile}
                mosaicId={mosaicId}
                state={state}
              />
            </TabsContent>

            <TabsContent value="output" className="m-0">
              <OutputSection tile={tile} mosaicId={mosaicId} state={state} />
            </TabsContent>
          </div>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}
