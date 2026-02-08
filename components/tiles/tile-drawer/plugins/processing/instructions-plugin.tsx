"use client";

import { Check, Copy, FileText, Maximize2, X } from "lucide-react";
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

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(configState.instructions);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasInstructions = configState.instructions.trim().length > 0;
  const wordCount = configState.instructions
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

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
    </PluginCard>
  );
}
