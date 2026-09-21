import { after } from "next/server";

import { getBot } from "@/lib/bot/setup";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  console.log("[slack-events] POST received");
  const bot = await getBot();
  // The SDK verifies the signature, answers Slack's url_verification challenge,
  // drops duplicate deliveries and returns 200 straight away; handlers run
  // inside the waitUntil task.
  return bot.webhooks.slack(request, {
    waitUntil: (task) => after(() => task),
  });
}
