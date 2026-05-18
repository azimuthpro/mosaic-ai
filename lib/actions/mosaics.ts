"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sendInvitationEmail } from "@/lib/email/sendgrid";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { compareBySortOrder } from "@/lib/utils";
import type {
  MemberRole,
  Mosaic,
  MosaicInsert,
  MosaicInvitation,
  MosaicInvitationInsert,
  MosaicMember,
  MosaicMemberInsert,
  MosaicSettings,
  MosaicUpdate,
  MosaicWithStats,
  MosaicWithTiles,
  Tile,
  TileSource,
  TileWithSources,
} from "@/types/database";

/**
 * Get the current authenticated user's ID
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getUser();
  return user?.id ?? null;
}

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

type UserData = { id: string; email: string; full_name: string | null };

/**
 * Fetch user data for a list of user IDs using the admin client
 */
async function fetchUserDataByIds(
  userIds: string[],
): Promise<Map<string, UserData>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const adminClient = createAdminClient();
  const { data: users, error } = await adminClient
    .from("users")
    .select("id, email, full_name")
    .in("id", userIds);

  if (error) {
    console.error("Error fetching user data:", error);
    return new Map();
  }

  return new Map((users as UserData[]).map((u) => [u.id, u]));
}

/**
 * Transform a tile query result to include sources array
 */
function transformTileWithSources(tile: TileQueryResult): TileWithSources {
  return {
    ...tile,
    sources: (tile.tile_sources || []).sort(compareBySortOrder),
  };
}

/**
 * Transform a mosaic query result into a MosaicWithStats.
 * Member count includes the owner (+1) since mosaic_members only tracks non-owners.
 */
function transformMosaicWithStats(m: MosaicQueryResult): MosaicWithStats {
  return {
    ...m,
    tiles: (m.tiles || []).map(transformTileWithSources),
    tile_count: m.tiles?.length || 0,
    member_count: (m.mosaic_members?.length || 0) + 1,
  } as MosaicWithStats;
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

  return ((data as MosaicQueryResult[]) || []).map(transformMosaicWithStats);
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

  return ((data as MosaicQueryResult[]) || []).map(transformMosaicWithStats);
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
  return { success: true, mosaicId: mosaic.id };
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
  const timezone = formData.get("timezone") as string | null;

  // Check if user is owner or admin
  const role = await getUserMosaicRole(id);
  if (role !== "owner" && role !== "admin") {
    return { error: "Not authorized to update this mosaic" };
  }

  // Get current settings to merge with new timezone
  const { data: currentMosaicData } = await supabase
    .from("mosaics")
    .select("settings")
    .eq("id", id)
    .single();

  const currentMosaic = currentMosaicData as {
    settings: MosaicSettings;
  } | null;
  const currentSettings = currentMosaic?.settings || {};
  const newSettings: MosaicSettings = {
    ...currentSettings,
    timezone: timezone || undefined,
  };

  const updateData: MosaicUpdate = {
    name,
    description: description || null,
    is_active: isActive,
    settings: newSettings as { [key: string]: string | undefined },
  };

  // Use admin client to bypass RLS (which only allows owner_id = auth.uid())
  // Authorization is already verified by getUserMosaicRole check above
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("mosaics")
    .update(updateData as never)
    .eq("id", id);

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

  // Verify user has access (is owner or member) via regular client
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("owner_id")
    .eq("id", mosaicId)
    .single();

  const isOwner =
    mosaicData && (mosaicData as { owner_id: string }).owner_id === user.id;

  if (!isOwner) {
    const { data: membership } = await supabase
      .from("mosaic_members")
      .select("id")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return [];
    }
  }

  // Use admin client to bypass RLS and fetch all members
  const adminClient = createAdminClient();
  const { data: members, error } = await adminClient
    .from("mosaic_members")
    .select("*")
    .eq("mosaic_id", mosaicId);

  if (error || !members?.length) {
    console.error("getMosaicMembers: query returned empty or error", {
      error,
      count: members?.length,
      mosaicId,
    });
    return [];
  }

  const userIds = (members as MosaicMember[]).map((m) => m.user_id);
  const userMap = await fetchUserDataByIds(userIds);

  return (members as MosaicMember[])
    .map((m) => {
      const userData = userMap.get(m.user_id);
      if (!userData) return null;
      return {
        ...m,
        user: { email: userData.email, full_name: userData.full_name },
      };
    })
    .filter(Boolean) as (MosaicMember & {
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
  if (!member) {
    return { error: "Not authorized to remove this member" };
  }

  // Allow owner or admin to remove members
  const isOwner = member.mosaics.owner_id === user.id;
  if (!isOwner) {
    const role = await getUserMosaicRole(member.mosaic_id);
    if (role !== "admin") {
      return { error: "Not authorized to remove this member" };
    }
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

/**
 * Get the owner of a mosaic
 */
export async function getMosaicOwner(
  mosaicId: string,
): Promise<UserData | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  // Try regular client first (works when user has RLS access as owner or member)
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("owner_id")
    .eq("id", mosaicId)
    .single();

  if (mosaicData) {
    const ownerId = (mosaicData as { owner_id: string }).owner_id;
    const userMap = await fetchUserDataByIds([ownerId]);
    return userMap.get(ownerId) || null;
  }

  // RLS blocked the query -- verify membership before using admin client
  const { data: membership } = await supabase
    .from("mosaic_members")
    .select("id")
    .eq("mosaic_id", mosaicId)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return null;
  }

  const adminClient = createAdminClient();
  const { data: adminMosaic, error } = await adminClient
    .from("mosaics")
    .select("owner_id")
    .eq("id", mosaicId)
    .single();

  if (error || !adminMosaic) {
    if (error) console.error("Error fetching mosaic owner:", error);
    return null;
  }

  const ownerId = (adminMosaic as { owner_id: string }).owner_id;
  const userMap = await fetchUserDataByIds([ownerId]);
  return userMap.get(ownerId) || null;
}

/**
 * Invite a user to a mosaic by email
 * If user exists, add them directly; otherwise create an invitation
 */
export async function inviteToMosaic(
  mosaicId: string,
  email: string,
  role: Exclude<MemberRole, "owner"> = "member",
): Promise<{ success: boolean; error?: string; invited?: boolean }> {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const user = await getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify ownership
    const { data: mosaicData } = await supabase
      .from("mosaics")
      .select("id, name")
      .eq("id", mosaicId)
      .eq("owner_id", user.id)
      .single();

    const mosaic = mosaicData as { id: string; name: string } | null;
    if (!mosaic) {
      return { success: false, error: "Mosaic not found or not owned by you" };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const { data: existingUserData } = await adminClient
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .single();

    if (existingUserData) {
      const existingUserId = (existingUserData as { id: string }).id;
      const result = await addMosaicMember(mosaicId, existingUserId, role);
      if (result.error) {
        return { success: false, error: result.error };
      }
      return { success: true, invited: false };
    }

    // Clean up old cancelled/expired invitations
    await adminClient
      .from("mosaic_invitations")
      .delete()
      .eq("mosaic_id", mosaicId)
      .eq("email", normalizedEmail)
      .in("status", ["cancelled", "expired"]);

    // Check for existing pending invitation
    const { data: existingInvitation } = await adminClient
      .from("mosaic_invitations")
      .select("id")
      .eq("mosaic_id", mosaicId)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .single();

    if (existingInvitation) {
      return {
        success: false,
        error: "An invitation is already pending for this email",
      };
    }

    // Create the invitation
    const invitationInsert: MosaicInvitationInsert = {
      mosaic_id: mosaicId,
      email: normalizedEmail,
      role,
      invited_by: user.id,
    };

    const { data: invitation, error: insertError } = await adminClient
      .from("mosaic_invitations")
      .insert(invitationInsert as never)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating invitation:", insertError);
      return { success: false, error: "Failed to create invitation" };
    }

    // Get inviter name for email
    const inviterMap = await fetchUserDataByIds([user.id]);
    const inviter = inviterMap.get(user.id);
    const inviterName = inviter?.full_name || inviter?.email || "Someone";

    // Send invitation email (log error but don't fail the invitation)
    const emailResult = await sendInvitationEmail({
      recipientEmail: normalizedEmail,
      workspaceName: mosaic.name,
      inviterName,
      role,
      invitationToken: (invitation as MosaicInvitation).token,
    });

    if (!emailResult.success) {
      console.error("Failed to send invitation email:", emailResult.error);
    }

    revalidatePath(`/mosaics/${mosaicId}`);
    revalidatePath(`/mosaics/${mosaicId}/settings`);
    return { success: true, invited: true };
  } catch (err) {
    console.error("inviteToMosaic unexpected error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get pending invitations for a mosaic (owner only)
 */
export async function getMosaicInvitations(
  mosaicId: string,
): Promise<MosaicInvitation[]> {
  try {
    const supabase = await createClient();
    const user = await getUser();

    if (!user) {
      return [];
    }

    // Verify ownership
    const { data: mosaic } = await supabase
      .from("mosaics")
      .select("id")
      .eq("id", mosaicId)
      .eq("owner_id", user.id)
      .single();

    if (!mosaic) {
      return [];
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from("mosaic_invitations")
      .select("*")
      .eq("mosaic_id", mosaicId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invitations:", error);
      return [];
    }

    return (data as MosaicInvitation[]) || [];
  } catch (err) {
    console.error("getMosaicInvitations unexpected error:", err);
    return [];
  }
}

/**
 * Cancel a mosaic invitation (owner only)
 */
export async function cancelMosaicInvitation(invitationId: string) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const user = await getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Get invitation
    const { data: invitationData } = await adminClient
      .from("mosaic_invitations")
      .select("id, mosaic_id")
      .eq("id", invitationId)
      .single();

    const invitation = invitationData as {
      id: string;
      mosaic_id: string;
    } | null;
    if (!invitation) {
      return { error: "Invitation not found" };
    }

    // Verify ownership
    const { data: mosaic } = await supabase
      .from("mosaics")
      .select("id")
      .eq("id", invitation.mosaic_id)
      .eq("owner_id", user.id)
      .single();

    if (!mosaic) {
      return { error: "Not authorized to cancel this invitation" };
    }

    const { error } = await adminClient
      .from("mosaic_invitations")
      .update({ status: "cancelled" } as never)
      .eq("id", invitationId);

    if (error) {
      console.error("Error cancelling invitation:", error);
      return { error: "Failed to cancel invitation" };
    }

    revalidatePath(`/mosaics/${invitation.mosaic_id}`);
    revalidatePath(`/mosaics/${invitation.mosaic_id}/settings`);
    return { success: true };
  } catch (err) {
    console.error("cancelMosaicInvitation unexpected error:", err);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Accept a mosaic invitation
 */
export async function acceptMosaicInvitation(token: string) {
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const adminClient = createAdminClient();

  const { data: invitationData } = await adminClient
    .from("mosaic_invitations")
    .select("id, mosaic_id, role, expires_at, status")
    .eq("token", token)
    .eq("status", "pending")
    .maybeSingle();

  const invitation = invitationData as {
    id: string;
    mosaic_id: string;
    role: MemberRole;
    expires_at: string;
    status: string;
  } | null;

  if (!invitation) {
    return { error: "Invitation not found or already used" };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await adminClient
      .from("mosaic_invitations")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", invitation.id);
    return { error: "Invitation has expired" };
  }

  const { data: existingMember } = await adminClient
    .from("mosaic_members")
    .select("id")
    .eq("mosaic_id", invitation.mosaic_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    await adminClient
      .from("mosaic_invitations")
      .update({
        status: "accepted",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", invitation.id);
    revalidatePath(`/mosaics/${invitation.mosaic_id}`);
    revalidatePath("/mosaics");
    return {
      success: true,
      mosaicId: invitation.mosaic_id,
      alreadyMember: true,
    };
  }

  const { error: insertError } = await adminClient
    .from("mosaic_members")
    .insert({
      mosaic_id: invitation.mosaic_id,
      user_id: user.id,
      role: invitation.role,
    } as never);

  if (insertError) {
    console.error("Error inserting member:", insertError);
    return { error: "Failed to accept invitation" };
  }

  await adminClient
    .from("mosaic_invitations")
    .update({
      status: "accepted",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", invitation.id);

  revalidatePath(`/mosaics/${invitation.mosaic_id}`);
  revalidatePath("/mosaics");

  return {
    success: true,
    mosaicId: invitation.mosaic_id,
    alreadyMember: false,
  };
}

/**
 * Transfer mosaic ownership to an admin member
 */
export async function transferMosaicOwnership(
  mosaicId: string,
  newOwnerId: string,
) {
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const adminClient = createAdminClient();

  const { data: mosaicData } = await adminClient
    .from("mosaics")
    .select("id, owner_id")
    .eq("id", mosaicId)
    .maybeSingle();

  const mosaic = mosaicData as { id: string; owner_id: string } | null;

  if (!mosaic || mosaic.owner_id !== user.id) {
    return { error: "Mosaic not found or you are not the owner" };
  }

  const { data: newOwnerMemberData } = await adminClient
    .from("mosaic_members")
    .select("id, role")
    .eq("mosaic_id", mosaicId)
    .eq("user_id", newOwnerId)
    .eq("role", "admin")
    .maybeSingle();

  if (!newOwnerMemberData) {
    return { error: "New owner must be an admin member of the mosaic" };
  }

  const nowIso = new Date().toISOString();

  const { error: mosaicUpdateError } = await adminClient
    .from("mosaics")
    .update({ owner_id: newOwnerId, updated_at: nowIso } as never)
    .eq("id", mosaicId);

  if (mosaicUpdateError) {
    console.error("Error transferring ownership:", mosaicUpdateError);
    return { error: "Failed to transfer ownership" };
  }

  await adminClient
    .from("mosaic_members")
    .update({ role: "owner" } as never)
    .eq("mosaic_id", mosaicId)
    .eq("user_id", newOwnerId);

  const { data: previousOwnerMember } = await adminClient
    .from("mosaic_members")
    .select("id")
    .eq("mosaic_id", mosaicId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (previousOwnerMember) {
    await adminClient
      .from("mosaic_members")
      .update({ role: "admin" } as never)
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id);
  } else {
    await adminClient.from("mosaic_members").insert({
      mosaic_id: mosaicId,
      user_id: user.id,
      role: "admin",
    } as never);
  }

  revalidatePath(`/mosaics/${mosaicId}`);
  revalidatePath("/mosaics");

  return { success: true };
}

/**
 * Get admin members of a mosaic (for ownership transfer)
 */
export async function getMosaicAdmins(
  mosaicId: string,
): Promise<(MosaicMember & { user: UserData })[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data: admins, error } = await supabase
    .from("mosaic_members")
    .select("*")
    .eq("mosaic_id", mosaicId)
    .eq("role", "admin");

  if (error || !admins?.length) {
    if (error) console.error("Error fetching mosaic admins:", error);
    return [];
  }

  const userIds = (admins as MosaicMember[]).map((a) => a.user_id);
  const userMap = await fetchUserDataByIds(userIds);

  return (admins as MosaicMember[])
    .map((a) => {
      const userData = userMap.get(a.user_id);
      if (!userData) return null;
      return { ...a, user: userData };
    })
    .filter(Boolean) as (MosaicMember & { user: UserData })[];
}

/**
 * Get pending invitations for the current user
 */
export type PendingInvitation = {
  id: string;
  mosaic_id: string;
  mosaic_name: string;
  role: string;
  token: string;
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
};

export async function getPendingInvitationsForUser(): Promise<
  PendingInvitation[]
> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user?.email) {
    return [];
  }

  const adminClient = createAdminClient();

  // Define type for the query result
  type InvitationQueryResult = {
    id: string;
    mosaic_id: string;
    role: string;
    token: string;
    invited_by: string | null;
    expires_at: string;
    created_at: string;
    mosaics: { name: string; owner_id: string };
  };

  // Get pending invitations for user's email
  const { data, error } = await adminClient
    .from("mosaic_invitations")
    .select(
      `
      id,
      mosaic_id,
      role,
      token,
      invited_by,
      expires_at,
      created_at,
      mosaics!inner (name, owner_id)
    `,
    )
    .eq("email", user.email)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching pending invitations:", error);
    return [];
  }

  const invitations = data as InvitationQueryResult[] | null;

  if (!invitations?.length) {
    return [];
  }

  // Get inviter names
  const inviterIds = invitations
    .map((inv) => inv.invited_by)
    .filter(Boolean) as string[];
  const inviterMap =
    inviterIds.length > 0 ? await fetchUserDataByIds(inviterIds) : new Map();

  return invitations.map((inv) => {
    const inviterData = inv.invited_by ? inviterMap.get(inv.invited_by) : null;

    return {
      id: inv.id,
      mosaic_id: inv.mosaic_id,
      mosaic_name: inv.mosaics.name,
      role: inv.role,
      token: inv.token,
      invited_by_name: inviterData?.full_name || inviterData?.email || null,
      expires_at: inv.expires_at,
      created_at: inv.created_at,
    };
  });
}

/**
 * Decline a mosaic invitation
 */
export async function declineMosaicInvitation(invitationId: string) {
  const user = await getUser();

  if (!user?.email) {
    return { error: "Not authenticated" };
  }

  const adminClient = createAdminClient();

  // Verify invitation belongs to user
  const { data: invitation } = await adminClient
    .from("mosaic_invitations")
    .select("id, email, mosaic_id")
    .eq("id", invitationId)
    .eq("status", "pending")
    .single();

  if (!invitation) {
    return { error: "Invitation not found" };
  }

  if ((invitation as { email: string }).email !== user.email) {
    return { error: "Not authorized to decline this invitation" };
  }

  // Update invitation status to cancelled
  const { error } = await adminClient
    .from("mosaic_invitations")
    .update({ status: "cancelled" } as never)
    .eq("id", invitationId);

  if (error) {
    console.error("Error declining invitation:", error);
    return { error: "Failed to decline invitation" };
  }

  revalidatePath("/mosaics");

  return { success: true };
}
