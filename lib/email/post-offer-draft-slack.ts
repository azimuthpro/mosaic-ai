import { postBlocks, updateMessage } from "@/lib/slack/client";
import type { OfferDraftResult } from "@/types/database";

const PREVIEW_MAX = 1500;

/**
 * Posts the AI-generated draft into the originating Slack thread with
 * "Approve & Send" / "Cancel" buttons. Returns the message ts so the caller
 * can persist it on the draft for later updates.
 */
export async function postOfferDraftToSlack(
  botToken: string,
  channelId: string,
  threadTs: string,
  jobId: string,
  draft: OfferDraftResult,
): Promise<{ ts: string } | null> {
  const previewText =
    draft.text.length > PREVIEW_MAX
      ? draft.text.slice(0, PREVIEW_MAX) + "\n…(truncated)"
      : draft.text;

  const recipientLabel = draft.recipient_name
    ? `${draft.recipient_email} (${draft.recipient_name})`
    : draft.recipient_email;
  const headerText = `*Offer draft ready*\n*To:* ${recipientLabel}\n*From:* ${draft.from_name} <${draft.from_email}>\n*Subject:* ${draft.subject}`;

  const blocks: Record<string, unknown>[] = [
    { type: "section", text: { type: "mrkdwn", text: headerText } },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: `\`\`\`${previewText}\`\`\`` },
    },
  ];

  if (draft.ai_notes) {
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `_AI notes:_ ${draft.ai_notes}` }],
    });
  }

  blocks.push({
    type: "actions",
    block_id: `offer_actions:${jobId}`,
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "Approve & Send", emoji: true },
        style: "primary",
        action_id: "offer.send",
        value: jobId,
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Cancel", emoji: true },
        style: "danger",
        action_id: "offer.cancel",
        value: jobId,
      },
    ],
  });

  return postBlocks(botToken, channelId, blocks, headerText, { threadTs });
}

/**
 * Replaces the draft message with a final status (after the user clicks
 * Approve/Cancel) so the buttons can no longer be clicked.
 */
export async function updateOfferDraftSlackMessage(
  botToken: string,
  channelId: string,
  ts: string,
  draft: OfferDraftResult,
): Promise<void> {
  const headline = buildStatusHeadline(draft);
  const blocks: Record<string, unknown>[] = [
    { type: "section", text: { type: "mrkdwn", text: headline } },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `Subject: ${draft.subject}` }],
    },
  ];

  try {
    await updateMessage(botToken, channelId, ts, blocks, headline);
  } catch (err) {
    console.error("[offer] failed to update Slack draft message:", err);
  }
}

function buildStatusHeadline(draft: OfferDraftResult): string {
  switch (draft.status) {
    case "sent":
      return `:white_check_mark: *Offer sent to ${draft.recipient_email}*`;
    case "cancelled":
      return `:no_entry_sign: *Offer cancelled* — ${draft.recipient_email}`;
    case "failed":
      return `:x: *Offer failed* — ${draft.sendgrid_error ?? "unknown error"}`;
    default:
      return `*Offer status:* ${draft.status}`;
  }
}
