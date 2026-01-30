"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTileSkills } from "@/lib/actions/tile-skills";
import {
  DEFAULT_TILE_SKILLS,
  type DefaultTileSkill,
  TILE_SKILL_CATEGORIES,
} from "@/lib/constants/tile-skills";
import type { TileSkill, TileType } from "@/types/database";

interface SkillSelectorProps {
  mosaicId: string;
  tileType: TileType;
  selectedSkillId: string | null;
  onSelect: (
    skill: { id: string; name: string; prompt: string } | null,
  ) => void;
  disabled?: boolean;
}

type SkillOption =
  | (DefaultTileSkill & { source: "default" })
  | (TileSkill & { source: "custom" });

export function SkillSelector({
  mosaicId,
  tileType,
  selectedSkillId,
  onSelect,
  disabled,
}: SkillSelectorProps) {
  const [customSkills, setCustomSkills] = useState<TileSkill[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    const data = await getTileSkills(mosaicId, tileType);
    // Filter to only custom skills (non-system)
    setCustomSkills(data.filter((s) => !s.is_system));
    setIsLoading(false);
  }, [mosaicId, tileType]);

  // Load skills when component mounts - this is a data fetch pattern
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSkills();
  }, [loadSkills]);

  // Combine default and custom skills
  const defaultSkills = DEFAULT_TILE_SKILLS[tileType] || [];
  const allSkills: SkillOption[] = [
    ...defaultSkills.map((s) => ({ ...s, source: "default" as const })),
    ...customSkills.map((s) => ({ ...s, source: "custom" as const })),
  ];

  // Group skills by category
  const skillsByCategory = TILE_SKILL_CATEGORIES.filter((cat) =>
    allSkills.some((s) => s.category === cat.value),
  ).map((cat) => ({
    ...cat,
    skills: allSkills.filter((s) => s.category === cat.value),
  }));

  const selectedSkill = allSkills.find((s) => s.id === selectedSkillId);

  const handleChange = (skillId: string) => {
    if (skillId === "none") {
      onSelect(null);
      return;
    }

    const skill = allSkills.find((s) => s.id === skillId);
    if (skill) {
      onSelect({
        id: skill.id,
        name: skill.name,
        prompt: skill.prompt,
      });
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        Skill Template
      </Label>
      <Select
        value={selectedSkillId || "none"}
        onValueChange={handleChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a skill template">
            {isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </span>
            ) : selectedSkill ? (
              <div className="flex items-center gap-2">
                <span>{selectedSkill.name}</span>
                {selectedSkill.source === "custom" && (
                  <Badge variant="secondary" className="text-xs">
                    Custom
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">No skill selected</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <span className="text-muted-foreground">
              No skill (custom instructions)
            </span>
          </SelectItem>

          {skillsByCategory.map((category) => (
            <div key={category.value}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {category.label}
              </div>
              {category.skills.map((skill) => (
                <SelectItem key={skill.id} value={skill.id}>
                  <div className="flex items-center gap-2">
                    <span>{skill.name}</span>
                    {skill.source === "custom" && (
                      <Badge variant="secondary" className="text-xs">
                        Custom
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
      {selectedSkill && (
        <p className="text-xs text-muted-foreground">
          {selectedSkill.description}
        </p>
      )}
    </div>
  );
}
