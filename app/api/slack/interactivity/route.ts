import { after, NextResponse } from "next/server";

import { resolveSlackUser } from "@/lib/bot/data";
import { cancelOfferDraft, sendOfferDraft } from "@/lib/email/send-offer-draft";
import { postEphemeralResponse } from "@/lib/slack/client";
import { resolveBotTokenForTeam } from "@/lib/slack/integration";
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
  response_url?: string;
  actions: SlackBlockAction[];
}

/**
 * Approval buttons posted by the offer_sender tile, keyed by Block Kit action.
 * A Map, not an object literal: an unknown action_id must miss, and an object
 * would resolve names like "constructor" off the prototype chain.
 */
const OFFER_ACTIONS = new Map<string, typeof sendOfferDraft>([
  ["offer.send", sendOfferDraft],
  ["offer.cancel", cancelOfferDraft],
]);

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

  // Acknowledge inside Slack's 3-second window, then do the work. Sending the
  // email before responding makes Slack show the user "operation timed out",
  // and the natural reaction to that is to click Approve again.
  after(() => handleBlockActions(payload));
  return new Response("", { status: 200 });
}

async function handleBlockActions(
  payload: SlackBlockActionsPayload,
): Promise<void> {
  // Answers the clicker privately. Needs no token, and works even where the bot
  // cannot post; a click that silently does nothing is the worst outcome.
  const reply = async (text: string): Promise<void> => {
    if (!payload.response_url) return;
    await postEphemeralResponse(payload.response_url, text).catch((err) =>
      console.error("[slack-interactivity] response_url failed:", err),
    );
  };

  try {
    const teamId = payload.team?.id ?? payload.user.team_id ?? "";
    const admin = createAdminClient();

    const installation = await resolveBotTokenForTeam(admin, teamId);
    if (!installation) {
      console.error("[slack-interactivity] no integration for team", teamId);
      return;
    }

    const approverUserId = await resolveSlackUser(
      installation.botToken,
      teamId,
      payload.user.id,
    );
    if (!approverUserId) {
      console.warn(
        "[slack-interactivity] could not map slack user → mosaic user",
        payload.user.id,
      );
      await reply(
        "I couldn't match your Slack account to a Mosaic AI user, so I can't act on that.",
      );
      return;
    }

    for (const action of payload.actions ?? []) {
      const jobId = action.value;
      const handler = OFFER_ACTIONS.get(action.action_id);
      if (!jobId || !handler) continue;

      try {
        const outcome = await handler(admin, jobId, approverUserId, {
          slackBotToken: installation.botToken,
        });
        if (!outcome.ok) {
          console.warn(
            `[slack-interactivity] ${action.action_id} failed:`,
            outcome.error,
          );
          await reply(outcome.error);
        }
      } catch (err) {
        console.error(
          "[slack-interactivity] action error",
          action.action_id,
          err,
        );
        await reply("Something went wrong handling that click.");
      }
    }
  } catch (err) {
    console.error("[slack-interactivity] handler error:", err);
  }
}
