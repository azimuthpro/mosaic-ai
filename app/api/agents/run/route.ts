import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { analyzeContent } from "@/lib/ai/gemini";
import {
  fetchAllSourcesContent,
  getSourceIdentifiers,
  getSourceTypeBreakdown,
} from "@/lib/sources/content-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import type {
  Agent,
  Job,
  JobInsert,
  JobUpdate,
  ReportInsert,
  Source,
} from "@/types/database";

type AgentWithSources = Agent & { sources: Source[] };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId } = await request.json();

    if (!agentId) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // Fetch agent with sources
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select(
        `
        *,
        sources!sources_agent_id_fkey (*)
      `,
      )
      .eq("id", agentId)
      .eq("owner_id", user.id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const typedAgent = agent as AgentWithSources;

    if (!typedAgent.sources || typedAgent.sources.length === 0) {
      return NextResponse.json(
        { error: "Agent has no sources configured" },
        { status: 400 },
      );
    }

    // Use admin client for job/report creation to bypass RLS
    const adminClient = createAdminClient();

    // Create a job
    const jobInsert: JobInsert = {
      agent_id: agentId,
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
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 },
      );
    }

    try {
      // Fetch content from all sources (URLs and agent reports)
      const sourceResults = await fetchAllSourcesContent(
        typedAgent.sources,
        adminClient,
      );

      // Update source last_scraped_at
      const now = new Date().toISOString();
      await Promise.all(
        typedAgent.sources
          .filter((s) => s.is_active)
          .map((source) =>
            adminClient
              .from("sources")
              .update({ last_scraped_at: now } as never)
              .eq("id", source.id),
          ),
      );

      // Collect successful fetches
      const successfulFetches = sourceResults.filter(
        (r) => r.success && r.content,
      );
      const fetchedContent = successfulFetches.map((r) => r.content!);

      if (fetchedContent.length === 0) {
        // Collect errors from failed sources for debugging
        const sourceErrors = sourceResults
          .filter((r) => !r.success)
          .map((r) => ({
            identifier: r.identifier,
            type: r.sourceType,
            error: r.error,
          }));

        console.error("All sources failed:", sourceErrors);

        throw new Error(
          `No content could be fetched from sources. Errors: ${sourceErrors.map((e) => e.error).join("; ")}`,
        );
      }

      // Analyze with AI
      const analysis = await analyzeContent(
        fetchedContent,
        typedAgent.system_prompt,
        typedAgent.output_format,
        typedAgent.language,
      );

      if (!analysis.success) {
        throw new Error(analysis.error || "AI analysis failed");
      }

      // Get source identifiers for report (handles both URL and agent sources)
      const sourceIdentifiers = getSourceIdentifiers(sourceResults);
      const sourceBreakdown = getSourceTypeBreakdown(sourceResults);

      // Create report
      const reportInsert: ReportInsert = {
        job_id: job.id,
        agent_id: agentId,
        content: analysis.content,
        format: typedAgent.output_format,
        source_urls: sourceIdentifiers,
      };

      const { error: reportError } = await adminClient
        .from("reports")
        .insert(reportInsert as never);

      if (reportError) {
        throw new Error("Failed to save report");
      }

      // Update job as completed
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

      revalidatePath(`/agents/${agentId}`);
      revalidatePath("/dashboard");

      return NextResponse.json({ success: true, jobId: job.id });
    } catch (processError) {
      // Update job as failed
      const errorMessage = getErrorMessage(processError);

      const failedUpdate: JobUpdate = {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      };

      await adminClient
        .from("jobs")
        .update(failedUpdate as never)
        .eq("id", job.id);

      revalidatePath(`/agents/${agentId}`);

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  }
}
