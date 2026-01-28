import type { SupabaseClient } from "@supabase/supabase-js";

import { scrapeUrl } from "@/lib/firecrawl/client";
import type { Database, Json, Report, Source } from "@/types/database";

export interface SourceContent {
  sourceId: string;
  sourceType: "url" | "agent_report";
  identifier: string; // URL for url type, agent name for agent_report
  success: boolean;
  content?: string;
  title?: string;
  error?: string;
  metadata?: {
    reportId?: string;
    reportCreatedAt?: string;
    agentId?: string;
    agentName?: string;
  };
}

const CONCURRENCY_LIMIT = 3;

/**
 * Fetches content for a single source based on its type.
 */
export async function fetchSourceContent(
  source: Source,
  adminClient: SupabaseClient<Database>,
): Promise<SourceContent> {
  if (source.type === "url") {
    return fetchUrlContent(source);
  } else if (source.type === "agent_report") {
    return fetchAgentReportContent(source, adminClient);
  }

  return {
    sourceId: source.id,
    sourceType: source.type,
    identifier: "unknown",
    success: false,
    error: `Unknown source type: ${source.type}`,
  };
}

/**
 * Fetches content from a URL source using Firecrawl.
 */
async function fetchUrlContent(source: Source): Promise<SourceContent> {
  if (!source.url) {
    return {
      sourceId: source.id,
      sourceType: "url",
      identifier: "no-url",
      success: false,
      error: "URL source is missing URL",
    };
  }

  const result = await scrapeUrl(source.url);

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
 * Fetches the latest successful report from a referenced agent.
 */
async function fetchAgentReportContent(
  source: Source,
  adminClient: SupabaseClient<Database>,
): Promise<SourceContent> {
  if (!source.source_reference_id) {
    return {
      sourceId: source.id,
      sourceType: "agent_report",
      identifier: "no-reference",
      success: false,
      error: "Agent report source is missing reference ID",
    };
  }

  // Get the referenced agent's name
  const { data: agentData } = await adminClient
    .from("agents")
    .select("id, name")
    .eq("id", source.source_reference_id)
    .single();

  const agent = agentData as { id: string; name: string } | null;
  const agentName = agent?.name || "Unknown Agent";

  // Get the latest successful report from the referenced agent
  const { data: report, error } = await adminClient
    .from("reports")
    .select(
      `
      id,
      content,
      format,
      created_at,
      jobs!inner (status)
    `,
    )
    .eq("agent_id", source.source_reference_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !report) {
    return {
      sourceId: source.id,
      sourceType: "agent_report",
      identifier: agentName,
      success: false,
      error: `No reports found for agent "${agentName}"`,
      metadata: {
        agentId: source.source_reference_id,
        agentName,
      },
    };
  }

  const typedReport = report as Report & { jobs: { status: string } };

  // Convert report content to string for AI processing
  const content = formatReportContent(typedReport.content, typedReport.format);

  return {
    sourceId: source.id,
    sourceType: "agent_report",
    identifier: agentName,
    success: true,
    content,
    title: `Report from ${agentName}`,
    metadata: {
      reportId: typedReport.id,
      reportCreatedAt: typedReport.created_at,
      agentId: source.source_reference_id,
      agentName,
    },
  };
}

/**
 * Formats report content based on its format type.
 */
function formatReportContent(content: Json, format: string): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content) && format === "list") {
    return content.map((item) => `- ${String(item)}`).join("\n");
  }

  return JSON.stringify(content, null, 2);
}

/**
 * Fetches content from all sources with concurrency limiting.
 */
export async function fetchAllSourcesContent(
  sources: Source[],
  adminClient: SupabaseClient<Database>,
): Promise<SourceContent[]> {
  const activeSources = sources.filter((s) => s.is_active);
  const results: SourceContent[] = [];

  // Process in batches for concurrency control
  for (let i = 0; i < activeSources.length; i += CONCURRENCY_LIMIT) {
    const batch = activeSources.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map((source) => fetchSourceContent(source, adminClient)),
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Gets source identifiers for job metadata tracking.
 */
export function getSourceIdentifiers(results: SourceContent[]): string[] {
  return results.map((r) => {
    if (r.sourceType === "url") {
      return r.identifier;
    }
    return `agent:${r.metadata?.agentName || r.identifier}`;
  });
}

/**
 * Calculates source type breakdown for job metadata.
 */
export function getSourceTypeBreakdown(results: SourceContent[]): {
  url_sources: number;
  agent_report_sources: number;
  url_succeeded: number;
  agent_report_succeeded: number;
} {
  const counts = { url: { total: 0, success: 0 }, agent_report: { total: 0, success: 0 } };

  for (const r of results) {
    const bucket = counts[r.sourceType];
    bucket.total++;
    if (r.success) bucket.success++;
  }

  return {
    url_sources: counts.url.total,
    agent_report_sources: counts.agent_report.total,
    url_succeeded: counts.url.success,
    agent_report_succeeded: counts.agent_report.success,
  };
}
