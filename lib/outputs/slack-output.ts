import type { SupabaseClient } from "@supabase/supabase-js";

import { postMessage } from "@/lib/slack/client";
import { resolveSlackToken } from "@/lib/slack/integration";
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
    const resolved = await resolveSlackToken(
      adminClient,
      tile.id,
      tile.slack_output_team_id,
    );

    if (!resolved.ok) {
      console.error("[slack-output]", resolved.reason, "tile:", tile.id);
      return;
    }

    const text = formatContentAsText(result.content);
    await postMessage(
      resolved.token,
      tile.slack_output_channel_id,
      text,
      tile.name,
    );
  } catch (err) {
    console.error("[slack-output] Failed to deliver Slack output:", err);
  }
}
