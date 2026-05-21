import type { SupabaseClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { z } from "zod";

import { formatDateGrounding } from "@/lib/ai/date-grounding";
import { flashModel } from "@/lib/ai/models";
import { getLanguageInstruction } from "@/lib/constants/languages";
import { getMosaicTimezone } from "@/lib/mosaics/timezone";
import type {
  Database,
  LanguageCode,
  OfferDraftResult,
  OfferDraftSlackContext,
  OfferSenderConfig,
} from "@/types/database";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const offerDraftSchema = z.object({
  recipient_email: z
    .string()
    .describe("Recipient's email address extracted from the input."),
  recipient_name: z
    .string()
    .optional()
    .describe("Recipient's name if mentioned."),
  subject: z
    .string()
    .describe(
      "Subject line for the email — natural-language, in the same language as the offer body.",
    ),
  personalized_html: z
    .string()
    .describe(
      "The full personalized HTML email body. Start from the provided HTML template and apply the user's modification instructions. Output ONLY valid HTML, no commentary.",
    ),
  plain_text: z
    .string()
    .describe("Plain-text fallback version of the offer body (no HTML tags)."),
  modification_notes: z
    .string()
    .optional()
    .describe("Short 1-2 sentence note on what you changed and why."),
});

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

  const sections: string[] = [];
  const cleanedComment = comment ? normalizeSlackEmailLinks(comment) : null;
  if (cleanedComment?.trim()) {
    sections.push(`# USER INSTRUCTION\n${cleanedComment.trim()}`);
  }
  fetchedContent.forEach((c, i) => {
    sections.push(`# CONNECTION ${i + 1}\n${c}`);
  });

  const timezone = await getMosaicTimezone(admin, tileId);
  const prompt = buildOfferPrompt({
    template: config.html_template,
    extraInstructions: systemPrompt,
    fromName,
    fromEmail,
    language,
    timezone,
    sections,
  });

  let draftFields: z.infer<typeof offerDraftSchema>;
  try {
    const result = await generateObject({
      model: flashModel,
      schema: offerDraftSchema,
      prompt,
      maxOutputTokens: 32_000,
    });
    draftFields = result.object;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[offer-sender] generateObject failed:", message);
    throw new Error(`AI failed to generate the personalized offer: ${message}`);
  }

  const recipient_email = draftFields.recipient_email.trim();
  const subject = draftFields.subject.trim();
  const personalized_html = draftFields.personalized_html;

  if (!EMAIL_REGEX.test(recipient_email)) {
    throw new Error(
      `Extracted recipient email "${recipient_email}" is not a valid email address`,
    );
  }
  if (!subject || !personalized_html.trim()) {
    throw new Error(
      `AI response missing required fields (subject=${subject ? "ok" : "empty"}, html=${personalized_html.trim() ? "ok" : "empty"})`,
    );
  }

  const draft: OfferDraftResult = {
    status: "draft",
    recipient_email,
    recipient_name: draftFields.recipient_name?.trim() || undefined,
    subject,
    html: personalized_html,
    text: draftFields.plain_text?.trim() || stripHtml(personalized_html),
    from_email: fromEmail,
    from_name: fromName,
    reply_to_email: replyToEmail,
    reply_to_name: replyToName,
    ai_notes: draftFields.modification_notes?.trim() || undefined,
    slack_context: slackContext,
  };

  const slackSummary = `*Offer draft ready*\nTo: ${draft.recipient_email}\nSubject: ${draft.subject}`;

  return { jobResultContent: draft, slackSummary };
}

/**
 * Slack renders email addresses as `<mailto:foo@bar.com|foo@bar.com>`. The
 * chat-sdk's text extraction strips the angle brackets but leaves the
 * `mailto:foo@bar.com|foo@bar.com` payload, which can confuse the AI when
 * it tries to extract a plain email. Collapse these to bare addresses.
 */
function normalizeSlackEmailLinks(text: string): string {
  return text
    .replace(/<mailto:([^|<>\s]+)(?:\|[^<>]+)?>/g, "$1")
    .replace(/\bmailto:([^\s|<>]+)\|[^\s<>]+/g, "$1")
    .replace(/\bmailto:([^\s|<>]+)/g, "$1");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface OfferPromptArgs {
  template: string;
  extraInstructions: string | null;
  fromName: string;
  fromEmail: string;
  language: LanguageCode;
  timezone?: string;
  sections: string[];
}

function buildOfferPrompt(args: OfferPromptArgs): string {
  const {
    template,
    extraInstructions,
    fromName,
    fromEmail,
    language,
    timezone,
    sections,
  } = args;
  const extra = extraInstructions?.trim()
    ? `Additional rules from the tile owner:\n${extraInstructions.trim()}\n\n`
    : "";
  const languageInstruction = getLanguageInstruction(language);
  const dateGrounding = formatDateGrounding(timezone);
  const content = sections.length
    ? sections.join("\n\n---\n\n")
    : "(no additional context provided)";

  return `${dateGrounding}

You are preparing a personalized offer email on behalf of ${fromName} <${fromEmail}>.

Your job:
1. Read the user's instruction and any connection context.
2. Extract the recipient's email address (and name if available).
3. Take the HTML template below and personalize it according to the user's instructions: replace placeholders, adjust copy, mention specific terms the user asked for, etc.
4. Preserve the visual structure (tags, classes, inline styles, links) of the template — do NOT replace it with a different design.
5. Produce a subject line that matches the offer content and the recipient's language.
6. Produce a plain-text fallback (no HTML tags).

${extra}${languageInstruction ? `${languageInstruction}\n\n` : ""}HTML TEMPLATE TO PERSONALIZE (use this as the starting point for personalized_html):

\`\`\`html
${template}
\`\`\`

User-provided context:

${content}`;
}
