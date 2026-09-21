import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Resolves the bot token for a Slack workspace.
 *
 * A bot token belongs to the workspace, not to whoever clicked Connect, so the
 * team ID is the key. Several users may have connected the same workspace;
 * ordering by `updated_at` makes the choice deterministic and prefers the most
 * recently refreshed token instead of an arbitrary row.
 */
export async function resolveBotTokenForTeam(
  adminClient: SupabaseClient<Database>,
  teamId: string,
): Promise<{ botToken: string; botUserId?: string } | null> {
  if (!teamId) return null;

  const { data, error } = await adminClient
    .from("user_integrations")
    .select("access_token, metadata")
    .eq("provider", "slack")
    .eq("provider_team_id", teamId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .returns<
      { access_token: string; metadata: Record<string, unknown> | null }[]
    >();

  if (error) {
    console.error("[slack] resolveBotTokenForTeam error:", error.message);
    return null;
  }

  const row = data?.[0];
  if (!row) return null;

  const botUserId = (row.metadata as { bot_user_id?: string } | null)
    ?.bot_user_id;

  return { botToken: row.access_token, ...(botUserId ? { botUserId } : {}) };
}

type SlackTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

/**
 * Resolves the Slack access token for a tile by looking up the mosaic owner
 * and their Slack integration. Optionally filters by team_id for multi-workspace.
 *
 * Returns `{ ok: false, reason }` if the token cannot be resolved.
 */
export async function resolveSlackToken(
  adminClient: SupabaseClient<Database>,
  tileId: string,
  teamId?: string | null,
): Promise<SlackTokenResult> {
  const { data: tileData } = await adminClient
    .from("tiles")
    .select("mosaic_id")
    .eq("id", tileId)
    .single();

  if (!tileData) {
    return { ok: false, reason: "Could not find tile" };
  }

  const { data: mosaicData } = await adminClient
    .from("mosaics")
    .select("owner_id")
    .eq("id", (tileData as { mosaic_id: string }).mosaic_id)
    .single();

  if (!mosaicData) {
    return { ok: false, reason: "Could not find mosaic owner" };
  }

  let query = adminClient
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", (mosaicData as { owner_id: string }).owner_id)
    .eq("provider", "slack");

  if (teamId) {
    query = query.eq("provider_team_id", teamId);
  }

  const { data: integrationData } = await query.limit(1).maybeSingle();

  if (!integrationData) {
    return {
      ok: false,
      reason:
        "Slack integration not connected. Please connect Slack in the tile settings.",
    };
  }

  return {
    ok: true,
    token: (integrationData as { access_token: string }).access_token,
  };
}
