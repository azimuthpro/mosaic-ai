"use server";

import { revalidatePath } from "next/cache";

import { createClient, getUser } from "@/lib/supabase/server";
import type {
  TileSkill,
  TileSkillCategory,
  TileSkillInsert,
  TileType,
} from "@/types/database";

/**
 * Get all skills for a specific tile type in a mosaic
 * Returns both system defaults and mosaic-specific custom skills
 */
export async function getTileSkills(
  mosaicId: string,
  tileType: TileType,
): Promise<TileSkill[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  // Get system skills for this tile type
  const { data: systemSkills, error: systemError } = await supabase
    .from("tile_skills")
    .select("*")
    .eq("is_system", true)
    .eq("tile_type", tileType)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (systemError) {
    console.error("Error fetching system skills:", systemError);
  }

  // Get mosaic-specific custom skills for this tile type
  const { data: mosaicSkills, error: mosaicError } = await supabase
    .from("tile_skills")
    .select("*")
    .eq("mosaic_id", mosaicId)
    .eq("tile_type", tileType)
    .eq("is_system", false)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (mosaicError) {
    console.error("Error fetching mosaic skills:", mosaicError);
  }

  return [
    ...((systemSkills as TileSkill[]) || []),
    ...((mosaicSkills as TileSkill[]) || []),
  ];
}

/**
 * Get all custom skills for a mosaic (all tile types)
 */
export async function getMosaicSkills(mosaicId: string): Promise<TileSkill[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("tile_skills")
    .select("*")
    .eq("mosaic_id", mosaicId)
    .eq("is_system", false)
    .order("tile_type", { ascending: true })
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching mosaic skills:", error);
    return [];
  }

  return (data as TileSkill[]) || [];
}

/**
 * Get a single skill by ID
 */
export async function getTileSkill(skillId: string): Promise<TileSkill | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("tile_skills")
    .select("*")
    .eq("id", skillId)
    .single();

  if (error) {
    console.error("Error fetching skill:", error);
    return null;
  }

  return data as TileSkill;
}

interface CreateTileSkillParams {
  mosaicId: string;
  tileType: TileType;
  name: string;
  description?: string;
  prompt: string;
  category?: TileSkillCategory;
}

/**
 * Create a custom skill for a mosaic
 */
export async function createTileSkill(params: CreateTileSkillParams) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify mosaic access
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("id, owner_id")
    .eq("id", params.mosaicId)
    .single();

  const mosaic = mosaicData as { id: string; owner_id: string } | null;

  if (!mosaic) {
    // Check if user is an admin member
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", params.mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Not authorized to create skills in this mosaic" };
    }
  } else if (mosaic.owner_id !== user.id) {
    // Check admin access
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", params.mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Not authorized to create skills in this mosaic" };
    }
  }

  const skillInsert: TileSkillInsert = {
    mosaic_id: params.mosaicId,
    tile_type: params.tileType,
    name: params.name,
    description: params.description || null,
    prompt: params.prompt,
    category: params.category || "custom",
    created_by: user.id,
    is_system: false,
  };

  const { data, error } = await supabase
    .from("tile_skills")
    .insert(skillInsert as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating skill:", error);
    return { error: "Failed to create skill" };
  }

  revalidatePath(`/mosaics/${params.mosaicId}`);
  return { success: true, skill: data as TileSkill };
}

interface UpdateTileSkillParams {
  name?: string;
  description?: string;
  prompt?: string;
  category?: TileSkillCategory;
}

/**
 * Update a custom skill
 */
export async function updateTileSkill(
  skillId: string,
  params: UpdateTileSkillParams,
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the skill to check permissions and if it's a system skill
  const { data: skillData, error: fetchError } = await supabase
    .from("tile_skills")
    .select("*, mosaics!inner(owner_id)")
    .eq("id", skillId)
    .single();

  if (fetchError || !skillData) {
    return { error: "Skill not found" };
  }

  type SkillWithMosaic = TileSkill & { mosaics: { owner_id: string } };
  const skill = skillData as SkillWithMosaic;

  if (skill.is_system) {
    return { error: "Cannot modify system skills" };
  }

  // At this point we know it's not a system skill, so mosaic_id is guaranteed to exist
  const mosaicId = skill.mosaic_id as string;

  // Check mosaic ownership/admin access
  if (skill.mosaics.owner_id !== user.id) {
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Not authorized to update this skill" };
    }
  }

  const updateData: Record<string, unknown> = {};
  if (params.name !== undefined) updateData.name = params.name;
  if (params.description !== undefined)
    updateData.description = params.description || null;
  if (params.prompt !== undefined) updateData.prompt = params.prompt;
  if (params.category !== undefined) updateData.category = params.category;

  const { error } = await supabase
    .from("tile_skills")
    .update(updateData as never)
    .eq("id", skillId);

  if (error) {
    console.error("Error updating skill:", error);
    return { error: "Failed to update skill" };
  }

  revalidatePath(`/mosaics/${mosaicId}`);
  return { success: true };
}

/**
 * Delete a custom skill
 */
export async function deleteTileSkill(skillId: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the skill to check permissions
  const { data: skillData, error: fetchError } = await supabase
    .from("tile_skills")
    .select("*, mosaics!inner(owner_id)")
    .eq("id", skillId)
    .single();

  if (fetchError || !skillData) {
    return { error: "Skill not found" };
  }

  type SkillWithMosaic = TileSkill & { mosaics: { owner_id: string } };
  const skill = skillData as SkillWithMosaic;

  if (skill.is_system) {
    return { error: "Cannot delete system skills" };
  }

  // At this point we know it's not a system skill, so mosaic_id is guaranteed to exist
  const mosaicId = skill.mosaic_id as string;

  // Check mosaic ownership/admin access
  if (skill.mosaics.owner_id !== user.id) {
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Not authorized to delete this skill" };
    }
  }

  const { error } = await supabase
    .from("tile_skills")
    .delete()
    .eq("id", skillId);

  if (error) {
    console.error("Error deleting skill:", error);
    return { error: "Failed to delete skill" };
  }

  revalidatePath(`/mosaics/${mosaicId}`);
  return { success: true };
}

/**
 * Copy a system skill to a mosaic for customization
 */
export async function copySystemSkillToMosaic(
  systemSkillId: string,
  mosaicId: string,
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the system skill
  const { data: systemSkillData, error: fetchError } = await supabase
    .from("tile_skills")
    .select("*")
    .eq("id", systemSkillId)
    .eq("is_system", true)
    .single();

  if (fetchError || !systemSkillData) {
    return { error: "System skill not found" };
  }

  const systemSkill = systemSkillData as TileSkill;

  // Verify mosaic access
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("id, owner_id")
    .eq("id", mosaicId)
    .single();

  const mosaic = mosaicData as { id: string; owner_id: string } | null;

  if (!mosaic) {
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Not authorized to create skills in this mosaic" };
    }
  } else if (mosaic.owner_id !== user.id) {
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Not authorized to create skills in this mosaic" };
    }
  }

  // Create a copy with a modified name
  const skillInsert: TileSkillInsert = {
    mosaic_id: mosaicId,
    tile_type: systemSkill.tile_type,
    name: `${systemSkill.name} (Custom)`,
    description: systemSkill.description,
    prompt: systemSkill.prompt,
    category: systemSkill.category,
    created_by: user.id,
    is_system: false,
  };

  const { data, error } = await supabase
    .from("tile_skills")
    .insert(skillInsert as never)
    .select()
    .single();

  if (error) {
    console.error("Error copying skill:", error);
    return { error: "Failed to copy skill" };
  }

  revalidatePath(`/mosaics/${mosaicId}`);
  return { success: true, skill: data as TileSkill };
}
