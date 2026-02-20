"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import type { UserIntegration } from "@/types/database";

/**
 * Get the current user's integration for a given provider.
 * Returns null if no integration is found.
 */
export async function getUserIntegration(
  provider: string,
): Promise<UserIntegration | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .single();

  if (error || !data) return null;

  return data as UserIntegration;
}

/**
 * Delete the current user's integration for a given provider.
 */
export async function deleteUserIntegration(
  provider: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) {
    console.error("Error deleting integration:", error);
    return { error: "Failed to delete integration" };
  }

  return { success: true };
}
