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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createSkill, updateSkill } from "@/lib/actions/skills";
import type { Skill } from "@/types/database";

interface CreateSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill?: Skill | null;
  onSuccess: () => void;
}

interface CreateSkillFormProps {
  skill?: Skill | null;
  onSuccess: () => void;
  onCancel: () => void;
}

function CreateSkillForm({ skill, onSuccess, onCancel }: CreateSkillFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [prompt, setPrompt] = useState(skill?.prompt ?? "");
  const [isPublic, setIsPublic] = useState(skill?.is_public ?? false);

  const isEditing = Boolean(skill);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    formData.append("prompt", prompt);
    formData.append("category", "custom");
    formData.append("isPublic", String(isPublic));

    const result = skill
      ? await updateSkill(skill.id, formData)
      : await createSkill(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="skill-name">Name *</Label>
        <Input
          id="skill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Custom Skill"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-description">Description</Label>
        <Input
          id="skill-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this skill does"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill-prompt">Prompt *</Label>
        <Textarea
          id="skill-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter the instructions for this skill..."
          className="min-h-[150px]"
          required
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="skill-public">Share with Community</Label>
          <p className="text-xs text-muted-foreground">
            Make this skill available to other users
          </p>
        </div>
        <Switch
          id="skill-public"
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Save Changes" : "Create Skill"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateSkillDialog({
  open,
  onOpenChange,
  skill,
  onSuccess,
}: CreateSkillDialogProps) {
  const isEditing = Boolean(skill);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Skill" : "Create Custom Skill"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update your custom skill template."
              : "Create a reusable skill template for your agents."}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <CreateSkillForm
            key={skill?.id ?? "new"}
            skill={skill}
            onSuccess={onSuccess}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
