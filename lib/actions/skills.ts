"use server";

import { revalidatePath } from "next/cache";

import { createClient, getUser } from "@/lib/supabase/server";
import type {
  Skill,
  SkillCategory,
  SkillInsert,
  SkillUpdate,
} from "@/types/database";

export async function getSkills(): Promise<Skill[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  // Get user's own skills and public skills from others
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .or(`user_id.eq.${user.id},is_public.eq.true`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching skills:", error);
    return [];
  }

  return (data || []) as Skill[];
}

export async function getUserSkills(): Promise<Skill[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching user skills:", error);
    return [];
  }

  return (data || []) as Skill[];
}

export async function getPublicSkills(): Promise<Skill[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("is_public", true)
    .neq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching public skills:", error);
    return [];
  }

  return (data || []) as Skill[];
}

export async function createSkill(formData: FormData) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const prompt = formData.get("prompt") as string;
  const category = (formData.get("category") as SkillCategory) || "custom";
  const isPublic = formData.get("isPublic") === "true";

  if (!name?.trim()) {
    return { error: "Name is required" };
  }

  if (!prompt?.trim()) {
    return { error: "Prompt is required" };
  }

  const skillInsert: SkillInsert = {
    user_id: user.id,
    name: name.trim(),
    description: description?.trim() || null,
    prompt: prompt.trim(),
    category,
    is_public: isPublic,
  };

  const { data, error } = await supabase
    .from("skills")
    .insert(skillInsert as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating skill:", error);
    return { error: "Failed to create skill" };
  }

  revalidatePath("/agents");
  return { success: true, skill: data as Skill };
}

export async function updateSkill(id: string, formData: FormData) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const prompt = formData.get("prompt") as string;
  const category = formData.get("category") as SkillCategory | null;
  const isPublic = formData.get("isPublic") === "true";

  if (!name?.trim()) {
    return { error: "Name is required" };
  }

  if (!prompt?.trim()) {
    return { error: "Prompt is required" };
  }

  const updateData: SkillUpdate = {
    name: name.trim(),
    description: description?.trim() || null,
    prompt: prompt.trim(),
    is_public: isPublic,
  };

  if (category) {
    updateData.category = category;
  }

  const { error } = await supabase
    .from("skills")
    .update(updateData as never)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error updating skill:", error);
    return { error: "Failed to update skill" };
  }

  revalidatePath("/agents");
  return { success: true };
}

export async function deleteSkill(id: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("skills")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting skill:", error);
    return { error: "Failed to delete skill" };
  }

  revalidatePath("/agents");
  return { success: true };
}

export async function toggleSkillPublic(id: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get current state
  const { data: skillData, error: fetchError } = await supabase
    .from("skills")
    .select("is_public")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const skill = skillData as { is_public: boolean } | null;

  if (fetchError || !skill) {
    return { error: "Skill not found" };
  }

  const newIsPublic = !skill.is_public;

  const { error } = await supabase
    .from("skills")
    .update({ is_public: newIsPublic } as never)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error toggling skill visibility:", error);
    return { error: "Failed to update skill" };
  }

  revalidatePath("/agents");
  return { success: true, isPublic: newIsPublic };
}
