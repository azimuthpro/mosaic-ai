"use client";

import { Globe, Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

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
  deleteSkill,
  getSkills,
  toggleSkillPublic,
} from "@/lib/actions/skills";
import {
  BUILTIN_SKILLS,
  SKILL_CATEGORIES,
  type SkillCategory,
} from "@/lib/constants/skills";
import type { Skill } from "@/types/database";

import { CreateSkillDialog } from "./create-skill-dialog";

interface SkillsGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (prompt: string) => void;
}

type TabValue = "all" | SkillCategory;

function getCategoryBadgeVariant(
  category: SkillCategory,
): "default" | "secondary" | "outline" {
  switch (category) {
    case "news":
    case "market":
      return "default";
    case "research":
    case "social":
      return "secondary";
    default:
      return "outline";
  }
}

function getCategoryLabel(category: SkillCategory): string {
  return SKILL_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

function ToggleIcon({
  isLoading,
  isPublic,
}: {
  isLoading: boolean;
  isPublic: boolean;
}) {
  if (isLoading) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
  }
  if (isPublic) {
    return <Globe className="h-3.5 w-3.5" />;
  }
  return <Lock className="h-3.5 w-3.5" />;
}

export function SkillsGallery({
  open,
  onOpenChange,
  onSelect,
}: SkillsGalleryProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [customSkills, setCustomSkills] = useState<Skill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  async function loadCustomSkills() {
    setIsLoading(true);
    const skills = await getSkills();
    setCustomSkills(skills);
    setIsLoading(false);
  }

  // Load skills when dialog opens (using onOpenChange handler pattern)
  function handleOpenChange(newOpen: boolean) {
    if (newOpen && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadCustomSkills();
    }
    if (!newOpen) {
      hasLoadedRef.current = false;
    }
    onOpenChange(newOpen);
  }

  async function handleDeleteSkill(id: string) {
    setDeletingId(id);
    const result = await deleteSkill(id);
    if (result.success) {
      setCustomSkills((prev) => prev.filter((s) => s.id !== id));
    }
    setDeletingId(null);
  }

  async function handleTogglePublic(skill: Skill) {
    setTogglingId(skill.id);
    const result = await toggleSkillPublic(skill.id);
    if (result.success) {
      setCustomSkills((prev) =>
        prev.map((s) =>
          s.id === skill.id ? { ...s, is_public: result.isPublic } : s,
        ),
      );
    }
    setTogglingId(null);
  }

  function handleCreateSuccess() {
    loadCustomSkills();
    setShowCreateDialog(false);
    setEditingSkill(null);
  }

  // Filter built-in skills by category
  const filteredBuiltinSkills =
    activeTab === "all" || activeTab === "custom"
      ? BUILTIN_SKILLS
      : BUILTIN_SKILLS.filter((s) => s.category === activeTab);

  // Separate user's own skills from community skills
  const userSkills = customSkills.filter((s) => s.user_id !== undefined);
  const communitySkills = customSkills.filter(
    (s) => s.is_public && s.user_id === undefined,
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Skills Gallery</DialogTitle>
            <DialogDescription>
              Browse predefined skills or create your own custom skills.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabValue)}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <TabsList className="w-full justify-start flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="all" className="text-xs">
                All
              </TabsTrigger>
              {SKILL_CATEGORIES.filter((c) => c.value !== "custom").map(
                (category) => (
                  <TabsTrigger
                    key={category.value}
                    value={category.value}
                    className="text-xs"
                  >
                    {category.label}
                  </TabsTrigger>
                ),
              )}
              <TabsTrigger value="custom" className="text-xs">
                Custom
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              {/* Built-in skills (show for all tabs except custom) */}
              {activeTab !== "custom" && (
                <TabsContent value={activeTab} className="mt-0 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredBuiltinSkills.map((skill) => (
                      <button
                        key={skill.id}
                        onClick={() => onSelect(skill.prompt)}
                        className="group relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 hover:border-primary/50"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{skill.name}</span>
                          <Badge
                            variant={getCategoryBadgeVariant(skill.category)}
                            className="text-[10px]"
                          >
                            {getCategoryLabel(skill.category)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {skill.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              )}

              {/* Custom skills tab */}
              {activeTab === "custom" && (
                <TabsContent value="custom" className="mt-0 space-y-6">
                  {/* Create button */}
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(true)}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Custom Skill
                  </Button>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* User's skills */}
                      {userSkills.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            My Skills
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {userSkills.map((skill) => (
                              <div
                                key={skill.id}
                                className="group relative flex flex-col items-start gap-2 rounded-lg border p-4"
                              >
                                <div className="flex w-full items-center justify-between gap-2">
                                  <button
                                    onClick={() => onSelect(skill.prompt)}
                                    className="flex items-center gap-2 text-left hover:underline"
                                  >
                                    <span className="font-medium">
                                      {skill.name}
                                    </span>
                                  </button>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => handleTogglePublic(skill)}
                                      disabled={togglingId === skill.id}
                                    >
                                      <ToggleIcon
                                        isLoading={togglingId === skill.id}
                                        isPublic={skill.is_public}
                                      />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => setEditingSkill(skill)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive"
                                      onClick={() =>
                                        handleDeleteSkill(skill.id)
                                      }
                                      disabled={deletingId === skill.id}
                                    >
                                      {deletingId === skill.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                <button
                                  onClick={() => onSelect(skill.prompt)}
                                  className="w-full text-left"
                                >
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {skill.description || "No description"}
                                  </p>
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Community skills */}
                      {communitySkills.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-medium text-muted-foreground">
                            Community Skills
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {communitySkills.map((skill) => (
                              <button
                                key={skill.id}
                                onClick={() => onSelect(skill.prompt)}
                                className="group relative flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 hover:border-primary/50"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {skill.name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    Community
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {skill.description || "No description"}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {userSkills.length === 0 &&
                        communitySkills.length === 0 && (
                          <p className="text-center text-sm text-muted-foreground py-8">
                            No custom skills yet. Create your first one!
                          </p>
                        )}
                    </>
                  )}
                </TabsContent>
              )}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <CreateSkillDialog
        open={showCreateDialog || editingSkill !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingSkill(null);
          }
        }}
        skill={editingSkill}
        onSuccess={handleCreateSuccess}
      />
    </>
  );
}
