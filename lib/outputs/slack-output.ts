import type { SupabaseClient } from "@supabase/supabase-js";

import { postMessage } from "@/lib/slack/client";
import type { Database, Json, Tile } from "@/types/database";

function formatContentAsText(content: Json): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => `- ${String(item)}`).join("\n");
  }
  return JSON.stringify(content, null, 2);
}

/**
 * Delivers a tile job result to a Slack channel if configured.
 * Fire-and-forget: does not throw, logs errors instead.
 */
export async function deliverSlackOutput(
  adminClient: SupabaseClient<Database>,
  tile: Tile,
  result: { content: Json },
): Promise<void> {
  if (!tile.slack_output_enabled || !tile.slack_output_channel_id) return;

  try {
    const { data: mosaicData } = await adminClient
      .from("mosaics")
      .select("owner_id")
      .eq("id", tile.mosaic_id)
      .single();

    const mosaic = mosaicData as { owner_id: string } | null;
    if (!mosaic) {
      console.error(
        "[slack-output] Could not find mosaic owner for tile",
        tile.id,
      );
      return;
    }

    const { data: integrationData } = await adminClient
      .from("user_integrations")
      .select("access_token")
      .eq("user_id", mosaic.owner_id)
      .eq("provider", "slack")
      .single();

    const integration = integrationData as { access_token: string } | null;
    if (!integration) {
      console.error(
        "[slack-output] Slack integration not found for tile",
        tile.id,
      );
      return;
    }

    const text = formatContentAsText(result.content);

    await postMessage(
      integration.access_token,
      tile.slack_output_channel_id,
      text,
      tile.name,
    );
  } catch (err) {
    console.error("[slack-output] Failed to deliver Slack output:", err);
  }
}
