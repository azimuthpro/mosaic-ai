"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getUser } from "@/lib/supabase/server";
import type {
  MemberRole,
  Mosaic,
  MosaicInsert,
  MosaicMember,
  MosaicMemberInsert,
  MosaicUpdate,
  Tile,
  TileSource,
  TileWithSources,
} from "@/types/database";

export type MosaicWithTiles = Mosaic & { tiles: TileWithSources[] };
export type MosaicWithStats = Mosaic & {
  tiles: TileWithSources[];
  tile_count: number;
  member_count: number;
};

type TileQueryResult = Tile & {
  tile_sources: TileSource[] | null;
};

type MosaicQueryResult = Mosaic & {
  tiles: TileQueryResult[] | null;
  mosaic_members: { id: string }[] | null;
};

type MemberWithMosaic = {
  id: string;
  mosaic_id: string;
  mosaics: { owner_id: string };
};

/**
 * Transform a tile query result to include sources array
 */
function transformTileWithSources(tile: TileQueryResult): TileWithSources {
  return {
    ...tile,
    sources: tile.tile_sources || [],
  };
}

/**
 * Get all mosaics owned by the current user
 */
export async function getMosaics(): Promise<MosaicWithStats[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("mosaics")
    .select(
      `
      *,
      tiles (*, tile_sources!tile_sources_tile_id_fkey (*)),
      mosaic_members (id)
    `,
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching mosaics:", error);
    return [];
  }

  return ((data as MosaicQueryResult[]) || []).map((m) => ({
    ...m,
    tiles: (m.tiles || []).map(transformTileWithSources),
    tile_count: m.tiles?.length || 0,
    member_count: m.mosaic_members?.length || 0,
  })) as MosaicWithStats[];
}

/**
 * Get mosaics shared with the current user (not owned by them)
 */
export async function getSharedMosaics(): Promise<MosaicWithStats[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  // Get mosaic IDs where user is a member
  const { data: memberships } = await supabase
    .from("mosaic_members")
    .select("mosaic_id")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const mosaicIds = memberships.map(
    (m) => (m as { mosaic_id: string }).mosaic_id,
  );

  const { data, error } = await supabase
    .from("mosaics")
    .select(
      `
      *,
      tiles (*, tile_sources!tile_sources_tile_id_fkey (*)),
      mosaic_members (id)
    `,
    )
    .in("id", mosaicIds)
    .neq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching shared mosaics:", error);
    return [];
  }

  return ((data as MosaicQueryResult[]) || []).map((m) => ({
    ...m,
    tiles: (m.tiles || []).map(transformTileWithSources),
    tile_count: m.tiles?.length || 0,
    member_count: m.mosaic_members?.length || 0,
  })) as MosaicWithStats[];
}

/**
 * Get a single mosaic by ID
 */
export async function getMosaic(id: string): Promise<MosaicWithTiles | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  // First try to get as owner
  const { data: ownedMosaic } = await supabase
    .from("mosaics")
    .select(
      `
      *,
      tiles (*, tile_sources!tile_sources_tile_id_fkey (*))
    `,
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (ownedMosaic) {
    const mosaic = ownedMosaic as Mosaic & { tiles: TileQueryResult[] | null };
    return {
      ...mosaic,
      tiles: (mosaic.tiles || []).map(transformTileWithSources),
    } as MosaicWithTiles;
  }

  // Check if user is a member
  const { data: membership } = await supabase
    .from("mosaic_members")
    .select("id")
    .eq("mosaic_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return null;
  }

  // User is a member, get the mosaic
  const { data, error } = await supabase
    .from("mosaics")
    .select(
      `
      *,
      tiles (*, tile_sources!tile_sources_tile_id_fkey (*))
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching shared mosaic:", error);
    return null;
  }

  const mosaic = data as Mosaic & { tiles: TileQueryResult[] | null };
  return {
    ...mosaic,
    tiles: (mosaic.tiles || []).map(transformTileWithSources),
  } as MosaicWithTiles;
}

/**
 * Create a new mosaic
 */
export async function createMosaic(formData: FormData) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;

  const mosaicInsert: MosaicInsert = {
    owner_id: user.id,
    name,
    description: description || null,
    is_active: true,
    settings: {},
  };

  const { data, error } = await supabase
    .from("mosaics")
    .insert(mosaicInsert as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating mosaic:", error);
    return { error: "Failed to create mosaic" };
  }

  const mosaic = data as Mosaic;
  revalidatePath("/mosaics");
  redirect(`/mosaics/${mosaic.id}`);
}

/**
 * Update a mosaic
 */
export async function updateMosaic(id: string, formData: FormData) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const isActive = formData.get("isActive") === "true";

  const updateData: MosaicUpdate = {
    name,
    description: description || null,
    is_active: isActive,
  };

  const { error } = await supabase
    .from("mosaics")
    .update(updateData as never)
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Error updating mosaic:", error);
    return { error: "Failed to update mosaic" };
  }

  revalidatePath("/mosaics");
  revalidatePath(`/mosaics/${id}`);

  return { success: true };
}

/**
 * Delete a mosaic
 */
export async function deleteMosaic(id: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("mosaics")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Error deleting mosaic:", error);
    return { error: "Failed to delete mosaic" };
  }

  revalidatePath("/mosaics");
  redirect("/mosaics");
}

/**
 * Get members of a mosaic
 */
export async function getMosaicMembers(
  mosaicId: string,
): Promise<
  (MosaicMember & { user: { email: string; full_name: string | null } })[]
> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("mosaic_members")
    .select(
      `
      *,
      users:user_id (email, full_name)
    `,
    )
    .eq("mosaic_id", mosaicId);

  if (error) {
    console.error("Error fetching mosaic members:", error);
    return [];
  }

  type MemberQueryResult = MosaicMember & {
    users: { email: string; full_name: string | null } | null;
  };

  return ((data as MemberQueryResult[]) || []).map((m) => ({
    ...m,
    user: m.users!,
  })) as (MosaicMember & {
    user: { email: string; full_name: string | null };
  })[];
}

/**
 * Add a member to a mosaic
 */
export async function addMosaicMember(
  mosaicId: string,
  userId: string,
  role: MemberRole = "member",
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify ownership
  const { data: mosaic } = await supabase
    .from("mosaics")
    .select("id")
    .eq("id", mosaicId)
    .eq("owner_id", user.id)
    .single();

  if (!mosaic) {
    return { error: "Mosaic not found or not owned by you" };
  }

  const memberInsert: MosaicMemberInsert = {
    mosaic_id: mosaicId,
    user_id: userId,
    role,
  };

  const { error } = await supabase
    .from("mosaic_members")
    .insert(memberInsert as never);

  if (error) {
    if (error.code === "23505") {
      return { error: "User is already a member of this mosaic" };
    }
    console.error("Error adding mosaic member:", error);
    return { error: "Failed to add member" };
  }

  revalidatePath(`/mosaics/${mosaicId}`);
  return { success: true };
}

/**
 * Update a member's role
 */
export async function updateMosaicMemberRole(
  memberId: string,
  role: MemberRole,
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the member and verify mosaic ownership
  const { data: memberData } = await supabase
    .from("mosaic_members")
    .select(
      `
      id,
      mosaic_id,
      mosaics!inner (owner_id)
    `,
    )
    .eq("id", memberId)
    .single();

  const member = memberData as MemberWithMosaic | null;
  if (!member || member.mosaics.owner_id !== user.id) {
    return { error: "Not authorized to update this member" };
  }

  const { error } = await supabase
    .from("mosaic_members")
    .update({ role } as never)
    .eq("id", memberId);

  if (error) {
    console.error("Error updating member role:", error);
    return { error: "Failed to update member role" };
  }

  revalidatePath(`/mosaics/${member.mosaic_id}`);
  return { success: true };
}

/**
 * Remove a member from a mosaic
 */
export async function removeMosaicMember(memberId: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the member and verify mosaic ownership
  const { data: memberData } = await supabase
    .from("mosaic_members")
    .select(
      `
      id,
      mosaic_id,
      mosaics!inner (owner_id)
    `,
    )
    .eq("id", memberId)
    .single();

  const member = memberData as MemberWithMosaic | null;
  if (!member || member.mosaics.owner_id !== user.id) {
    return { error: "Not authorized to remove this member" };
  }

  const { error } = await supabase
    .from("mosaic_members")
    .delete()
    .eq("id", memberId);

  if (error) {
    console.error("Error removing member:", error);
    return { error: "Failed to remove member" };
  }

  revalidatePath(`/mosaics/${member.mosaic_id}`);
  return { success: true };
}

/**
 * Get user's role in a mosaic
 */
export async function getUserMosaicRole(
  mosaicId: string,
): Promise<MemberRole | "owner" | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  // Check if user is the owner
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("owner_id")
    .eq("id", mosaicId)
    .single();

  const mosaicOwner = mosaicData as { owner_id: string } | null;
  if (mosaicOwner?.owner_id === user.id) {
    return "owner";
  }

  // Check membership
  const { data: memberData } = await supabase
    .from("mosaic_members")
    .select("role")
    .eq("mosaic_id", mosaicId)
    .eq("user_id", user.id)
    .single();

  const member = memberData as { role: MemberRole } | null;
  return member?.role || null;
}
