import type { Json, TileJob, TileJobResult } from "@/types/database";

// URL extraction regex - matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s\)\"\'\>\<\]\,]+/gi;

/**
 * Extracts URLs from a string.
 */
function extractUrlsFromString(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  // Deduplicate and clean URLs (remove trailing punctuation that might have been captured)
  const urls = new Set<string>();
  for (const match of matches) {
    // Clean up trailing punctuation that's often captured
    const cleanUrl = match.replace(/[.,;:!?)]+$/, "");
    urls.add(cleanUrl);
  }
  return Array.from(urls);
}

/**
 * Recursively extracts URLs from an object (for table/json formats).
 */
function extractUrlsFromObject(obj: unknown): string[] {
  if (obj === null || obj === undefined) return [];

  if (typeof obj === "string") {
    return extractUrlsFromString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.flatMap((item) => extractUrlsFromObject(item));
  }

  if (typeof obj === "object") {
    return Object.values(obj).flatMap((value) => extractUrlsFromObject(value));
  }

  return [];
}

/**
 * Extracts URLs from report content.
 * Handles all content types: string, array, and object.
 */
export function extractUrlsFromContent(content: Json): string[] {
  if (typeof content === "string") {
    return extractUrlsFromString(content);
  }

  if (Array.isArray(content)) {
    return content.flatMap((item) =>
      typeof item === "string"
        ? extractUrlsFromString(item)
        : extractUrlsFromObject(item),
    );
  }

  if (typeof content === "object" && content !== null) {
    return extractUrlsFromObject(content);
  }

  return [];
}

/**
 * Extracts URLs from a tile job's report.
 * Returns a deduplicated array of URLs found in the report content.
 */
export function extractUrlsFromJob(
  job: TileJob & { tile_job_results?: TileJobResult[] },
): string[] {
  const report = job.tile_job_results?.[0];
  if (!report) return [];

  return [...new Set(extractUrlsFromContent(report.content))];
}

/**
 * Extracts URLs from a tile job result.
 * Returns a deduplicated array of URLs found in the result content.
 */
export function extractUrlsFromReport(report: TileJobResult): string[] {
  return [...new Set(extractUrlsFromContent(report.content))];
}
