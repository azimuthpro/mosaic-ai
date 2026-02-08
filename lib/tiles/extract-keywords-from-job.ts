import type { Json, TileJobResult } from "@/types/database";

const MAX_KEYWORDS = 10;

const KEYWORD_FIELDS = ["keywords", "queries", "search_terms", "items"];

/**
 * Extracts search keywords from content.
 * Handles multiple content formats:
 * - JSON array of strings -> use each string as a keyword
 * - JSON object with keywords/queries/search_terms/items field -> use that array
 * - JSON object with text field -> split by newlines
 * - Plain text -> split by newlines, each non-empty line becomes a keyword
 */
export function extractKeywordsFromContent(content: Json): string[] {
  if (Array.isArray(content)) {
    return dedupeAndLimit(extractStrings(content));
  }

  if (typeof content === "object" && content !== null) {
    const obj = content as Record<string, Json | undefined>;

    for (const field of KEYWORD_FIELDS) {
      const value = obj[field];
      if (Array.isArray(value)) {
        const keywords = extractStrings(value);
        if (keywords.length > 0) {
          return dedupeAndLimit(keywords);
        }
      }
    }

    if (typeof obj.text === "string") {
      return dedupeAndLimit(splitLines(obj.text));
    }
  }

  if (typeof content === "string") {
    return dedupeAndLimit(splitLines(content));
  }

  return [];
}

/**
 * Extracts search keywords from a tile job result.
 */
export function extractKeywordsFromReport(report: TileJobResult): string[] {
  return extractKeywordsFromContent(report.content);
}

/** Pull non-empty trimmed strings from a mixed JSON array. */
function extractStrings(values: Json[]): string[] {
  return values
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Split text by newlines and discard blank lines. */
function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function dedupeAndLimit(keywords: string[]): string[] {
  return [...new Set(keywords)].slice(0, MAX_KEYWORDS);
}
