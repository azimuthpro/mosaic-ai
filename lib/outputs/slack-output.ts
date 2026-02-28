import type { SupabaseClient } from "@supabase/supabase-js";

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

  // Tables become monospace code blocks in Slack
  result = result.replace(
    /(?:^|\n)(\|.+\|(?:\n\|[-: |]+\|)?(?:\n\|.+\|)+)/g,
    (match) => "\n```" + match + "\n```",
  );

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

    const text = markdownToSlackMrkdwn(extractTextFromContent(result.content));
    await postMessage(
      resolved.token,
      tile.slack_output_channel_id,
      text,
      tile.name,
    );
  } catch (err) {
    console.error("[slack-output] Failed to deliver Slack output:", err);
  }
}
