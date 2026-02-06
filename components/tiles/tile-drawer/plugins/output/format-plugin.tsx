"use client";

import { Braces } from "lucide-react";

import { ZodSchemaEditor } from "@/components/tiles/zod-schema-editor";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OutputFormat } from "@/types/database";

import type { TileDrawerState } from "../../hooks/use-tile-drawer-state";
import type { PluginBaseProps } from "../../types";
import { PluginCard } from "../plugin-card";

interface FormatPluginProps extends PluginBaseProps {
  state: TileDrawerState;
}

export function FormatPlugin({ tile, disabled, state }: FormatPluginProps) {
  const {
    configState,
    updateConfigField,
    isSaving,
    pluginState,
    updatePluginState,
  } = state;

  const formatLabel = configState.outputFormat === "json" ? "JSON" : "Text";

  return (
    <PluginCard
      id="format"
      title="Output Format"
      description="Configure result structure"
      icon={<Braces className="h-4 w-4 text-green-400" />}
      section="output"
      collapsed={pluginState["format"] ?? false}
      onCollapsedChange={(collapsed) => updatePluginState("format", collapsed)}
      badge={{
        text: formatLabel,
        variant: "secondary",
      }}
      disabled={disabled}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Output Format</Label>
          <Select
            value={configState.outputFormat}
            onValueChange={(v) =>
              updateConfigField("outputFormat", v as OutputFormat)
            }
            disabled={isSaving || disabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Text (Markdown)</SelectItem>
              <SelectItem value="json">JSON (Structured)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {configState.outputFormat === "text"
              ? "AI generates markdown text, displayed as rendered content"
              : "AI generates structured JSON, displayed as a code block"}
          </p>
        </div>

        {configState.outputFormat === "json" && (
          <ZodSchemaEditor
            value={configState.outputSchema}
            onChange={(v) => updateConfigField("outputSchema", v)}
            disabled={isSaving || disabled}
          />
        )}
      </div>
    </PluginCard>
  );
}
