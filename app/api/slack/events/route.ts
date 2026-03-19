import { after } from "next/server";

import { bot } from "@/lib/bot";
import { ensureBotInitialized } from "@/lib/bot/setup";

export async function POST(request: Request): Promise<Response> {
  await ensureBotInitialized();
  return bot.webhooks.slack(request, {
    waitUntil: (task) => after(() => task),
  });
}
