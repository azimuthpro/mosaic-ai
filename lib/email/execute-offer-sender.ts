import type { SupabaseClient } from "@supabase/supabase-js";
import { generateObject, generateText } from "ai";
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

const offerMetadataSchema = z.object({
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
  const bccEmail = config.bcc_email?.trim() || undefined;

  const sections: string[] = [];
  const cleanedComment = comment ? normalizeSlackEmailLinks(comment) : null;
  if (cleanedComment?.trim()) {
    sections.push(`# USER INSTRUCTION\n${cleanedComment.trim()}`);
  }
  fetchedContent.forEach((c, i) => {
    sections.push(`# CONNECTION ${i + 1}\n${c}`);
  });

  const timezone = await getMosaicTimezone(admin, tileId);
  const metadataPrompt = buildMetadataPrompt({
    fromName,
    fromEmail,
    language,
    timezone,
    sections,
  });
  const htmlPrompt = buildHtmlPrompt({
    template: config.html_template,
    extraInstructions: systemPrompt,
    fromName,
    fromEmail,
    language,
    timezone,
    sections,
  });

  let metadata: z.infer<typeof offerMetadataSchema>;
  let personalizedHtmlRaw: string;
  try {
    const [meta, html] = await Promise.all([
      generateObject({
        model: flashModel,
        schema: offerMetadataSchema,
        prompt: metadataPrompt,
        maxOutputTokens: 2_000,
      }),
      generateText({
        model: flashModel,
        prompt: htmlPrompt,
        maxOutputTokens: 32_000,
      }),
    ]);
    metadata = meta.object;
    personalizedHtmlRaw = html.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[offer-sender] AI generation failed:", message);
    throw new Error(`AI failed to generate the personalized offer: ${message}`);
  }

  const personalized_html = stripCodeFences(personalizedHtmlRaw);
  const recipient_email = metadata.recipient_email.trim();
  const subject = metadata.subject.trim();

  if (!EMAIL_REGEX.test(recipient_email)) {
    throw new Error(
      `Extracted recipient email "${recipient_email}" is not a valid email address`,
    );
  }
  if (!subject || !personalized_html.trim()) {
    console.error("[offer-sender] empty AI output", {
      subject_len: subject.length,
      html_len: personalized_html.length,
      html_preview: personalized_html.slice(0, 300),
    });
    throw new Error(
      `AI response missing required fields (subject=${subject ? "ok" : "empty"}, html=${personalized_html.trim() ? "ok" : "empty"})`,
    );
  }

  const draft: OfferDraftResult = {
    status: "draft",
    recipient_email,
    recipient_name: metadata.recipient_name?.trim() || undefined,
    subject,
    html: personalized_html,
    text: stripHtml(personalized_html),
    from_email: fromEmail,
    from_name: fromName,
    reply_to_email: replyToEmail,
    reply_to_name: replyToName,
    bcc_email: bccEmail,
    ai_notes: metadata.modification_notes?.trim() || undefined,
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

function stripCodeFences(text: string): string {
  const match = text.match(/^```\w*\n?([\s\S]*?)```$/);
  return (match?.[1] ?? text).trim();
}

interface MetadataPromptArgs {
  fromName: string;
  fromEmail: string;
  language: LanguageCode;
  timezone?: string;
  sections: string[];
}

function buildMetadataPrompt(args: MetadataPromptArgs): string {
  const { fromName, fromEmail, language, timezone, sections } = args;
  const languageInstruction = getLanguageInstruction(language);
  const dateGrounding = formatDateGrounding(timezone);
  const content = sections.length
    ? sections.join("\n\n---\n\n")
    : "(no additional context provided)";

  return `${dateGrounding}

You are extracting metadata for a personalized offer email being prepared on behalf of ${fromName} <${fromEmail}>.

From the user-provided context below, extract:
1. recipient_email — the email address the offer should go to.
2. recipient_name — the recipient's name, if mentioned.
3. subject — a natural-language subject line that matches the offer content and the recipient's language.
4. modification_notes — a short 1-2 sentence note describing the offer (what's tailored to whom).

${languageInstruction ? `${languageInstruction}\n\n` : ""}User-provided context:

${content}`;
}

interface HtmlPromptArgs {
  template: string;
  extraInstructions: string | null;
  fromName: string;
  fromEmail: string;
  language: LanguageCode;
  timezone?: string;
  sections: string[];
}

function buildHtmlPrompt(args: HtmlPromptArgs): string {
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

You are personalizing an HTML offer email on behalf of ${fromName} <${fromEmail}>.

Your job:
1. Take the HTML template below and personalize it according to the user's instructions and connection context: replace placeholders, adjust copy, mention specific terms the user asked for.
2. Preserve the visual structure (tags, classes, inline styles, links) of the template — do NOT replace it with a different design.
3. Output the COMPLETE personalized HTML, starting at <!DOCTYPE> (or the template's first tag) and ending at </html>. Do not truncate or shorten.

${extra}${languageInstruction ? `${languageInstruction}\n\n` : ""}HTML TEMPLATE TO PERSONALIZE:

\`\`\`html
${template}
\`\`\`

User-provided context:

${content}

Output ONLY the personalized HTML. No JSON, no markdown code fences, no commentary before or after.`;
}
