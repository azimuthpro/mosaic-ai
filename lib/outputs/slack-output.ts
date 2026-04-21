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
 */
function markdownToSlackMrkdwn(text: string): string {
  // Protect code blocks and inline code from transformation
  const codeBlocks: string[] = [];
  let result = text.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  const inlineCode: string[] = [];
  result = result.replace(/`[^`]+`/g, (match) => {
    inlineCode.push(match);
    return `__INLINE_CODE_${inlineCode.length - 1}__`;
  });

  // Convert markdown bullet markers (* ) to Unicode bullets (before italic/bold)
  result = result.replace(/^(\s*)\*(\s+\S)/gm, "$1•$2");

  // Convert horizontal rules to visual separator
  result = result.replace(/^-{3,}\s*$/gm, "───────────────────");
  result = result.replace(/^\*{3,}\s*$/gm, "───────────────────");

  // Split lines where non-table text runs into a table row
  result = result.replace(
    /^([^|\n]+[^|\s\n])\s*(\|(?:[^|\n]+\|)+)\s*$/gm,
    "$1\n$2",
  );

  // Tables become monospace code blocks in Slack (protected from later transforms)
  result = wrapTablesInCodeBlocks(result, codeBlocks);

  // Links: [text](url) -> <url|text>
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<$2|$1>");

  // Order matters: ***bold italic*** before *italic* before **bold**,
  // otherwise inner asterisks get consumed by the wrong pattern.
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, "*_$1_*");
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "_$1_");
  result = result.replace(/\*\*(.+?)\*\*/g, "*$1*");

  // Headers and strikethrough
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "*$1*");
  result = result.replace(/~~(.+?)~~/g, "~$1~");

  // Restore protected code
  result = result.replace(/__INLINE_CODE_(\d+)__/g, (_, i) => inlineCode[i]);
  result = result.replace(/__CODE_BLOCK_(\d+)__/g, (_, i) => codeBlocks[i]);

  return result;
}

/** Wraps consecutive pipe-delimited table lines in code block fences. */
function wrapTablesInCodeBlocks(
  text: string,
  protectedBlocks: string[],
): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let table: string[] = [];

  const flush = () => {
    if (table.length === 0) return;
    const block = "```\n" + table.join("\n") + "\n```";
    protectedBlocks.push(block);
    out.push(`__CODE_BLOCK_${protectedBlocks.length - 1}__`);
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
