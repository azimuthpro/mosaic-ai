import { createAdminClient } from "@/lib/supabase/admin";

import { registerHandlers } from "./handlers";
import { bot, slackAdapter } from "./index";

let initialized = false;

/**
 * Idempotent bot initialization: registers handlers, initializes adapters,
 * and seeds existing Slack installations from the database.
 */
export async function ensureBotInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;

  registerHandlers();
  await bot.initialize();
  await seedInstallations();

  console.log("[bot] initialized");
}

/**
 * Reads all Slack integrations from user_integrations,
 * deduplicates by team, and seeds them into the Chat SDK state.
 */
async function seedInstallations(): Promise<void> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("user_integrations")
    .select("access_token, provider_team_id, metadata")
    .eq("provider", "slack")
    .returns<
      {
        access_token: string;
        provider_team_id: string | null;
        metadata: Record<string, unknown> | null;
      }[]
    >();

  if (error || !data) {
    console.error("[bot] failed to seed installations:", error?.message);
    return;
  }

  // Deduplicate by team -- take the first token per team
  const byTeam = new Map<
    string,
    { botToken: string; botUserId?: string; teamName?: string }
  >();

  for (const row of data) {
    const teamId = row.provider_team_id;
    if (!teamId || byTeam.has(teamId)) continue;

    const meta = row.metadata as {
      bot_user_id?: string;
      team_name?: string;
    } | null;
    byTeam.set(teamId, {
      botToken: row.access_token,
      botUserId: meta?.bot_user_id,
      teamName: meta?.team_name,
    });
  }

  for (const [teamId, installation] of byTeam) {
    await slackAdapter.setInstallation(teamId, installation);
  }

  console.log(`[bot] seeded ${byTeam.size} Slack installation(s)`);
}
