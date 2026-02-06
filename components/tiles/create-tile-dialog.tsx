"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { SkillSelector } from "@/components/tiles/skill-selector";
import { TileSelector } from "@/components/tiles/tile-selector";
import { TileTypePicker } from "@/components/tiles/tile-type-picker";
import {
  getTriggerCron,
  type TriggerOption,
  TriggerSelector,
} from "@/components/tiles/trigger-selector";
import { UrlListInput } from "@/components/tiles/url-list-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createTile, createTileConnection } from "@/lib/actions/tiles";
import { TILE_TYPE_CONFIGS, type TileType } from "@/types/database";

interface CreateTileDialogProps {
  mosaicId: string;
  /** Grid X position for the new tile */
  gridX?: number;
  /** Grid Y position for the new tile */
  gridY?: number;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** If true, don't render the trigger button */
  hideTrigger?: boolean;
}

type Step = "type" | "config";

interface SelectedSkill {
  id: string;
  name: string;
  prompt: string;
}

export function CreateTileDialog({
  mosaicId,
  gridX,
  gridY,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: CreateTileDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<TileType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [urls, setUrls] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDepth, setSearchDepth] = useState<"basic" | "advanced">("basic");
  const [inputTileIds, setInputTileIds] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SelectedSkill | null>(
    null,
  );
  const [customInstructions, setCustomInstructions] = useState("");
  const [trigger, setTrigger] = useState<TriggerOption>("manual");

  const resetState = () => {
    setStep("type");
    setSelectedType(null);
    setError(null);
    setUrls([]);
    setSearchQuery("");
    setSearchDepth("basic");
    setInputTileIds([]);
    setSelectedSkill(null);
    setCustomInstructions("");
    setTrigger("manual");
  };

  const handleTypeSelect = (type: TileType) => {
    setSelectedType(type);
    setStep("config");
  };

  const handleSkillSelect = (skill: SelectedSkill | null) => {
    setSelectedSkill(skill);
    if (skill) {
      setCustomInstructions(skill.prompt);
    }
  };

  function getTileName(): string {
    if (selectedSkill) return selectedSkill.name;
    if (selectedType) return TILE_TYPE_CONFIGS[selectedType].label;
    return "New Tile";
  }

  function canSubmit(): boolean {
    if (!selectedType) return false;

    switch (selectedType) {
      case "url_reader":
        return urls.length > 0;
      case "web_search":
        return searchQuery.trim().length > 0;
      case "recursive":
      case "analyzer":
        return inputTileIds.length > 0;
      default:
        return false;
    }
  }

  function getValidationMessage(): string | null {
    if (!selectedType) return null;

    switch (selectedType) {
      case "url_reader":
        return urls.length === 0 ? "Add at least one URL" : null;
      case "web_search":
        return !searchQuery.trim() ? "Enter a search query" : null;
      case "recursive":
      case "analyzer":
        return inputTileIds.length === 0
          ? "Select at least one input tile"
          : null;
      default:
        return null;
    }
  }

  async function handleSubmit() {
    if (!selectedType || !canSubmit()) return;

    setIsLoading(true);
    setError(null);

    const config = TILE_TYPE_CONFIGS[selectedType];
    const tileName = getTileName();

    // Build sources based on tile type
    const sources: {
      url?: string;
      name?: string;
      type?: "url" | "web_search";
      config?: { query: string; search_depth?: "basic" | "advanced" };
    }[] = [];

    switch (selectedType) {
      case "url_reader":
        urls.forEach((url, index) => {
          sources.push({
            url,
            name: `Source ${index + 1}`,
            type: "url",
          });
        });
        break;
      case "web_search":
        sources.push({
          type: "web_search",
          name: "Web Search",
          config: {
            query: searchQuery,
            search_depth: searchDepth,
          },
        });
        break;
    }

    const result = await createTile({
      mosaicId,
      name: tileName,
      description: selectedSkill?.name
        ? `Using skill: ${selectedSkill.name}`
        : undefined,
      tileType: selectedType,
      color: config.color,
      pattern: config.pattern,
      systemPrompt: customInstructions || undefined,
      scheduleCron: getTriggerCron(trigger) || undefined,
      sources: sources.length > 0 ? sources : undefined,
      connections:
        selectedType === "recursive" || selectedType === "analyzer"
          ? inputTileIds
          : undefined,
      gridX,
      gridY,
    });

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setOpen(false);
    resetState();
    setIsLoading(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) resetState();
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Tile
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[500px]">
        {step === "type" ? (
          <>
            <DialogHeader>
              <DialogTitle>Choose Tile Type</DialogTitle>
              <DialogDescription>
                Select what kind of intelligence gathering this tile will
                perform.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <TileTypePicker onSelect={handleTypeSelect} />
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Configure{" "}
                {selectedType && TILE_TYPE_CONFIGS[selectedType].label}
              </DialogTitle>
              <DialogDescription>
                Set up your tile with data sources and processing instructions.
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] overflow-y-auto">
              <div className="space-y-6 py-4 pr-2">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Type-specific configuration */}
                {selectedType === "url_reader" && (
                  <UrlListInput
                    urls={urls}
                    onChange={setUrls}
                    disabled={isLoading}
                  />
                )}

                {selectedType === "web_search" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="searchQuery">Search Query</Label>
                      <Input
                        id="searchQuery"
                        placeholder="e.g., latest AI news this week"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">
                        The AI will search the web and analyze results based on
                        this query.
                      </p>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <Label htmlFor="searchDepth">Deep Search</Label>
                        <p className="text-xs text-muted-foreground">
                          Search more sources for comprehensive results
                        </p>
                      </div>
                      <Switch
                        id="searchDepth"
                        checked={searchDepth === "advanced"}
                        onCheckedChange={(checked) =>
                          setSearchDepth(checked ? "advanced" : "basic")
                        }
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                {(selectedType === "recursive" ||
                  selectedType === "analyzer") && (
                  <TileSelector
                    mosaicId={mosaicId}
                    selectedTileIds={inputTileIds}
                    onChange={setInputTileIds}
                    disabled={isLoading}
                    label={
                      selectedType === "recursive"
                        ? "Input Tiles (Pipeline)"
                        : "Tiles to Analyze"
                    }
                  />
                )}

                {/* Skill Selector */}
                {selectedType && (
                  <SkillSelector
                    mosaicId={mosaicId}
                    tileType={selectedType}
                    selectedSkillId={selectedSkill?.id || null}
                    onSelect={handleSkillSelect}
                    disabled={isLoading}
                  />
                )}

                {/* Custom Instructions (editable prompt) */}
                <div className="space-y-2">
                  <Label htmlFor="instructions">
                    {selectedSkill
                      ? "Instructions (from skill)"
                      : "Instructions"}
                  </Label>
                  <Textarea
                    id="instructions"
                    placeholder="Tell the AI how to process the data..."
                    rows={4}
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedSkill
                      ? "You can customize the skill instructions above."
                      : "Tell the AI how to process and analyze the collected data."}
                  </p>
                </div>

                {/* Trigger Selector */}
                <TriggerSelector
                  value={trigger}
                  onChange={setTrigger}
                  disabled={isLoading}
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {getValidationMessage() && (
                <p className="mr-auto text-sm text-muted-foreground">
                  {getValidationMessage()}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("type")}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isLoading || !canSubmit()}
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Tile
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
