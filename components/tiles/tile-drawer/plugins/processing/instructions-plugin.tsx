"use client";

import {
  AlertTriangle,
  Check,
  Copy,
  FileText,
  Loader2,
  Maximize2,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface InstructionsPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function InstructionsPlugin({
  disabled,
  state,
}: InstructionsPluginProps) {
  const {
    configState,
    updateConfigField,
    isSaving,
    pluginState,
    updatePluginState,
  } = state;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // AI Improvement state
  const [improvementInstructions, setImprovementInstructions] = useState("");
  const [isImproving, setIsImproving] = useState(false);
  const [improvementError, setImprovementError] = useState<string | null>(null);

  // Preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [suggestedPrompt, setSuggestedPrompt] = useState<string | null>(null);

  // Single undo state
  const [previousPrompt, setPreviousPrompt] = useState<string | null>(null);

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(configState.instructions);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleImprovePrompt = async () => {
    setIsImproving(true);
    setImprovementError(null);

    try {
      const response = await fetch("/api/ai/improve-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPrompt: configState.instructions,
          improvementInstructions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to improve prompt");
      }

      const result = await response.json();
      setSuggestedPrompt(result.improvedPrompt);
      setShowPreviewModal(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setImprovementError(message);
    } finally {
      setIsImproving(false);
    }
  };

  const handleApplyImprovement = () => {
    if (suggestedPrompt) {
      setPreviousPrompt(configState.instructions);
      updateConfigField("instructions", suggestedPrompt);
      setShowPreviewModal(false);
      setSuggestedPrompt(null);
      setImprovementInstructions("");
      setImprovementError(null);
    }
  };

  const handleRestorePrevious = () => {
    if (previousPrompt) {
      updateConfigField("instructions", previousPrompt);
      setPreviousPrompt(null);
    }
  };

  const handleDiscardImprovement = () => {
    setShowPreviewModal(false);
    setSuggestedPrompt(null);
  };

  const hasInstructions = configState.instructions.trim().length > 0;
  const wordCount = countWords(configState.instructions);

  const canImprove =
    improvementInstructions.trim() &&
    configState.instructions.trim() &&
    !isImproving &&
    !isSaving &&
    !disabled;

  return (
    <PluginCard
      id="instructions"
      title="Instructions"
      description="AI processing prompt"
      icon={<FileText className="h-4 w-4 text-purple-400" />}
      section="processing"
      collapsed={pluginState["instructions"] ?? false}
      onCollapsedChange={(collapsed) =>
        updatePluginState("instructions", collapsed)
      }
      badge={{
        text: hasInstructions ? `${wordCount} words` : "Empty",
        variant: hasInstructions ? "secondary" : "outline",
      }}
      disabled={disabled}
    >
      <div className="space-y-3">
        {/* AI Prompt Improvement Section */}
        <div className="space-y-2 p-3 border border-purple-500/20 bg-purple-500/5 rounded-lg">
          <Label htmlFor="improvement-instructions" className="text-xs">
            AI Prompt Improvement
          </Label>
          <Textarea
            id="improvement-instructions"
            value={improvementInstructions}
            onChange={(e) => setImprovementInstructions(e.target.value)}
            placeholder="Tell the AI how to improve your prompt... (e.g., 'make it more concise', 'add examples', 'focus on extracting insights')"
            rows={3}
            className="text-sm resize-none"
            disabled={isSaving || disabled || isImproving}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10"
                onClick={handleImprovePrompt}
                disabled={!canImprove}
              >
                {isImproving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Improving...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                    Improve Prompt
                  </>
                )}
              </Button>
              {previousPrompt && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleRestorePrevious}
                  disabled={isSaving || disabled}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Restore Previous
                </Button>
              )}
            </div>
          </div>
          {improvementError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{improvementError}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tile-instructions">Instructions for the AI</Label>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => setIsFullscreen(true)}
            >
              <Maximize2 className="h-3 w-3" />
              Expand
            </Button>
          </div>
          <Textarea
            id="tile-instructions"
            value={configState.instructions}
            onChange={(e) => updateConfigField("instructions", e.target.value)}
            placeholder="Instructions for the AI...

Example: Summarize the key points from the content, focusing on:
- Main topics and themes
- Important facts and figures
- Actionable insights"
            rows={8}
            className="font-mono text-sm"
            disabled={isSaving || disabled}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          These instructions guide how the AI processes and analyzes the content
          from your sources. Be specific about what you want extracted or
          summarized.
        </p>
      </div>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent
          className="max-w-4xl h-[85vh] flex flex-col p-0"
          hideClose
        >
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <DialogTitle className="text-sm font-medium">
                Instructions
                {hasInstructions && (
                  <Badge
                    variant="secondary"
                    className="ml-2 text-xs font-normal"
                  >
                    {wordCount} words
                  </Badge>
                )}
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
                onClick={() => setIsFullscreen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-6 pt-4">
            <Textarea
              value={configState.instructions}
              onChange={(e) =>
                updateConfigField("instructions", e.target.value)
              }
              placeholder="Instructions for the AI..."
              className="font-mono text-sm h-full resize-none"
              disabled={isSaving || disabled}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal for Prompt Comparison */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="text-sm font-medium">
              Preview Improved Prompt
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleDiscardImprovement}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-6 pt-4 grid grid-cols-2 gap-4">
            {/* Original Prompt */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Original Prompt</Label>
                {hasInstructions && (
                  <Badge variant="secondary" className="text-xs">
                    {wordCount} words
                  </Badge>
                )}
              </div>
              <Textarea
                value={configState.instructions}
                readOnly
                className="font-mono text-sm h-full resize-none bg-muted/30"
              />
            </div>

            {/* Suggested Prompt */}
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium text-purple-400">
                  Suggested Prompt
                </Label>
                {suggestedPrompt && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-purple-500/20 text-purple-300"
                  >
                    {countWords(suggestedPrompt)} words
                  </Badge>
                )}
              </div>
              <Textarea
                value={suggestedPrompt || ""}
                readOnly
                className="font-mono text-sm h-full resize-none border-purple-500/30 bg-purple-500/5"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscardImprovement}
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={handleApplyImprovement}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700"
            >
              <Check className="h-4 w-4" />
              Apply Improvement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PluginCard>
  );
}
