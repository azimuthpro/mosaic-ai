"use server";

import { revalidatePath } from "next/cache";

import { createClient, getUser } from "@/lib/supabase/server";
import type { AgentMember, MemberRole, User } from "@/types/database";

export type AgentMemberWithUser = AgentMember & {
  user: Pick<User, "id" | "email" | "full_name" | "avatar_url">;
};

/**
 * Get all members of an agent.
 */
export async function getAgentMembers(
  agentId: string,
): Promise<AgentMemberWithUser[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  // Check if user has access to view members (is owner or member)
  const { data: agentData } = await supabase
    .from("agents")
    .select("id, owner_id")
    .eq("id", agentId)
    .single();

  const agent = agentData as { id: string; owner_id: string } | null;

  if (!agent) {
    return [];
  }

  const isOwner = agent.owner_id === user.id;

  // If not owner, check if user is a member
  if (!isOwner) {
    const { data: membershipData } = await supabase
      .from("agent_members")
      .select("id")
      .eq("agent_id", agentId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as { id: string } | null;

    if (!membership) {
      return [];
    }
  }

  const { data, error } = await supabase
    .from("agent_members")
    .select(
      `
      *,
      user:users!agent_members_user_id_fkey (
        id,
        email,
        full_name,
        avatar_url
      )
    `,
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching agent members:", error);
    return [];
  }

  return (data || []) as AgentMemberWithUser[];
}

/**
 * Invite a user to an agent by email.
 */
export async function inviteUserToAgent(
  agentId: string,
  email: string,
  role: "admin" | "member" = "member",
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("id, owner_id")
    .eq("id", agentId)
    .eq("owner_id", user.id)
    .single();

  if (!agent) {
    return { error: "Agent not found or you are not the owner" };
  }

  // Find user by email
  const { data: invitedUserData } = await supabase
    .from("users")
    .select("id, email")
    .eq("email", email.toLowerCase())
    .single();

  const invitedUser = invitedUserData as { id: string; email: string } | null;

  if (!invitedUser) {
    return { error: "User not found. They need to sign up first." };
  }

  // Cannot invite yourself
  if (invitedUser.id === user.id) {
    return { error: "You cannot invite yourself" };
  }

  // Check if user is already a member
  const { data: existingMemberData } = await supabase
    .from("agent_members")
    .select("id")
    .eq("agent_id", agentId)
    .eq("user_id", invitedUser.id)
    .single();

  const existingMember = existingMemberData as { id: string } | null;

  if (existingMember) {
    return { error: "User is already a member of this agent" };
  }

  // Create membership
  const { error: insertError } = await supabase.from("agent_members").insert({
    agent_id: agentId,
    user_id: invitedUser.id,
    role,
  } as never);

  if (insertError) {
    console.error("Error inviting user:", insertError);
    return { error: "Failed to invite user" };
  }

  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

/**
 * Remove a member from an agent.
 */
export async function removeAgentMember(agentId: string, memberId: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("id, owner_id")
    .eq("id", agentId)
    .eq("owner_id", user.id)
    .single();

  if (!agent) {
    return { error: "Agent not found or you are not the owner" };
  }

  // Delete membership
  const { error } = await supabase
    .from("agent_members")
    .delete()
    .eq("id", memberId)
    .eq("agent_id", agentId);

  if (error) {
    console.error("Error removing member:", error);
    return { error: "Failed to remove member" };
  }

  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(
  agentId: string,
  memberId: string,
  role: "admin" | "member",
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("id, owner_id")
    .eq("id", agentId)
    .eq("owner_id", user.id)
    .single();

  if (!agent) {
    return { error: "Agent not found or you are not the owner" };
  }

  // Update role
  const { error } = await supabase
    .from("agent_members")
    .update({ role } as never)
    .eq("id", memberId)
    .eq("agent_id", agentId);

  if (error) {
    console.error("Error updating member role:", error);
    return { error: "Failed to update member role" };
  }

  revalidatePath(`/agents/${agentId}`);
  return { success: true };
}

/**
 * Get the current user's role for an agent.
 * Returns 'owner' if they own the agent, their member role otherwise, or null if no access.
 */
export async function getUserAgentRole(
  agentId: string,
): Promise<MemberRole | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  // Check if owner
  const { data: agentData } = await supabase
    .from("agents")
    .select("owner_id")
    .eq("id", agentId)
    .single();

  const agent = agentData as { owner_id: string } | null;

  if (!agent) {
    return null;
  }

  if (agent.owner_id === user.id) {
    return "owner";
  }

  // Check membership
  const { data: membershipData } = await supabase
    .from("agent_members")
    .select("role")
    .eq("agent_id", agentId)
    .eq("user_id", user.id)
    .single();

  const membership = membershipData as { role: string } | null;

  if (!membership) {
    return null;
  }

  return membership.role as MemberRole;
}
