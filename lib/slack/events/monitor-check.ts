import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Checks whether any active slack_reader tile source is monitoring the given channel.
 */
export async function isChannelMonitored(
  admin: SupabaseClient<Database>,
  channelId: string,
): Promise<boolean> {
  const { count, error } = await admin
    .from("tile_sources")
    .select("id", { count: "exact", head: true })
    .eq("type", "slack_channel")
    .eq("is_active", true)
    .eq("config->>channel_id", channelId);

  if (error) {
    console.error("[slack-events] isChannelMonitored error:", error.message);
    return false;
  }

  return (count ?? 0) > 0;
}

/**
 * Resolves a bot access token for a given Slack team ID.
 * Returns the first matching token, or null if none found.
 */
export async function resolveTokenForTeam(
  admin: SupabaseClient<Database>,
  teamId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("user_integrations")
    .select("access_token")
    .eq("provider", "slack")
    .eq("provider_team_id", teamId)
    .limit(1)
    .returns<{ access_token: string }[]>();

  if (error) {
    console.error("[slack-events] resolveTokenForTeam error:", error.message);
    return null;
  }

  return data?.[0]?.access_token ?? null;
}
