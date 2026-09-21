import type { SupabaseClient } from "@supabase/supabase-js";

import { summarizeContent } from "@/lib/ai/gemini";
import { postMessage } from "@/lib/slack/client";
import { resolveSlackToken } from "@/lib/slack/integration";
import type { Database, Json, Tile } from "@/types/database";

/** Well-known keys that commonly hold the main text in tile result objects. */
const TEXT_KEYS = ["text", "content", "summary", "result", "message"] as const;

/**
 * Extracts a plain-text string from tile result content (which may be
 * a raw string, a `{ text: "..." }` wrapper, an array, etc.).
 */
function extractTextFromContent(content: Json): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content.map((item) => `- ${String(item)}`).join("\n");
  }

  if (content !== null && typeof content === "object") {
    const obj = content as Record<string, Json>;

    for (const key of TEXT_KEYS) {
      const value = obj[key];
      if (typeof value === "string" && value.length > 0) return value;
    }

    const values = Object.values(obj);
    if (values.length === 1 && typeof values[0] === "string") {
      return values[0] as string;
    }
  }

  return JSON.stringify(content, null, 2);
}

/**
 * Converts standard markdown to Slack mrkdwn format.
 *
 * Headers become bold, `**bold**` becomes `*bold*`, `*italic*` becomes
 * `_italic_`, links become `<url|text>`, tables become code blocks,
 * and code blocks/inline code are preserved unchanged.
 *
 * Every finished conversion is parked behind a `\0n\0` placeholder instead of
 * being written back into the text. Rewriting in place makes the passes feed
 * each other: converting `**bold**` to `*bold*` leaves a single-asterisk pair
 * for the italic pass to turn into `_bold_`, and a bold heading came out as
 * literal `**Title**`.
 */
export function markdownToSlackMrkdwn(text: string): string {
  const parked: string[] = [];
  const park = (value: string): string => {
    parked.push(value);
    return `\u0000${parked.length - 1}\u0000`;
  };

  // Protect code blocks and inline code from transformation
  let result = text.replace(/```[\s\S]*?```/g, park);
  result = result.replace(/`[^`\n]+`/g, park);

  // Split lines where non-table text runs into a table row
  result = result.replace(
    /^([^|\n]+[^|\s\n])\s*(\|(?:[^|\n]+\|)+)\s*$/gm,
    "$1\n$2",
  );

  // Tables become monospace code blocks in Slack — Slack has no table markup
  result = wrapTablesInCodeBlocks(result, park);

  // Convert markdown bullet markers (* ) to Unicode bullets (before italic/bold)
  result = result.replace(/^(\s*)\*(\s+\S)/gm, "$1•$2");

  // Convert horizontal rules to visual separator
  result = result.replace(/^-{3,}\s*$/gm, "───────────────────");
  result = result.replace(/^\*{3,}\s*$/gm, "───────────────────");

  // Links: [text](url) -> <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) =>
    park(`<${url}|${label}>`),
  );

  // Headers become bold. Any inner ** is dropped so "# **Title**" is not
  // double-wrapped into literal asterisks.
  result = result.replace(/^#{1,6}\s+(.+?)\s*#*$/gm, (_m, title: string) =>
    park(`*${title.replace(/\*\*/g, "")}*`),
  );

  // Order matters: ***bold italic*** before **bold** before *italic*
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, (_m, t) => park(`*_${t}_*`));
  result = result.replace(/\*\*(.+?)\*\*/g, (_m, t) => park(`*${t}*`));
  // Requires non-space just inside the asterisks, so "2 * 3 * 4" is left alone
  result = result.replace(
    /(?<![*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])/g,
    "_$1_",
  );

  result = result.replace(/~~(.+?)~~/g, "~$1~");

  // Restore protected content. Placeholders nest (a link inside a heading),
  // so keep going until nothing is left to replace.
  const placeholder = /\u0000(\d+)\u0000/g;
  while (placeholder.test(result)) {
    result = result.replace(
      placeholder,
      (_m, index: string) => parked[Number(index)] ?? "",
    );
  }

  return result;
}

/** Wraps consecutive pipe-delimited table lines in code block fences. */
function wrapTablesInCodeBlocks(
  text: string,
  park: (value: string) => string,
): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let table: string[] = [];

  const flush = () => {
    if (table.length === 0) return;
    out.push(park("```\n" + table.join("\n") + "\n```"));
    table = [];
  };

  for (const line of lines) {
    if (/^\s*\|.+\|\s*$/.test(line)) {
      table.push(line.trim());
    } else {
      flush();
      out.push(line);
    }
  }
  flush();
  return out.join("\n");
}

/**
 * Delivers a tile job result to a Slack channel if configured.
 * Fire-and-forget: does not throw, logs errors instead.
 */
export async function deliverSlackOutput(
  adminClient: SupabaseClient<Database>,
  tile: Tile,
  result: { content: Json },
): Promise<void> {
  if (!tile.slack_output_enabled || !tile.slack_output_channel_id) return;

  try {
    const resolved = await resolveSlackToken(
      adminClient,
      tile.id,
      tile.slack_output_team_id,
    );

    if (!resolved.ok) {
      console.error("[slack-output]", resolved.reason, "tile:", tile.id);
      return;
    }

    const rawText = extractTextFromContent(result.content);
    const fullText = markdownToSlackMrkdwn(rawText);
    const summary = await summarizeContent(rawText);
    const { token } = resolved;
    const channelId = tile.slack_output_channel_id;

    // No summary available: post the full report as a single message.
    if (!summary) {
      await postMessage(token, channelId, fullText, tile.name);
      return;
    }

    // Summary becomes the parent; full report goes into the thread.
    const parent = await postMessage(
      token,
      channelId,
      markdownToSlackMrkdwn(summary),
      tile.name,
    );

    if (!parent) {
      console.warn(
        "[slack-output] Parent message returned no ts; skipping thread reply. tile:",
        tile.id,
      );
      return;
    }

    await postMessage(token, channelId, fullText, tile.name, {
      threadTs: parent.ts,
      omitHeader: true,
    });
  } catch (err) {
    console.error("[slack-output] Failed to deliver Slack output:", err);
  }
}
