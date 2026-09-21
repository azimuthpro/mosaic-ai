import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createPostgresState } from "@chat-adapter/state-pg";
import { Chat, type StateAdapter } from "chat";

import { resolveBotTokenForTeam } from "@/lib/slack/integration";
import { createAdminClient } from "@/lib/supabase/admin";

type SlackAdapterType = ReturnType<typeof createSlackAdapter>;

/**
 * Thread subscriptions, message dedupe keys and thread locks live in the state
 * adapter. In-memory state is per-instance, so on serverless it loses track of
 * which threads the bot follows (follow-up replies are ignored) and lets a
 * retried Slack event be answered twice. Any deployment with more than one
 * instance needs the shared adapter.
 */
function createBotState(): StateAdapter {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (url) return createPostgresState({ url });

  if (process.env.NODE_ENV === "production") {
    console.error(
      "[bot] POSTGRES_URL is not set — falling back to in-memory state. " +
        "Thread follow-ups will be dropped and Slack retries answered twice.",
    );
  }
  return createMemoryState();
}

export function createBot(): { bot: Chat; slackAdapter: SlackAdapterType } {
  const slackAdapter = createSlackAdapter({
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    signingSecret: process.env.SLACK_SIGNING_SECRET!,
    // Tokens are resolved per webhook from user_integrations, keyed by team, so
    // there is no single `botToken` and no copy of the installations to keep in
    // sync: a workspace connected a second ago works on every instance.
    installationProvider: {
      getInstallation: async (installationId) => {
        const resolved = await resolveBotTokenForTeam(
          createAdminClient(),
          installationId,
        );
        if (!resolved) return null;
        return {
          botToken: resolved.botToken,
          ...(resolved.botUserId ? { botUserId: resolved.botUserId } : {}),
        };
      },
    },
  });

  const bot = new Chat({
    userName: "Mosaic AI",
    adapters: { slack: slackAdapter },
    state: createBotState(),
    streamingUpdateIntervalMs: 800,
    onLockConflict: "force",
    // "debug" logs every webhook payload, including message text.
    logger: process.env.NODE_ENV === "production" ? "warn" : "debug",
  });

  return { bot, slackAdapter };
}
