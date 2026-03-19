import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { Chat } from "chat";

const slackAdapter = createSlackAdapter({
  clientId: process.env.SLACK_CLIENT_ID!,
  clientSecret: process.env.SLACK_CLIENT_SECRET!,
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const state = createMemoryState();

const bot = new Chat({
  userName: "Mosaic AI",
  adapters: { slack: slackAdapter },
  state,
  streamingUpdateIntervalMs: 800,
  onLockConflict: "force",
});

export { bot, slackAdapter };
