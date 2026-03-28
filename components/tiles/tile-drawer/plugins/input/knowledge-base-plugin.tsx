"use client";

import { BookOpen, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveKnowledgeBaseContent } from "@/lib/actions/tiles";
import type { KnowledgeBaseConfig, TileWithSources } from "@/types/database";

import { PluginCard } from "../plugin-card";

interface KnowledgeBasePluginProps {
  tile: TileWithSources;
  disabled?: boolean;
}

export function KnowledgeBasePlugin({
  tile,
  disabled,
}: KnowledgeBasePluginProps) {
  const config = tile.config as KnowledgeBaseConfig | null;
  const savedContent = config?.content ?? "";
  const [content, setContent] = useState(savedContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setContent(savedContent);
    setIsDirty(false);
  }, [savedContent]);

  function handleChange(value: string) {
    setContent(value);
    setIsDirty(value !== savedContent);
  }

  async function handleSave() {
    setIsSaving(true);
    const result = await saveKnowledgeBaseContent(tile.id, content);
    setIsSaving(false);
    if (result.error) {
      alert(result.error);
    } else {
      setIsDirty(false);
    }
  }

  return (
    <PluginCard
      id="knowledge-base-content"
      title="Content"
      description="Text content available to connected tiles"
      icon={<BookOpen className="h-4 w-4 text-cyan-400" />}
      section="input"
    >
      <div className="space-y-3">
        <Textarea
          placeholder="Paste or type knowledge base content..."
          rows={12}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled || isSaving}
          className="font-mono text-sm"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {content.length.toLocaleString()} characters
          </p>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={disabled || isSaving || !isDirty}
          >
            {isSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isSaving ? "Saving..." : "Save Content"}
          </Button>
        </div>
      </div>
    </PluginCard>
  );
}
