import { after } from "next/server";

import { getBotAndAdapter } from "@/lib/bot";
import { ensureBotInitialized } from "@/lib/bot/setup";

export async function POST(request: Request): Promise<Response> {
  console.log("[slack-events] POST received");
  await ensureBotInitialized();
  const { bot } = await getBotAndAdapter();
  return bot.webhooks.slack(request, {
    waitUntil: (task) => after(() => task),
  });
}
