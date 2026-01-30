import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExecutionContext } from "@/lib/execution/context";
import { scrapeUrl } from "@/lib/firecrawl/client";
import { formatSearchResultsAsMarkdown, searchWeb } from "@/lib/search/tavily";
import {
  sanitizeSearchQuery,
  validateUrlWithDnsCheck,
} from "@/lib/validation/url-validator";
import type {
  Database,
  Json,
  TileReport,
  TileSource,
  WebSearchConfig,
} from "@/types/database";

export interface TileSourceContent {
  sourceId: string;
  sourceType: "url" | "agent_report" | "web_search";
  identifier: string; // URL for url type, tile name for agent_report, query for web_search
  success: boolean;
  content?: string;
  title?: string;
  error?: string;
  contentTruncated?: boolean;
  originalSize?: number;
  metadata?: {
    reportId?: string;
    reportCreatedAt?: string;
    tileId?: string;
    tileName?: string;
    searchResultCount?: number;
  };
}

// Content size limits
const MAX_CONTENT_SIZE_PER_SOURCE = 500 * 1024; // 500KB
const MAX_TOTAL_CONTENT_SIZE = 2 * 1024 * 1024; // 2MB
const TRUNCATION_INDICATOR =
  "\n\n[Content truncated due to size limits. Original size: {size} bytes]";

const CONCURRENCY_LIMIT = 3;

/**
 * Truncates content if it exceeds the maximum size limit.
 */
function truncateContent(
  content: string,
  maxSize: number = MAX_CONTENT_SIZE_PER_SOURCE,
): { content: string; truncated: boolean; originalSize: number } {
  const originalSize = Buffer.byteLength(content, "utf-8");

  if (originalSize <= maxSize) {
    return { content, truncated: false, originalSize };
  }

  // Truncate and add indicator
  const indicatorSize = Buffer.byteLength(
    TRUNCATION_INDICATOR.replace("{size}", originalSize.toString()),
    "utf-8",
  );
  const truncatedContent = content.substring(0, maxSize - indicatorSize);
  const finalContent =
    truncatedContent +
    TRUNCATION_INDICATOR.replace("{size}", originalSize.toString());

  return { content: finalContent, truncated: true, originalSize };
}

/**
 * Checks if execution has timed out.
 */
function checkTimeout(context?: ExecutionContext): void {
  if (!context) return;

  const elapsed = Date.now() - context.startTime;
  if (elapsed >= context.timeoutMs) {
    throw new Error(
      `Execution timeout: exceeded ${context.timeoutMs}ms limit (elapsed: ${elapsed}ms)`,
    );
  }
}

/**
 * Checks if we've exceeded the maximum chain depth.
 */
function checkDepth(context?: ExecutionContext): void {
  if (!context) return;

  if (context.currentDepth >= context.maxDepth) {
    throw new Error(
      `Maximum chain depth exceeded: current depth ${context.currentDepth} >= max ${context.maxDepth}`,
    );
  }
}

/**
 * Checks if a tile has already been visited in this execution (cycle detection).
 */
function checkCycle(tileId: string, context?: ExecutionContext): void {
  if (!context) return;

  // Use visitedAgents for backwards compatibility (same execution context)
  if (context.visitedAgents.has(tileId)) {
    throw new Error(
      `Circular dependency detected: tile ${tileId} has already been visited in this execution chain`,
    );
  }
}

/**
 * Fetches content for a single tile source based on its type.
 */
export async function fetchTileSourceContent(
  source: TileSource,
  adminClient: SupabaseClient<Database>,
  context?: ExecutionContext,
): Promise<TileSourceContent> {
  checkTimeout(context);

  switch (source.type) {
    case "url":
      return fetchUrlContent(source);
    case "agent_report":
      return fetchTileReportContent(source, adminClient, context);
    case "web_search":
      return fetchWebSearchContent(source);
    default:
      return {
        sourceId: source.id,
        sourceType: source.type,
        identifier: "unknown",
        success: false,
        error: `Unknown source type: ${source.type}`,
      };
  }
}

/**
 * Fetches content from a URL source using Firecrawl.
 */
async function fetchUrlContent(source: TileSource): Promise<TileSourceContent> {
  if (!source.url) {
    return {
      sourceId: source.id,
      sourceType: "url",
      identifier: "no-url",
      success: false,
      error: "URL source is missing URL",
    };
  }

  // Validate URL for SSRF protection
  const urlValidation = await validateUrlWithDnsCheck(source.url);
  if (!urlValidation.isValid) {
    return {
      sourceId: source.id,
      sourceType: "url",
      identifier: source.url,
      success: false,
      error: `URL validation failed: ${urlValidation.error}`,
    };
  }

  const result = await scrapeUrl(source.url);

  // Apply content size limits
  if (result.success && result.content) {
    const { content, truncated, originalSize } = truncateContent(
      result.content,
    );
    return {
      sourceId: source.id,
      sourceType: "url",
      identifier: source.url,
      success: true,
      content,
      title: result.title,
      contentTruncated: truncated,
      originalSize: truncated ? originalSize : undefined,
    };
  }

  return {
    sourceId: source.id,
    sourceType: "url",
    identifier: source.url,
    success: result.success,
    content: result.content,
    title: result.title,
    error: result.error,
  };
}

/**
 * Fetches the latest successful report from a referenced tile.
 */
async function fetchTileReportContent(
  source: TileSource,
  adminClient: SupabaseClient<Database>,
  context?: ExecutionContext,
): Promise<TileSourceContent> {
  if (!source.source_reference_id) {
    return {
      sourceId: source.id,
      sourceType: "agent_report",
      identifier: "no-reference",
      success: false,
      error: "Tile report source is missing reference ID",
    };
  }

  // Runtime cycle detection
  checkCycle(source.source_reference_id, context);

  // Check depth before fetching from another tile
  checkDepth(context);

  // Get the referenced tile's name
  const { data: tileData } = await adminClient
    .from("tiles")
    .select("id, name")
    .eq("id", source.source_reference_id)
    .single();

  const tile = tileData as { id: string; name: string } | null;
  const tileName = tile?.name || "Unknown Tile";

  // Get the latest successful report from the referenced tile
  const { data: report, error } = await adminClient
    .from("tile_reports")
    .select(
      `
      id,
      content,
      format,
      created_at,
      tile_jobs!inner (status)
    `,
    )
    .eq("tile_id", source.source_reference_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !report) {
    return {
      sourceId: source.id,
      sourceType: "agent_report",
      identifier: tileName,
      success: false,
      error: `No reports found for tile "${tileName}"`,
      metadata: {
        tileId: source.source_reference_id,
        tileName,
      },
    };
  }

  const typedReport = report as TileReport & { tile_jobs: { status: string } };

  // Convert report content to string for AI processing
  let content = formatReportContent(typedReport.content, typedReport.format);

  // Apply content size limits
  const {
    content: truncatedContent,
    truncated,
    originalSize,
  } = truncateContent(content);
  content = truncatedContent;

  return {
    sourceId: source.id,
    sourceType: "agent_report",
    identifier: tileName,
    success: true,
    content,
    title: `Report from ${tileName}`,
    contentTruncated: truncated,
    originalSize: truncated ? originalSize : undefined,
    metadata: {
      reportId: typedReport.id,
      reportCreatedAt: typedReport.created_at,
      tileId: source.source_reference_id,
      tileName,
    },
  };
}

/**
 * Fetches search results using Tavily web search.
 */
async function fetchWebSearchContent(source: TileSource): Promise<TileSourceContent> {
  const config = source.config as WebSearchConfig | null;

  if (!config?.query) {
    return {
      sourceId: source.id,
      sourceType: "web_search",
      identifier: "no-query",
      success: false,
      error: "Web search source is missing search query",
    };
  }

  // Sanitize the search query
  const sanitization = sanitizeSearchQuery(config.query);
  if (!sanitization.isValid || !sanitization.sanitized) {
    return {
      sourceId: source.id,
      sourceType: "web_search",
      identifier: config.query,
      success: false,
      error: `Invalid search query: ${sanitization.error}`,
    };
  }

  const sanitizedQuery = sanitization.sanitized;

  try {
    const results = await searchWeb(sanitizedQuery, {
      searchDepth: config.search_depth,
      maxResults: config.max_results,
      includeRawContent: config.include_raw_content,
    });

    let content = formatSearchResultsAsMarkdown(sanitizedQuery, results);

    // Apply content size limits
    const {
      content: truncatedContent,
      truncated,
      originalSize,
    } = truncateContent(content);
    content = truncatedContent;

    return {
      sourceId: source.id,
      sourceType: "web_search",
      identifier: sanitizedQuery,
      success: true,
      content,
      title: `Search: ${sanitizedQuery}`,
      contentTruncated: truncated,
      originalSize: truncated ? originalSize : undefined,
      metadata: {
        searchResultCount: results.length,
      },
    };
  } catch (error) {
    return {
      sourceId: source.id,
      sourceType: "web_search",
      identifier: sanitizedQuery,
      success: false,
      error: error instanceof Error ? error.message : "Web search failed",
    };
  }
}

/**
 * Formats report content based on its format type.
 */
function formatReportContent(content: Json, format: string): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content) && format === "list") {
    return content.map((item) => `- ${String(item)}`).join("\n");
  }

  return JSON.stringify(content, null, 2);
}

/**
 * Fetches content from all tile sources with concurrency limiting.
 * Enforces total content size limit across all sources.
 */
export async function fetchAllTileSourcesContent(
  sources: TileSource[],
  adminClient: SupabaseClient<Database>,
  context?: ExecutionContext,
): Promise<TileSourceContent[]> {
  const activeSources = sources.filter((s) => s.is_active);
  const results: TileSourceContent[] = [];
  let totalContentSize = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < activeSources.length; i += CONCURRENCY_LIMIT) {
    // Check timeout before each batch
    checkTimeout(context);

    const batch = activeSources.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map((source) => fetchTileSourceContent(source, adminClient, context)),
    );

    // Track total content size and enforce limit
    for (const result of batchResults) {
      if (result.success && result.content) {
        const contentSize = Buffer.byteLength(result.content, "utf-8");
        totalContentSize += contentSize;

        // If we've exceeded the total limit, truncate remaining content
        if (totalContentSize > MAX_TOTAL_CONTENT_SIZE) {
          const overage = totalContentSize - MAX_TOTAL_CONTENT_SIZE;
          const allowedSize = contentSize - overage;

          if (allowedSize > 0) {
            const { content: truncated } = truncateContent(
              result.content,
              allowedSize,
            );
            result.content = truncated;
            result.contentTruncated = true;
            result.originalSize = contentSize;
          } else {
            // No room left, mark as failed due to size
            result.success = false;
            result.content = undefined;
            result.error = "Total content size limit exceeded";
          }
        }
      }
    }

    results.push(...batchResults);
  }

  return results;
}

/**
 * Gets source identifiers for job metadata tracking.
 */
export function getTileSourceIdentifiers(results: TileSourceContent[]): string[] {
  return results.map((r) => {
    switch (r.sourceType) {
      case "url":
        return r.identifier;
      case "web_search":
        return `search:${r.identifier}`;
      case "agent_report":
        return `tile:${r.metadata?.tileName || r.identifier}`;
    }
  });
}

/**
 * Calculates source type breakdown for job metadata.
 */
export function getTileSourceTypeBreakdown(results: TileSourceContent[]): {
  url_sources: number;
  tile_report_sources: number;
  web_search_sources: number;
  url_succeeded: number;
  tile_report_succeeded: number;
  web_search_succeeded: number;
} {
  const counts = {
    url: { total: 0, success: 0 },
    agent_report: { total: 0, success: 0 },
    web_search: { total: 0, success: 0 },
  };

  for (const r of results) {
    const bucket = counts[r.sourceType];
    bucket.total++;
    if (r.success) bucket.success++;
  }

  return {
    url_sources: counts.url.total,
    tile_report_sources: counts.agent_report.total,
    web_search_sources: counts.web_search.total,
    url_succeeded: counts.url.success,
    tile_report_succeeded: counts.agent_report.success,
    web_search_succeeded: counts.web_search.success,
  };
}
