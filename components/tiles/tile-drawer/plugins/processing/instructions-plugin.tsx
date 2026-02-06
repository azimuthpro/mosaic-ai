"use client";

import { FileText } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface InstructionsPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

export function InstructionsPlugin({
  tile,
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
          <Label htmlFor="tile-instructions">Instructions for the AI</Label>
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
    </PluginCard>
  );
}
