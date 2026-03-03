import { NextResponse } from "next/server";

import { addReaction } from "@/lib/slack/client";
import { resolveTokenForTeam } from "@/lib/slack/events/monitor-check";
import { verifySlackSignature } from "@/lib/slack/verify-signature";
import { createAdminClient } from "@/lib/supabase/admin";

interface SlackEvent {
  type: string;
  subtype?: string;
  bot_id?: string;
  text?: string;
  channel?: string;
  ts?: string;
}

interface SlackEventPayload {
  type: string;
  token?: string;
  challenge?: string;
  team_id?: string;
  event?: SlackEvent;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  try {
    if (!verifySlackSignature(body, timestamp, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  } catch {
    return NextResponse.json(
      { error: "Signature verification not configured" },
      { status: 500 },
    );
  }

  const payload = JSON.parse(body) as SlackEventPayload;

  console.log("[slack-events] received", {
    type: payload.type,
    eventType: payload.event?.type,
    subtype: payload.event?.subtype,
    hasBotId: !!payload.event?.bot_id,
    text: payload.event?.text?.slice(0, 100),
    channel: payload.event?.channel,
  });

  // Handle Slack URL verification challenge (one-time setup)
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === "event_callback" && payload.event) {
    const { event, team_id } = payload;

    const isUserMessage =
      event.type === "message" &&
      !event.subtype &&
      !event.bot_id &&
      event.text &&
      event.channel &&
      event.ts &&
      team_id;

    if (isUserMessage) {
      // Extract all @mentions from the message text
      const mentionedIds = Array.from(
        event.text!.matchAll(/<@([A-Z0-9]+)>/g),
        (m) => m[1],
      );

      if (mentionedIds.length > 0) {
        try {
          await reactIfMosaicBotMentioned(
            team_id!,
            event.channel!,
            event.ts!,
            mentionedIds,
          );
        } catch (err) {
          console.error("[slack-events] reactIfMosaicBotMentioned error:", err);
        }
      }
    }
  }

  return new Response(null, { status: 200 });
}

/**
 * Resolves a token for the team, checks if any mentioned user is the Mosaic bot,
 * and adds an "eyes" reaction if so.
 */
async function reactIfMosaicBotMentioned(
  teamId: string,
  channel: string,
  messageTs: string,
  mentionedIds: string[],
): Promise<void> {
  console.log("[slack-events] checking mentions", {
    teamId,
    channel,
    mentionedIds,
  });

  const admin = createAdminClient();

  const token = await resolveTokenForTeam(admin, teamId);
  if (!token) {
    console.log("[slack-events] no token for team, skipping", { teamId });
    return;
  }

  const mentioned = await includesMosaicBot(token, mentionedIds);
  if (!mentioned) {
    console.log("[slack-events] no Mosaic bot in mentions, skipping");
    return;
  }

  await addReaction(token, channel, messageTs, "eyes");
  console.log("[slack-events] reaction added", { channel, messageTs });
}

interface SlackUserInfoResponse {
  ok: boolean;
  user?: { is_bot?: boolean; real_name?: string; name?: string };
}

/**
 * Checks if any of the mentioned user IDs is a bot whose name contains "Mosaic".
 */
async function includesMosaicBot(
  token: string,
  userIds: string[],
): Promise<boolean> {
  for (const userId of userIds) {
    try {
      const res = await fetch(
        `https://slack.com/api/users.info?user=${userId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = (await res.json()) as SlackUserInfoResponse;
      const user = data.user;
      if (
        data.ok &&
        user?.is_bot &&
        /mosaic/i.test(user.real_name ?? user.name ?? "")
      ) {
        return true;
      }
    } catch {
      // skip unresolvable users
    }
  }
  return false;
}
