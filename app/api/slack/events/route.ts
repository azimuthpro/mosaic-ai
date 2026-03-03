import { NextResponse } from "next/server";

import { addReaction } from "@/lib/slack/client";
import {
  isChannelMonitored,
  resolveTokenForTeam,
} from "@/lib/slack/events/monitor-check";
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

    if (isUserMessage && /mosaic/i.test(event.text!)) {
      try {
        await handleMosaicMention(team_id!, event.channel!, event.ts!);
      } catch (err) {
        console.error("[slack-events] handleMosaicMention error:", err);
      }
    }
  }

  return new Response(null, { status: 200 });
}

async function handleMosaicMention(
  teamId: string,
  channel: string,
  messageTs: string,
): Promise<void> {
  console.log("[slack-events] mention detected", { teamId, channel, messageTs });

  const admin = createAdminClient();

  const monitored = await isChannelMonitored(admin, channel);
  if (!monitored) {
    console.log("[slack-events] channel not monitored, skipping", { channel });
    return;
  }

  const token = await resolveTokenForTeam(admin, teamId);
  if (!token) {
    console.log("[slack-events] no token for team, skipping", { teamId });
    return;
  }

  await addReaction(token, channel, messageTs, "eyes");
  console.log("[slack-events] reaction added", { channel, messageTs });
}
