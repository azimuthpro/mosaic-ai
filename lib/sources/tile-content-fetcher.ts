import type { SupabaseClient } from "@supabase/supabase-js";

import { MAX_URLS_PER_TILE, URL_BATCH_SIZE } from "@/lib/constants/tiles";
import type { ExecutionContext } from "@/lib/execution/context";
import {
  extractMultipleUrlsIndividual,
  extractUrl,
  formatSearchResultsAsMarkdown,
  searchWeb,
} from "@/lib/search/tavily";
import {
  fetchChannelMessages,
  fetchChannelMetadata,
  formatChannelMetadata,
  getCalendarRange,
  getDaysBackRange,
} from "@/lib/slack/client";
import { resolveSlackToken } from "@/lib/slack/integration";
import { extractKeywordsFromContent } from "@/lib/tiles/extract-keywords-from-job";
import { extractUrlsFromContent } from "@/lib/tiles/extract-urls-from-job";
import {
  sanitizeSearchQuery,
  validateUrlWithDnsCheck,
} from "@/lib/validation/url-validator";
import type {
  Database,
  Json,
  SlackSourceConfig,
  TileJobResult as TileReport,
  TileSource,
  TileType,
  UrlSourceConfig,
  WebSearchConfig,
} from "@/types/database";

export interface TileSourceContent {
  sourceId: string;
  sourceType: "url" | "web_search" | "tile_connection" | "slack_channel";
  identifier: string; // URL for url type, tile name for tile_connection, query for web_search, channel for slack_channel
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
    case "web_search":
      return fetchWebSearchContent(source);
    case "slack_channel":
      return fetchSlackChannelContent(source, adminClient);
    default:
      return {
        sourceId: source.id,
        sourceType: "url",
        identifier: "unknown",
        success: false,
        error: `Unknown source type: ${source.type}`,
      };
  }
}

/**
 * Fetches the latest report from a connected tile.
 */
export async function fetchConnectedTileContent(
  connectionId: string,
  sourceTileId: string,
  adminClient: SupabaseClient<Database>,
  context?: ExecutionContext,
): Promise<TileSourceContent> {
  checkTimeout(context);

  // Runtime cycle detection
  checkCycle(sourceTileId, context);

  // Check depth
  checkDepth(context);

  // Get the referenced tile's name
  const { data: tileData } = await adminClient
    .from("tiles")
    .select("id, name")
    .eq("id", sourceTileId)
    .single();

  const tile = tileData as { id: string; name: string } | null;
  const tileName = tile?.name || "Unknown Tile";

  try {
    const { data: report, error } = await adminClient
      .from("tile_job_results")
      .select(`id, content, format, created_at`)
      .eq("tile_id", sourceTileId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const typedReport = report as TileReport | null;

    if (error || !typedReport) {
      return {
        sourceId: connectionId,
        sourceType: "tile_connection",
        identifier: tileName,
        success: false,
        error: `No results found for tile "${tileName}"`,
        metadata: { tileId: sourceTileId, tileName },
      };
    }

    const formattedContent = formatReportContent(
      typedReport.content,
      typedReport.format,
    );
    const { content, truncated, originalSize } =
      truncateContent(formattedContent);

    return {
      sourceId: connectionId,
      sourceType: "tile_connection",
      identifier: tileName,
      success: true,
      content,
      title: `Result from ${tileName}`,
      contentTruncated: truncated,
      originalSize: truncated ? originalSize : undefined,
      metadata: {
        reportId: typedReport.id,
        reportCreatedAt: typedReport.created_at,
        tileId: sourceTileId,
        tileName,
      },
    };
  } catch (err) {
    return {
      sourceId: connectionId,
      sourceType: "tile_connection",
      identifier: tileName,
      success: false,
      error: err instanceof Error ? err.message : "Failed to fetch results",
      metadata: { tileId: sourceTileId, tileName },
    };
  }
}

/**
 * Fetches content from a URL source using Tavily Extract.
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

  // Get extract depth from config (default: "basic")
  const config = source.config as UrlSourceConfig | null;
  const extractDepth = config?.extract_depth || "basic";

  // Use Tavily Extract instead of Firecrawl
  const result = await extractUrl(source.url, { extractDepth });

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
      title: source.name || source.url,
      contentTruncated: truncated,
      originalSize: truncated ? originalSize : undefined,
    };
  }

  return {
    sourceId: source.id,
    sourceType: "url",
    identifier: source.url,
    success: false,
    error: result.error,
  };
}

/**
 * Fetches search results using Tavily web search.
 */
async function fetchWebSearchContent(
  source: TileSource,
): Promise<TileSourceContent> {
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

    const formattedResults = formatSearchResultsAsMarkdown(
      sanitizedQuery,
      results,
    );
    const { content, truncated, originalSize } =
      truncateContent(formattedResults);

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
 * Resolves the IANA timezone for a tile's mosaic.
 * Falls back to "UTC" if the mosaic has no timezone configured.
 */
async function getMosaicTimezone(
  adminClient: SupabaseClient<Database>,
  tileId: string,
): Promise<string> {
  const { data: tileRow } = await adminClient
    .from("tiles")
    .select("mosaic_id")
    .eq("id", tileId)
    .single();

  if (!tileRow) return "UTC";

  const { data: mosaicRow } = await adminClient
    .from("mosaics")
    .select("settings")
    .eq("id", (tileRow as { mosaic_id: string }).mosaic_id)
    .single();

  const settings = (mosaicRow as { settings: Record<string, unknown> } | null)
    ?.settings;

  return typeof settings?.timezone === "string" ? settings.timezone : "UTC";
}

/**
 * Builds the time range options for fetchChannelMessages based on config.
 */
async function buildTimeRangeOptions(
  config: SlackSourceConfig,
  adminClient: SupabaseClient<Database>,
  tileId: string,
): Promise<Parameters<typeof fetchChannelMessages>[2]> {
  const base = {
    // When in days mode (days_back set, max_messages absent), use hard limit 1000
    maxMessages: config.max_messages ?? (config.days_back ? 1000 : undefined),
    includeThreads: config.include_threads,
  };

  // days_back: rolling window (preferred)
  if (config.days_back) {
    const range = getDaysBackRange(config.days_back);
    return {
      ...base,
      oldest: range.oldest,
      latest: range.latest,
      rangeLabel: range.label,
    };
  }

  // Legacy: calendar-based timeframe
  if (config.timeframe) {
    const timezone = await getMosaicTimezone(adminClient, tileId);
    const range = getCalendarRange(config.timeframe, timezone);
    return {
      ...base,
      oldest: range.oldest,
      latest: range.latest,
      rangeLabel: range.label,
    };
  }

  // Legacy: hours_back rolling window
  if (config.hours_back) {
    return { ...base, hoursBack: config.hours_back };
  }

  return base;
}

/**
 * Fetches messages from a Slack channel source.
 */
async function fetchSlackChannelContent(
  source: TileSource,
  adminClient: SupabaseClient<Database>,
): Promise<TileSourceContent> {
  const config = source.config as SlackSourceConfig | null;

  if (!config?.channel_id) {
    return {
      sourceId: source.id,
      sourceType: "slack_channel",
      identifier: "unknown",
      success: false,
      error: "Slack channel source is missing channel_id",
    };
  }

  const channelLabel = config.channel_name || config.channel_id;

  function failResult(error: string): TileSourceContent {
    return {
      sourceId: source.id,
      sourceType: "slack_channel",
      identifier: channelLabel,
      success: false,
      error,
    };
  }

  const result = await resolveSlackToken(
    adminClient,
    source.tile_id,
    config.team_id,
  );

  if (!result.ok) {
    return failResult(result.reason);
  }

  try {
    const token = result.token;
    const messageOptions = await buildTimeRangeOptions(
      config,
      adminClient,
      source.tile_id,
    );

    const [metadata, messages] = await Promise.all([
      fetchChannelMetadata(token, config.channel_id),
      fetchChannelMessages(token, config.channel_id, messageOptions),
    ]);

    const combined = metadata
      ? formatChannelMetadata(metadata) + "\n\n---\n\n" + messages
      : messages;

    const { content, truncated, originalSize } = truncateContent(combined);

    return {
      sourceId: source.id,
      sourceType: "slack_channel",
      identifier: channelLabel,
      success: true,
      content,
      title: `Slack: #${channelLabel}`,
      contentTruncated: truncated,
      originalSize: truncated ? originalSize : undefined,
    };
  } catch (err) {
    return failResult(
      err instanceof Error ? err.message : "Failed to fetch Slack messages",
    );
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
 * Enforces total content size limit across results.
 * Mutates results to truncate or mark as failed when limit is exceeded.
 */
function enforceTotalContentLimit(
  results: TileSourceContent[],
  currentTotal: number,
): number {
  let totalContentSize = currentTotal;

  for (const result of results) {
    if (!result.success || !result.content) {
      continue;
    }

    const contentSize = Buffer.byteLength(result.content, "utf-8");
    totalContentSize += contentSize;

    if (totalContentSize <= MAX_TOTAL_CONTENT_SIZE) {
      continue;
    }

    // Content exceeds limit - determine how much can be kept
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
      result.success = false;
      result.content = undefined;
      result.error = "Total content size limit exceeded";
    }
  }

  return totalContentSize;
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

  for (let i = 0; i < activeSources.length; i += CONCURRENCY_LIMIT) {
    checkTimeout(context);

    const batch = activeSources.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map((source) =>
        fetchTileSourceContent(source, adminClient, context),
      ),
    );

    totalContentSize = enforceTotalContentLimit(batchResults, totalContentSize);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Gets source identifiers for job metadata tracking.
 */
export function getTileSourceIdentifiers(
  results: TileSourceContent[],
): string[] {
  return results.map((r) => {
    switch (r.sourceType) {
      case "url":
        return r.identifier;
      case "web_search":
        return `search:${r.identifier}`;
      case "tile_connection":
        return `tile:${r.metadata?.tileName || r.identifier}`;
      case "slack_channel":
        return `slack:${r.identifier}`;
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
    tile_connection: { total: 0, success: 0 },
    web_search: { total: 0, success: 0 },
    slack_channel: { total: 0, success: 0 },
  };

  for (const r of results) {
    const bucket = counts[r.sourceType];
    if (!bucket) continue;
    bucket.total++;
    if (r.success) bucket.success++;
  }

  return {
    url_sources: counts.url.total,
    tile_report_sources: counts.tile_connection.total,
    web_search_sources: counts.web_search.total,
    url_succeeded: counts.url.success,
    tile_report_succeeded: counts.tile_connection.success,
    web_search_succeeded: counts.web_search.success,
  };
}

/**
 * Fetches content from runtime URLs (provided via API request).
 * Enforces MAX_URLS_PER_TILE limit, validates URLs for SSRF,
 * then uses Tavily batch Extract API for efficiency.
 */
export async function fetchRuntimeUrlsContent(
  urls: string[],
  context?: ExecutionContext,
): Promise<TileSourceContent[]> {
  // Enforce URL limit
  const limitedUrls = urls.slice(0, MAX_URLS_PER_TILE);

  // Validate all URLs first (SSRF check)
  const validationResults = await Promise.all(
    limitedUrls.map(async (url, index) => ({
      url,
      index,
      validation: await validateUrlWithDnsCheck(url),
    })),
  );

  const results: TileSourceContent[] = [];
  const validUrls: { url: string; index: number }[] = [];

  for (const { url, index, validation } of validationResults) {
    if (!validation.isValid) {
      results.push({
        sourceId: `runtime-${index}`,
        sourceType: "url",
        identifier: url,
        success: false,
        error: `URL validation failed: ${validation.error}`,
      });
    } else {
      validUrls.push({ url, index });
    }
  }

  // Batch extract valid URLs
  let totalContentSize = 0;

  for (let i = 0; i < validUrls.length; i += URL_BATCH_SIZE) {
    checkTimeout(context);

    const batch = validUrls.slice(i, i + URL_BATCH_SIZE);
    const batchUrls = batch.map((v) => v.url);
    const batchExtractResults = await extractMultipleUrlsIndividual(batchUrls);

    const batchResults: TileSourceContent[] = batchExtractResults.map(
      (extractResult, batchIndex) => {
        const originalIndex = batch[batchIndex].index;

        if (extractResult.success && extractResult.content) {
          const { content, truncated, originalSize } = truncateContent(
            extractResult.content,
          );
          return {
            sourceId: `runtime-${originalIndex}`,
            sourceType: "url" as const,
            identifier: extractResult.url,
            success: true,
            content,
            title: extractResult.url,
            contentTruncated: truncated,
            originalSize: truncated ? originalSize : undefined,
          };
        }

        return {
          sourceId: `runtime-${originalIndex}`,
          sourceType: "url" as const,
          identifier: extractResult.url,
          success: false,
          error: extractResult.error,
        };
      },
    );

    totalContentSize = enforceTotalContentLimit(batchResults, totalContentSize);
    results.push(...batchResults);
  }

  return results;
}

/**
 * Searches the web for each keyword and returns results as TileSourceContent.
 * Shared across all route handlers to avoid duplicating keyword search logic.
 */
export async function searchKeywordsContent(
  keywords: string[],
): Promise<TileSourceContent[]> {
  const results: TileSourceContent[] = [];

  for (const keyword of keywords) {
    try {
      const searchResults = await searchWeb(keyword, { maxResults: 5 });
      const formattedResults = formatSearchResultsAsMarkdown(
        keyword,
        searchResults,
      );
      results.push({
        sourceId: `keyword-${keyword}`,
        sourceType: "web_search",
        identifier: keyword,
        success: true,
        content: formattedResults,
        title: `Search: ${keyword}`,
        metadata: { searchResultCount: searchResults.length },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Search failed";
      results.push({
        sourceId: `keyword-${keyword}`,
        sourceType: "web_search",
        identifier: keyword,
        success: false,
        error: errorMessage,
      });
    }
  }

  return results;
}

/**
 * Counts the number of active URL-type sources on a tile.
 * Used to calculate how many URL slots remain before hitting MAX_URLS_PER_TILE.
 */
export function countActiveUrlSources(
  sources: { type: string; is_active: boolean }[],
): number {
  return sources.filter((s) => s.type === "url" && s.is_active).length;
}

/**
 * Fetches content from tile connections based on the tile type.
 * - url_reader: extracts URLs from connected reports and fetches them
 * - web_search: extracts keywords from connected reports and searches them
 * - analyzer: fetches full reports from connected tiles
 *
 * Shared across all route handlers to avoid duplicating connection logic.
 */
export async function fetchConnectionContent(
  tileId: string,
  tileType: TileType,
  connections: { id: string; source_tile_id: string }[],
  adminClient: SupabaseClient<Database>,
  context?: ExecutionContext,
  directUrlSourceCount?: number,
): Promise<TileSourceContent[]> {
  if (connections.length === 0) {
    return [];
  }

  switch (tileType) {
    case "url_reader": {
      const linkedUrls = await fetchLinkedTileUrls(tileId, adminClient);
      if (linkedUrls.length === 0) return [];

      // Account for direct URL sources already consumed
      const usedSlots = directUrlSourceCount ?? 0;
      const remainingSlots = Math.max(0, MAX_URLS_PER_TILE - usedSlots);
      const urlsToFetch = linkedUrls.slice(0, remainingSlots);
      if (urlsToFetch.length === 0) return [];

      return fetchRuntimeUrlsContent(urlsToFetch, context);
    }
    case "web_search": {
      const linkedKeywords = await fetchLinkedTileKeywords(tileId, adminClient);
      if (linkedKeywords.length === 0) return [];
      return searchKeywordsContent(linkedKeywords);
    }
    case "analyzer":
    case "slack_reader":
    case "catalog":
    case "github_issue": {
      const results: TileSourceContent[] = [];
      for (const connection of connections) {
        const result = await fetchConnectedTileContent(
          connection.id,
          connection.source_tile_id,
          adminClient,
          context,
        );
        results.push(result);
      }
      return results;
    }
  }
}

/**
 * Fetches the latest report content from each connected tile.
 * Applies the provided extractor to each report and returns deduplicated results.
 */
async function extractFromConnectedTileReports(
  tileId: string,
  adminClient: SupabaseClient<Database>,
  extractor: (content: Json) => string[],
): Promise<string[]> {
  const { data: connectionsData } = await adminClient
    .from("tile_connections")
    .select("source_tile_id")
    .eq("target_tile_id", tileId);

  const connections = connectionsData as { source_tile_id: string }[] | null;

  if (!connections || connections.length === 0) {
    return [];
  }

  const sourceTileIds = connections.map((c) => c.source_tile_id);

  const { data: reportsData } = await adminClient
    .from("tile_job_results")
    .select("tile_id, content, format")
    .in("tile_id", sourceTileIds)
    .order("created_at", { ascending: false });

  const reports = reportsData as
    | { tile_id: string; content: Json; format: string }[]
    | null;

  if (!reports || reports.length === 0) {
    return [];
  }

  // Get the latest report per tile (first occurrence due to ordering)
  const seenTiles = new Set<string>();
  const allItems: string[] = [];

  for (const report of reports) {
    if (seenTiles.has(report.tile_id)) continue;
    seenTiles.add(report.tile_id);
    allItems.push(...extractor(report.content));
  }

  return [...new Set(allItems)];
}

/**
 * Fetches URLs from connected tiles' reports.
 * Returns a deduplicated list of URLs extracted from all connected tiles,
 * limited to MAX_URLS_PER_TILE.
 */
export async function fetchLinkedTileUrls(
  tileId: string,
  adminClient: SupabaseClient<Database>,
): Promise<string[]> {
  const urls = await extractFromConnectedTileReports(
    tileId,
    adminClient,
    extractUrlsFromContent,
  );
  return urls.slice(0, MAX_URLS_PER_TILE);
}

/**
 * Fetches keywords from connected tiles' reports.
 * Returns a deduplicated list of keywords extracted from all connected tiles.
 */
export function fetchLinkedTileKeywords(
  tileId: string,
  adminClient: SupabaseClient<Database>,
): Promise<string[]> {
  return extractFromConnectedTileReports(
    tileId,
    adminClient,
    extractKeywordsFromContent,
  );
}
