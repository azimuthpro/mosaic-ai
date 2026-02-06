import type { Json, TileJobResult } from "@/types/database";

const MAX_KEYWORDS = 10;

/**
 * Extracts search keywords from content.
 * Handles multiple content formats:
 * - JSON array of strings → use each string as a keyword
 * - JSON object with keywords/queries/search_terms field → use that array
 * - Plain text → split by newlines, each non-empty line becomes a keyword
 */
export function extractKeywordsFromContent(content: Json): string[] {
  // JSON array of strings
  if (Array.isArray(content)) {
    const keywords = content
      .filter((item): item is string => typeof item === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (keywords.length > 0) {
      return dedupeAndLimit(keywords);
    }
  }

  // JSON object with known keyword fields
  if (
    typeof content === "object" &&
    content !== null &&
    !Array.isArray(content)
  ) {
    const obj = content as Record<string, Json | undefined>;
    for (const field of ["keywords", "queries", "search_terms"]) {
      const value = obj[field];
      if (Array.isArray(value)) {
        const keywords = value
          .filter((item): item is string => typeof item === "string")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (keywords.length > 0) {
          return dedupeAndLimit(keywords);
        }
      }
    }
  }

  // Plain text → split by newlines
  if (typeof content === "string") {
    const keywords = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return dedupeAndLimit(keywords);
  }

  return [];
}

/**
 * Extracts search keywords from a tile job result.
 */
export function extractKeywordsFromReport(report: TileJobResult): string[] {
  return extractKeywordsFromContent(report.content);
}

function dedupeAndLimit(keywords: string[]): string[] {
  return [...new Set(keywords)].slice(0, MAX_KEYWORDS);
}
