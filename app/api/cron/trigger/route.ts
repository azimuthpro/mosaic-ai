import { NextResponse } from "next/server";

import { analyzeContent } from "@/lib/ai/gemini";
import {
  fetchAllSourcesContent,
  getSourceIdentifiers,
  getSourceTypeBreakdown,
} from "@/lib/sources/content-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Agent,
  Job,
  JobInsert,
  JobUpdate,
  ReportInsert,
  Source,
} from "@/types/database";

type AgentWithSources = Agent & { sources: Source[] };

type AgentResult = {
  agentId: string;
  jobId?: string;
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function processAgent(
  adminClient: ReturnType<typeof createAdminClient>,
  agent: AgentWithSources,
): Promise<AgentResult> {
  if (!agent.sources || agent.sources.length === 0) {
    return { agentId: agent.id, skipped: true, reason: "No sources" };
  }

  // Create job
  const jobInsert: JobInsert = {
    agent_id: agent.id,
    status: "processing",
    started_at: new Date().toISOString(),
  };

  const { data: jobData, error: jobError } = await adminClient
    .from("jobs")
    .insert(jobInsert as never)
    .select()
    .single();

  const job = jobData as Job | null;

  if (jobError || !job) {
    throw new Error("Failed to create job");
  }

  try {
    // Fetch content from all sources (URLs and agent reports)
    const sourceResults = await fetchAllSourcesContent(
      agent.sources,
      adminClient,
    );

    // Update source timestamps
    const now = new Date().toISOString();
    await Promise.all(
      agent.sources
        .filter((s) => s.is_active)
        .map((source) =>
          adminClient
            .from("sources")
            .update({ last_scraped_at: now } as never)
            .eq("id", source.id),
        ),
    );

    // Get successful fetches
    const successfulFetches = sourceResults.filter(
      (r) => r.success && r.content,
    );
    const fetchedContent = successfulFetches.map((r) => r.content!);

    if (fetchedContent.length === 0) {
      throw new Error("No content fetched");
    }

    // Analyze with AI
    const analysis = await analyzeContent(
      fetchedContent,
      agent.system_prompt,
      agent.output_format,
      agent.language,
    );

    if (!analysis.success) {
      throw new Error(analysis.error || "Analysis failed");
    }

    // Get source identifiers for report (handles both URL and agent sources)
    const sourceIdentifiers = getSourceIdentifiers(sourceResults);
    const sourceBreakdown = getSourceTypeBreakdown(sourceResults);

    // Create report
    const reportInsert: ReportInsert = {
      job_id: job.id,
      agent_id: agent.id,
      content: analysis.content,
      format: agent.output_format,
      source_urls: sourceIdentifiers,
    };

    await adminClient.from("reports").insert(reportInsert as never);

    // Mark job complete
    const completedUpdate: JobUpdate = {
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: {
        sources_total: sourceResults.length,
        sources_succeeded: successfulFetches.length,
        sources_failed: sourceResults.length - successfulFetches.length,
        ...sourceBreakdown,
      },
    };

    await adminClient
      .from("jobs")
      .update(completedUpdate as never)
      .eq("id", job.id);

    return { agentId: agent.id, jobId: job.id, success: true };
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    const failedUpdate: JobUpdate = {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    };

    await adminClient
      .from("jobs")
      .update(failedUpdate as never)
      .eq("id", job.id);

    return { agentId: agent.id, jobId: job.id, error: errorMessage };
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // Get all active agents with schedules
    const { data: agents, error: agentsError } = await adminClient
      .from("agents")
      .select(
        `
        *,
        sources!sources_agent_id_fkey (*)
      `,
      )
      .eq("is_active", true)
      .not("schedule_cron", "is", null);

    if (agentsError) {
      console.error("Error fetching agents:", agentsError);
      return NextResponse.json(
        { error: "Failed to fetch agents" },
        { status: 500 },
      );
    }

    const typedAgents = (agents || []) as AgentWithSources[];

    if (typedAgents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No agents to run",
        processed: 0,
      });
    }

    // Process all agents
    const results = await Promise.allSettled(
      typedAgents.map((agent) => processAgent(adminClient, agent)),
    );

    // Count results
    const processedResults = results.map((r) =>
      r.status === "fulfilled" ? r.value : { error: getErrorMessage(r.reason) },
    );

    const successful = processedResults.filter(
      (r) => "success" in r && r.success,
    ).length;
    const failed = processedResults.filter((r) => "error" in r).length;

    return NextResponse.json({
      success: true,
      processed: typedAgents.length,
      successful,
      failed,
      results: processedResults,
    });
  } catch (error) {
    console.error("Cron trigger error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}

// Support POST as well for manual triggering
export async function POST(request: Request): Promise<Response> {
  return GET(request);
}
