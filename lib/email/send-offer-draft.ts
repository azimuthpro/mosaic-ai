import type { SupabaseClient } from "@supabase/supabase-js";

import { updateOfferDraftSlackMessage } from "@/lib/email/post-offer-draft-slack";
import { sendCustomEmail } from "@/lib/email/sendgrid";
import { verifyMosaicAccess } from "@/lib/mosaics/access";
import type {
  Database,
  Json,
  OfferDraftResult,
  Tile,
  TileJobResult,
  TileJobResultUpdate,
} from "@/types/database";

type SendResult =
  | { ok: true; draft: OfferDraftResult }
  | { ok: false; error: string };

interface ApprovalContext {
  /** Optional bot token for updating the Slack draft message. If missing and
   * the draft has slack_context, we skip the update silently. */
  slackBotToken?: string;
}

/**
 * Approves and sends an offer draft via SendGrid. Idempotent: refuses to re-send
 * a draft whose status is no longer "draft". Updates the stored draft with the
 * new status (sent/failed) and refreshes the originating Slack message if there
 * is one.
 */
export async function sendOfferDraft(
  admin: SupabaseClient<Database>,
  jobId: string,
  approverUserId: string,
  context: ApprovalContext = {},
): Promise<SendResult> {
  const loaded = await loadApprovableDraft(admin, jobId, approverUserId);
  if (!loaded.ok) return loaded;
  const { result, draft } = loaded;

  const sendOutcome = await sendCustomEmail({
    to: { email: draft.recipient_email, name: draft.recipient_name },
    subject: draft.subject,
    html: draft.html,
    text: draft.text,
    from: { email: draft.from_email, name: draft.from_name },
    replyTo: draft.reply_to_email
      ? {
          email: draft.reply_to_email,
          ...(draft.reply_to_name ? { name: draft.reply_to_name } : {}),
        }
      : undefined,
  });

  const next: OfferDraftResult = sendOutcome.success
    ? { ...draft, status: "sent", sent_at: new Date().toISOString() }
    : {
        ...draft,
        status: "failed",
        sendgrid_error: sendOutcome.error || "Unknown SendGrid error",
      };

  await persistDraft(admin, result.id, next);
  await maybeUpdateSlack(next, context.slackBotToken);

  return sendOutcome.success
    ? { ok: true, draft: next }
    : { ok: false, error: next.sendgrid_error ?? "Send failed" };
}

/**
 * Marks a draft as cancelled. Idempotent like sendOfferDraft.
 */
export async function cancelOfferDraft(
  admin: SupabaseClient<Database>,
  jobId: string,
  approverUserId: string,
  context: ApprovalContext = {},
): Promise<SendResult> {
  const loaded = await loadApprovableDraft(admin, jobId, approverUserId);
  if (!loaded.ok) return loaded;
  const { result, draft } = loaded;

  const next: OfferDraftResult = {
    ...draft,
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  };
  await persistDraft(admin, result.id, next);
  await maybeUpdateSlack(next, context.slackBotToken);

  return { ok: true, draft: next };
}

/**
 * Persists the originating Slack message ts onto the draft (so future
 * updates can target it). Called right after we post the draft to Slack.
 */
export async function attachSlackMessageTs(
  admin: SupabaseClient<Database>,
  jobId: string,
  draftMessageTs: string,
): Promise<void> {
  const loaded = await loadDraft(admin, jobId);
  if (!loaded.ok) return;
  if (!loaded.draft.slack_context) return;

  const next: OfferDraftResult = {
    ...loaded.draft,
    slack_context: {
      ...loaded.draft.slack_context,
      draft_message_ts: draftMessageTs,
    },
  };
  await persistDraft(admin, loaded.result.id, next);
}

type LoadOk = {
  ok: true;
  result: TileJobResult;
  draft: OfferDraftResult;
  tile: Tile;
};
type LoadErr = { ok: false; error: string };

async function loadDraft(
  admin: SupabaseClient<Database>,
  jobId: string,
): Promise<LoadOk | LoadErr> {
  const { data: resultRow } = await admin
    .from("tile_job_results")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!resultRow) return { ok: false, error: "Offer draft not found" };

  const result = resultRow as TileJobResult;
  const draft = result.content as unknown as OfferDraftResult;
  if (!draft || typeof draft !== "object" || !("status" in draft)) {
    return { ok: false, error: "Job is not an offer draft" };
  }

  const { data: tileRow } = await admin
    .from("tiles")
    .select("*")
    .eq("id", result.tile_id)
    .maybeSingle();
  if (!tileRow) return { ok: false, error: "Tile not found" };

  return { ok: true, result, draft, tile: tileRow as Tile };
}

async function loadApprovableDraft(
  admin: SupabaseClient<Database>,
  jobId: string,
  approverUserId: string,
): Promise<LoadOk | LoadErr> {
  const loaded = await loadDraft(admin, jobId);
  if (!loaded.ok) return loaded;
  if (
    !(await verifyMosaicAccess(admin, loaded.tile.mosaic_id, approverUserId))
  ) {
    return { ok: false, error: "You don't have access to this offer." };
  }
  if (loaded.draft.status !== "draft") {
    return { ok: false, error: `Offer is already ${loaded.draft.status}` };
  }
  return loaded;
}

async function persistDraft(
  admin: SupabaseClient<Database>,
  resultId: string,
  draft: OfferDraftResult,
): Promise<void> {
  const update: TileJobResultUpdate = {
    content: draft as unknown as Json,
  };
  await admin
    .from("tile_job_results")
    .update(update as never)
    .eq("id", resultId);
}

async function maybeUpdateSlack(
  draft: OfferDraftResult,
  botToken: string | undefined,
): Promise<void> {
  const ctx = draft.slack_context;
  if (!ctx?.draft_message_ts || !botToken) return;
  await updateOfferDraftSlackMessage(
    botToken,
    ctx.channel_id,
    ctx.draft_message_ts,
    draft,
  );
}
