import { NextResponse } from "next/server";

import { getBotAndAdapter } from "@/lib/bot";
import { resolveSlackUser } from "@/lib/bot/data";
import { ensureBotInitialized } from "@/lib/bot/setup";
import { cancelOfferDraft, sendOfferDraft } from "@/lib/email/send-offer-draft";
import { verifySlackSignature } from "@/lib/slack/verify-signature";
import { createAdminClient } from "@/lib/supabase/admin";

interface SlackBlockAction {
  action_id: string;
  block_id?: string;
  value?: string;
}

interface SlackBlockActionsPayload {
  type: "block_actions";
  user: { id: string; team_id?: string };
  team?: { id?: string };
  channel?: { id?: string };
  actions: SlackBlockAction[];
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-slack-signature") ?? "";
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // Slack posts as application/x-www-form-urlencoded with a `payload` field.
  const form = new URLSearchParams(rawBody);
  const payloadRaw = form.get("payload");
  if (!payloadRaw) {
    return NextResponse.json({ error: "missing payload" }, { status: 400 });
  }

  let payload: SlackBlockActionsPayload;
  try {
    payload = JSON.parse(payloadRaw) as SlackBlockActionsPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (payload.type !== "block_actions") {
    // Other interactivity types (view_submission, shortcut, etc.) — ack & ignore.
    return new Response("", { status: 200 });
  }

  const teamId = payload.team?.id ?? payload.user.team_id ?? "";
  const admin = createAdminClient();
  await ensureBotInitialized();
  const { slackAdapter } = await getBotAndAdapter();

  const botToken = await slackAdapter
    .getInstallation(teamId)
    .then((i) => i?.botToken ?? undefined)
    .catch((err) => {
      console.error("[slack-interactivity] getInstallation failed:", err);
      return undefined;
    });

  const approverUserId = botToken
    ? await resolveSlackUser(botToken, payload.user.id)
    : null;
  if (!approverUserId) {
    // Return 200 so Slack doesn't retry; the draft message stays in place.
    console.warn(
      "[slack-interactivity] could not map slack user → mosaic user",
      payload.user.id,
    );
    return new Response("", { status: 200 });
  }

  for (const action of payload.actions ?? []) {
    const jobId = action.value;
    if (!jobId) continue;

    let handler: typeof sendOfferDraft | null = null;
    if (action.action_id === "offer.send") handler = sendOfferDraft;
    else if (action.action_id === "offer.cancel") handler = cancelOfferDraft;
    if (!handler) continue;

    try {
      const outcome = await handler(admin, jobId, approverUserId, {
        slackBotToken: botToken,
      });
      if (!outcome.ok) {
        console.warn(
          `[slack-interactivity] ${action.action_id} failed:`,
          outcome.error,
        );
      }
    } catch (err) {
      console.error(
        "[slack-interactivity] action error",
        action.action_id,
        err,
      );
    }
  }

  return new Response("", { status: 200 });
}
