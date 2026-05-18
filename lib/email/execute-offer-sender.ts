import type { SupabaseClient } from "@supabase/supabase-js";

import { analyzeContent } from "@/lib/ai/gemini";
import { getMosaicTimezone } from "@/lib/mosaics/timezone";
import type {
  Database,
  Json,
  LanguageCode,
  OfferDraftResult,
  OfferDraftSlackContext,
  OfferSenderConfig,
} from "@/types/database";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const OFFER_OUTPUT_SCHEMA = `z.object({
  recipient_email: z.string().email().describe("Recipient's email address extracted from the input"),
  recipient_name: z.string().optional().describe("Recipient's name if mentioned"),
  subject: z.string().describe("Subject line for the email — natural-language, in the same language as the offer body"),
  personalized_html: z.string().describe("The full personalized HTML email body. Start from the provided HTML template and apply the user's modification instructions. Output ONLY valid HTML, no commentary."),
  plain_text: z.string().describe("Plain-text fallback version of the offer body (no HTML tags)"),
  modification_notes: z.string().optional().describe("Short 1-2 sentence note on what you changed in the template and why")
})`;

export interface OfferSenderExecutionResult {
  jobResultContent: OfferDraftResult;
  slackSummary: string;
}

/**
 * Executes an offer_sender tile: runs the user's instructions + connection content
 * through AI to personalize the HTML template, then returns a *draft* result.
 * Sending is a separate explicit step (sendOfferDraft) triggered by user approval.
 */
export async function executeOfferSender(
  tileId: string,
  fetchedContent: string[],
  comment: string | null,
  systemPrompt: string | null,
  config: OfferSenderConfig,
  language: LanguageCode,
  admin: SupabaseClient<Database>,
  slackContext?: OfferDraftSlackContext,
): Promise<OfferSenderExecutionResult> {
  if (!config.html_template?.trim()) {
    throw new Error("Offer Sender tile has no HTML template configured");
  }
  if (!comment?.trim() && fetchedContent.length === 0) {
    throw new Error(
      "Offer Sender needs either a comment, a Slack thread, or connection input to know who to send to",
    );
  }

  const fromEmail =
    config.from_email?.trim() ||
    process.env.SENDGRID_FROM_EMAIL ||
    "noreply@mosaic-ai.app";
  const fromName =
    config.from_name?.trim() || process.env.SENDGRID_FROM_NAME || "Mosaic AI";
  const replyToEmail = config.reply_to_email?.trim() || undefined;
  const replyToName = config.reply_to_name?.trim() || undefined;

  // Inputs are passed as the analyzeContent scrapedContent array so the
  // existing prompt structure renders them under the "content to analyze" heading.
  const inputs: string[] = [];
  if (comment?.trim()) {
    inputs.push(`# USER INSTRUCTION\n${comment.trim()}`);
  }
  fetchedContent.forEach((c, i) => {
    inputs.push(`# CONNECTION ${i + 1}\n${c}`);
  });

  const analysis = await analyzeContent(
    inputs,
    buildOfferPrompt(config.html_template, systemPrompt, fromName, fromEmail),
    "json",
    language,
    OFFER_OUTPUT_SCHEMA,
    await getMosaicTimezone(admin, tileId),
  );

  if (!analysis.success) {
    throw new Error(
      analysis.error || "AI failed to generate the personalized offer",
    );
  }

  const parsed = parseOfferDraft(analysis.content);
  if (!parsed) {
    throw new Error(
      "AI response did not contain a valid offer draft (recipient_email, subject, personalized_html, plain_text required)",
    );
  }
  if (!EMAIL_REGEX.test(parsed.recipient_email)) {
    throw new Error(
      `Extracted recipient email "${parsed.recipient_email}" is not a valid email address`,
    );
  }

  const draft: OfferDraftResult = {
    status: "draft",
    recipient_email: parsed.recipient_email,
    recipient_name: parsed.recipient_name,
    subject: parsed.subject,
    html: parsed.personalized_html,
    text: parsed.plain_text,
    from_email: fromEmail,
    from_name: fromName,
    reply_to_email: replyToEmail,
    reply_to_name: replyToName,
    ai_notes: parsed.modification_notes,
    slack_context: slackContext,
  };

  const slackSummary = `*Offer draft ready*\nTo: ${draft.recipient_email}\nSubject: ${draft.subject}`;

  return { jobResultContent: draft, slackSummary };
}

interface ParsedOfferDraft {
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  personalized_html: string;
  plain_text: string;
  modification_notes?: string;
}

function parseOfferDraft(content: Json): ParsedOfferDraft | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const obj = content as Record<string, Json>;
  const str = (k: string): string =>
    typeof obj[k] === "string" ? (obj[k] as string) : "";

  const recipient_email = str("recipient_email").trim();
  const subject = str("subject").trim();
  const personalized_html = str("personalized_html");
  if (!recipient_email || !subject || !personalized_html) return null;

  const recipient_name = str("recipient_name").trim();
  const modification_notes = str("modification_notes");

  return {
    recipient_email,
    recipient_name: recipient_name || undefined,
    subject,
    personalized_html,
    plain_text: str("plain_text") || stripHtml(personalized_html),
    modification_notes: modification_notes || undefined,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOfferPrompt(
  template: string,
  extraInstructions: string | null,
  fromName: string,
  fromEmail: string,
): string {
  const extra = extraInstructions?.trim()
    ? `Additional rules from the tile owner:\n${extraInstructions.trim()}\n\n`
    : "";

  return `You are preparing a personalized offer email on behalf of ${fromName} <${fromEmail}>.

Your job:
1. Read the user's instruction and any connection context.
2. Extract the recipient's email address (and name if available).
3. Take the HTML template below and personalize it according to the user's instructions: replace placeholders, adjust copy, mention specific terms the user asked for, etc.
4. Preserve the visual structure (tags, classes, inline styles, links) of the template — do NOT replace it with a different design.
5. Produce a subject line that matches the offer content and the recipient's language.
6. Produce a plain-text fallback (no HTML).

${extra}HTML TEMPLATE TO PERSONALIZE (use this as the starting point for personalized_html):

\`\`\`html
${template}
\`\`\`

Return JSON only.`;
}
