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

// Type helper for RPC calls (since functions are created dynamically via migration)
type RpcClient = {
  rpc: <T>(
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: Error | null }>;
};

/** Row returned by the claim_offer_draft migration function. */
interface ClaimedDraftRow {
  id: string;
  tile_id: string;
  job_id: string;
  content: Json;
}

interface ApprovalContext {
  /** Optional bot token for updating the Slack draft message. If missing and
   * the draft has slack_context, we skip the update silently. */
  slackBotToken?: string;
}

/**
 * Approves and sends an offer draft via SendGrid.
 *
 * Idempotent by claim: the draft is moved from "draft" to "sending" in one
 * conditional UPDATE, and only the caller that wins that update sends. Checking
 * the status in TypeScript and sending afterwards let two clicks — which a
 * Slack timeout actively invites — both pass the check and both send.
 */
export async function sendOfferDraft(
  admin: SupabaseClient<Database>,
  jobId: string,
  approverUserId: string,
  context: ApprovalContext = {},
): Promise<SendResult> {
  const loaded = await claimDraft(admin, jobId, approverUserId, "sending");
  if (!loaded.ok) return loaded;
  const { result, draft } = loaded;

  // The draft is now claimed, so every exit from here must write a terminal
  // status — otherwise an unexpected throw leaves it stuck in "sending", with
  // no buttons and no way to retry.
  let sendOutcome: { success: boolean; error?: string };
  try {
    sendOutcome = await sendCustomEmail({
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
      bcc: draft.bcc_email ? { email: draft.bcc_email } : undefined,
    });
  } catch (err) {
    sendOutcome = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

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
 * Marks a draft as cancelled. Idempotent like sendOfferDraft: cancelling has no
 * side effect, so the claim goes straight to the terminal status.
 */
export async function cancelOfferDraft(
  admin: SupabaseClient<Database>,
  jobId: string,
  approverUserId: string,
  context: ApprovalContext = {},
): Promise<SendResult> {
  const loaded = await claimDraft(admin, jobId, approverUserId, "cancelled");
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
  // Writes just this one field server-side. Loading the draft and writing it
  // back whole could restore a stale "draft" status over a claim made in
  // between, which would let the email be sent twice.
  const rpcClient = admin as unknown as RpcClient;
  const { error } = await rpcClient.rpc<null>("attach_offer_slack_ts", {
    p_job_id: jobId,
    p_ts: draftMessageTs,
  });
  if (error) {
    console.error("[offer] attach_offer_slack_ts failed:", error.message);
  }
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

/**
 * Takes exclusive ownership of a draft by moving its status out of "draft" in a
 * single conditional UPDATE. Returns an error when another caller got there
 * first, so the side effect runs exactly once.
 *
 * Access is checked before the claim: an outsider's click must not consume the
 * claim and lock out the people who can actually approve.
 */
async function claimDraft(
  admin: SupabaseClient<Database>,
  jobId: string,
  approverUserId: string,
  nextStatus: "sending" | "cancelled",
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

  const rpcClient = admin as unknown as RpcClient;
  const { data, error } = await rpcClient.rpc<ClaimedDraftRow[]>(
    "claim_offer_draft",
    { p_job_id: jobId, p_next_status: nextStatus },
  );

  if (error) {
    console.error("[offer] claim_offer_draft failed:", error.message);
    return { ok: false, error: "Could not lock the offer draft for sending." };
  }

  const claimed = data?.[0];
  if (!claimed) {
    // Lost the race: someone else already claimed or decided this draft.
    const current = await loadDraft(admin, jobId);
    const status = current.ok ? current.draft.status : "already handled";
    return { ok: false, error: `Offer is already ${status}` };
  }

  return {
    ok: true,
    result: { ...loaded.result, id: claimed.id },
    // Keep the pre-claim draft: the caller writes the terminal status itself.
    draft: loaded.draft,
    tile: loaded.tile,
  };
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
