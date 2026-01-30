"use client";

import { Copy, Edit2, Loader2, Lock, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  copySystemSkillToMosaic,
  deleteTileSkill,
  getTileSkills,
} from "@/lib/actions/tile-skills";
import { TILE_SKILL_CATEGORIES } from "@/lib/constants/tile-skills";
import { cn } from "@/lib/utils";
import type { TileSkill, TileSkillCategory, TileType } from "@/types/database";

interface TileSkillsGalleryProps {
  mosaicId: string;
  tileType: TileType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (prompt: string) => void;
  onEditSkill?: (skill: TileSkill) => void;
}

export function TileSkillsGallery({
  mosaicId,
  tileType,
  open,
  onOpenChange,
  onSelect,
  onEditSkill,
}: TileSkillsGalleryProps) {
  const [skills, setSkills] = useState<TileSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<
    TileSkillCategory | "all"
  >("all");

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    const data = await getTileSkills(mosaicId, tileType);
    setSkills(data);
    setIsLoading(false);
  }, [mosaicId, tileType]);

  // Load skills when dialog opens - this is a data fetch pattern
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadSkills();
    }
  }, [open, loadSkills]);

  const filteredSkills =
    selectedCategory === "all"
      ? skills
      : skills.filter((s) => s.category === selectedCategory);

  const systemSkills = filteredSkills.filter((s) => s.is_system);
  const customSkills = filteredSkills.filter((s) => !s.is_system);

  // Get categories that have skills
  const availableCategories = Array.from(
    new Set(skills.map((s) => s.category)),
  );

  async function handleUseSkill(skill: TileSkill) {
    onSelect(skill.prompt);
    onOpenChange(false);
  }

  async function handleCopySkill(skill: TileSkill) {
    setActionLoading(skill.id);
    const result = await copySystemSkillToMosaic(skill.id, mosaicId);
    if (result.success) {
      await loadSkills();
    }
    setActionLoading(null);
  }

  async function handleDeleteSkill(skill: TileSkill) {
    if (!confirm(`Delete "${skill.name}"? This cannot be undone.`)) {
      return;
    }
    setActionLoading(skill.id);
    const result = await deleteTileSkill(skill.id);
    if (result.success) {
      await loadSkills();
    }
    setActionLoading(null);
  }

  function handleEditSkill(skill: TileSkill) {
    if (onEditSkill) {
      onEditSkill(skill);
    }
  }

  const getCategoryLabel = (category: TileSkillCategory) => {
    const found = TILE_SKILL_CATEGORIES.find((c) => c.value === category);
    return found?.label || category;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Skills Library
          </DialogTitle>
          <DialogDescription>
            Choose a skill template to pre-fill your tile instructions.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs
            value={selectedCategory}
            onValueChange={(v) =>
              setSelectedCategory(v as TileSkillCategory | "all")
            }
            className="w-full"
          >
            <TabsList className="mb-4 h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="all" className="text-xs">
                All
              </TabsTrigger>
              {availableCategories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="text-xs"
                >
                  {getCategoryLabel(category)}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-0">
              <div className="max-h-[50vh] overflow-y-auto pr-2">
                {/* System Skills Section */}
                {systemSkills.length > 0 && (
                  <div className="mb-6">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      System Templates
                    </h4>
                    <div className="space-y-3">
                      {systemSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          isLoading={actionLoading === skill.id}
                          onUse={() => handleUseSkill(skill)}
                          onCopy={() => handleCopySkill(skill)}
                          getCategoryLabel={getCategoryLabel}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Skills Section */}
                {customSkills.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                      Custom Skills
                    </h4>
                    <div className="space-y-3">
                      {customSkills.map((skill) => (
                        <SkillCard
                          key={skill.id}
                          skill={skill}
                          isLoading={actionLoading === skill.id}
                          onUse={() => handleUseSkill(skill)}
                          onEdit={() => handleEditSkill(skill)}
                          onDelete={() => handleDeleteSkill(skill)}
                          getCategoryLabel={getCategoryLabel}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredSkills.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    No skills available for this category.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SkillCardProps {
  skill: TileSkill;
  isLoading: boolean;
  onUse: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  getCategoryLabel: (category: TileSkillCategory) => string;
}

function SkillCard({
  skill,
  isLoading,
  onUse,
  onCopy,
  onEdit,
  onDelete,
  getCategoryLabel,
}: SkillCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50",
        isLoading && "opacity-50",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h5 className="font-medium leading-tight">{skill.name}</h5>
          {skill.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {skill.description}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {getCategoryLabel(skill.category)}
        </Badge>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          onClick={onUse}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          Use Skill
        </Button>

        {skill.is_system ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onCopy}
            disabled={isLoading}
            className="h-7 text-xs"
            title="Copy & Customize"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className="ml-1 hidden sm:inline">Customize</span>
          </Button>
        ) : (
          <>
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={onEdit}
                disabled={isLoading}
                className="h-7 text-xs"
                title="Edit"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={onDelete}
                disabled={isLoading}
                className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                title="Delete"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
