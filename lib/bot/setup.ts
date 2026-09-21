import type { Chat } from "chat";

import { registerHandlers } from "./handlers";
import { createBot } from "./index";

let ready: Promise<Chat> | null = null;

async function initialize(): Promise<Chat> {
  const { bot, slackAdapter } = createBot();
  registerHandlers(bot, slackAdapter);
  await bot.initialize();
  console.log("[bot] initialized");
  return bot;
}

/**
 * Returns the initialized bot, creating it on first use.
 *
 * The promise is cached rather than a boolean flag: a flag set before the
 * awaits lets a second webhook arriving during a cold start skip initialization
 * and reach a bot with no handlers registered, so that event is dropped without
 * an error. A failed init clears the cache so the next request retries.
 */
export function getBot(): Promise<Chat> {
  ready ??= initialize().catch((err: unknown) => {
    ready = null;
    throw err;
  });
  return ready;
}
