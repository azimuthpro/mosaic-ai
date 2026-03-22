import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type GitHubTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

/**
 * Resolves the GitHub access token for a tile by looking up the mosaic owner
 * and their GitHub integration.
 */
export async function resolveGitHubToken(
  adminClient: SupabaseClient<Database>,
  tileId: string,
): Promise<GitHubTokenResult> {
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

  const { data: integrationData } = await adminClient
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", (mosaicData as { owner_id: string }).owner_id)
    .eq("provider", "github")
    .limit(1)
    .maybeSingle();

  if (!integrationData) {
    return {
      ok: false,
      reason:
        "GitHub integration not connected. Please connect GitHub in the tile settings.",
    };
  }

  return {
    ok: true,
    token: (integrationData as { access_token: string }).access_token,
  };
}
