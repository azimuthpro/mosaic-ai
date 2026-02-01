"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createTileSkill, updateTileSkill } from "@/lib/actions/tile-skills";
import { TILE_SKILL_CATEGORIES } from "@/lib/constants/tile-skills";
import type { TileSkill, TileSkillCategory, TileType } from "@/types/database";

interface CreateTileSkillDialogProps {
  mosaicId: string;
  tileType: TileType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editingSkill?: TileSkill | null;
}

export function CreateTileSkillDialog({
  mosaicId,
  tileType,
  open,
  onOpenChange,
  onSuccess,
  editingSkill,
}: CreateTileSkillDialogProps) {
  const isEditing = !!editingSkill;

  // Initialize state from editing skill or empty values
  const initialName = editingSkill?.name ?? "";
  const initialPrompt = editingSkill?.prompt ?? "";
  const initialCategory = editingSkill?.category ?? "custom";

  const [name, setName] = useState(initialName);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [category, setCategory] = useState<TileSkillCategory>(initialCategory);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when editingSkill changes (dialog opens with different skill)
  if (editingSkill && name !== editingSkill.name && !isLoading) {
    setName(editingSkill.name);
    setPrompt(editingSkill.prompt);
    setCategory(editingSkill.category);
    setError(null);
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      // Reset form when closing
      setName("");
      setPrompt("");
      setCategory("custom");
      setError(null);
    }
    onOpenChange(newOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      setIsLoading(false);
      return;
    }

    if (!prompt.trim()) {
      setError("Instructions are required");
      setIsLoading(false);
      return;
    }

    let result;

    if (isEditing && editingSkill) {
      result = await updateTileSkill(editingSkill.id, {
        name: name.trim(),
        prompt: prompt.trim(),
        category,
      });
    } else {
      result = await createTileSkill({
        mosaicId,
        tileType,
        name: name.trim(),
        prompt: prompt.trim(),
        category,
      });
    }

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      handleOpenChange(false);
      onSuccess?.();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Skill" : "Create Custom Skill"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your custom skill template."
              : "Create a reusable skill template for your tiles."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="skill-name">Name</Label>
              <Input
                id="skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Custom Analyzer"
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as TileSkillCategory)}
                disabled={isLoading}
              >
                <SelectTrigger id="skill-category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {TILE_SKILL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="skill-prompt">Instructions</Label>
              <Textarea
                id="skill-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter the AI instructions for this skill..."
                rows={8}
                required
                disabled={isLoading}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Write detailed instructions for the AI to follow when processing
                data.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Skill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
