import { NextResponse } from "next/server";

import { analyzeContent } from "@/lib/ai/gemini";
import {
  createExecutionContext,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TIMEOUT_MS,
  ExecutionGuardError,
} from "@/lib/execution/context";
import {
  checkAndIncrementRateLimit,
  decrementConcurrentCount,
  logExecutionEvent,
} from "@/lib/rate-limit/limiter";
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

type AgentWithSources = Agent & {
  sources: Source[];
  owner_id: string;
  max_chain_depth?: number;
  execution_timeout_ms?: number;
};

type AgentResult = {
  agentId: string;
  jobId?: string;
  executionId?: string;
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  rateLimited?: boolean;
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

  const userId = agent.owner_id;
  let rateLimitIncremented = false;

  // Check rate limits for the agent's owner
  const rateLimitResult = await checkAndIncrementRateLimit(adminClient, userId);
  if (!rateLimitResult.allowed) {
    return {
      agentId: agent.id,
      skipped: true,
      reason: `Rate limit: ${rateLimitResult.reason}`,
      rateLimited: true,
    };
  }
  rateLimitIncremented = true;

  // Create execution context
  const executionContext = createExecutionContext({
    rootAgentId: agent.id,
    userId,
    maxDepth: agent.max_chain_depth ?? DEFAULT_MAX_DEPTH,
    timeoutMs: agent.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS,
  });

  try {
    // Log execution start
    await logExecutionEvent(adminClient, {
      executionId: executionContext.executionId,
      agentId: agent.id,
      eventType: "started",
      metadata: {
        trigger: "cron",
        maxDepth: executionContext.maxDepth,
        timeoutMs: executionContext.timeoutMs,
        sourceCount: agent.sources.length,
      },
    });

    // Create job with execution tracking
    const jobInsert: JobInsert = {
      agent_id: agent.id,
      status: "processing",
      started_at: new Date().toISOString(),
      metadata: {
        execution_id: executionContext.executionId,
        chain_depth: 0,
        trigger: "cron",
      },
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

    // Update job with execution_id column (if migration has been applied)
    await adminClient
      .from("jobs")
      .update({
        execution_id: executionContext.executionId,
        chain_depth: 0,
      } as never)
      .eq("id", job.id);

    try {
      // Fetch content from all sources (URLs and agent reports)
      const sourceResults = await fetchAllSourcesContent(
        agent.sources,
        adminClient,
        executionContext,
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
          execution_id: executionContext.executionId,
          chain_depth: 0,
          trigger: "cron",
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

      // Log successful completion
      await logExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        agentId: agent.id,
        jobId: job.id,
        eventType: "completed",
        metadata: {
          sourcesTotal: sourceResults.length,
          sourcesSucceeded: successfulFetches.length,
          durationMs: Date.now() - executionContext.startTime,
        },
      });

      return {
        agentId: agent.id,
        jobId: job.id,
        executionId: executionContext.executionId,
        success: true,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const isGuardError = error instanceof ExecutionGuardError;

      const failedUpdate: JobUpdate = {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      };

      await adminClient
        .from("jobs")
        .update(failedUpdate as never)
        .eq("id", job.id);

      // Log failure with appropriate event type
      const eventType = isGuardError
        ? (error.code.toLowerCase() as
            | "timeout"
            | "cycle_detected"
            | "depth_exceeded")
        : "failed";

      await logExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        agentId: agent.id,
        jobId: job.id,
        eventType,
        metadata: {
          error: errorMessage,
          durationMs: Date.now() - executionContext.startTime,
        },
      });

      return {
        agentId: agent.id,
        jobId: job.id,
        executionId: executionContext.executionId,
        error: errorMessage,
      };
    }
  } finally {
    // Always decrement the concurrent count
    if (rateLimitIncremented) {
      await decrementConcurrentCount(adminClient, userId);
    }
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
