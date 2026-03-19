import { after } from "next/server";

import { bot } from "@/lib/bot";
import { ensureBotInitialized } from "@/lib/bot/setup";

export async function POST(request: Request): Promise<Response> {
  console.log("[slack-events] POST received");
  await ensureBotInitialized();
  const response = await bot.webhooks.slack(request, {
    waitUntil: (task) => {
      console.log("[slack-events] waitUntil called, registering after()");
      after(async () => {
        try {
          await task;
          console.log("[slack-events] after() task completed");
        } catch (err) {
          console.error("[slack-events] after() task failed:", err);
        }
      });
    },
  });
  console.log("[slack-events] response status:", response.status);
  return response;
}
