import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";

import { createAdminClient } from "@/lib/supabase/admin";

type SlackAdapterType = ReturnType<typeof createSlackAdapter>;
let cached: { bot: Chat; slackAdapter: SlackAdapterType } | null = null;

export async function getBotAndAdapter(): Promise<{
  bot: Chat;
  slackAdapter: SlackAdapterType;
}> {
  if (cached) return cached;

  const admin = createAdminClient();
  const { data } = await admin
    .from("user_integrations")
    .select("access_token")
    .eq("provider", "slack")
    .limit(1)
    .returns<{ access_token: string }[]>()
    .maybeSingle();

  const slackAdapter = createSlackAdapter({
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    ...(data?.access_token ? { botToken: data.access_token } : {}),
  });

  const bot = new Chat({
    userName: "Mosaic AI",
    adapters: { slack: slackAdapter },
    state: createMemoryState(),
    streamingUpdateIntervalMs: 800,
    onLockConflict: "force",
    logger: "debug",
  });

  cached = { bot, slackAdapter };
  return cached;
}
