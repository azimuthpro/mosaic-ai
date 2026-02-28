"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import type { UserIntegration } from "@/types/database";

/**
 * Get the current user's integration for a given provider.
 * Optionally filter by teamId for multi-workspace support.
 * Returns null if no integration is found.
 */
export async function getUserIntegration(
  provider: string,
  teamId?: string,
): Promise<UserIntegration | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) return null;

  let query = supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (teamId) {
    query = query.eq("provider_team_id", teamId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error || !data) return null;

  return data as UserIntegration;
}

/**
 * Get all integrations for the current user for a given provider.
 * Used for listing connected workspaces.
 */
export async function getUserIntegrations(
  provider: string,
): Promise<UserIntegration[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error || !data) return [];

  return data as UserIntegration[];
}

/**
 * Delete the current user's integration for a given provider.
 * Optionally filter by teamId to disconnect a specific workspace.
 */
export async function deleteUserIntegration(
  provider: string,
  teamId?: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) return { error: "Not authenticated" };

  let query = supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (teamId) {
    query = query.eq("provider_team_id", teamId);
  }

  const { error } = await query;

  if (error) {
    console.error("Error deleting integration:", error);
    return { error: "Failed to delete integration" };
  }

  return { success: true };
}
