import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { analyzeContent, type DebugInfo } from "@/lib/ai/gemini";
import { executeCatalogUpdate } from "@/lib/catalog/execute-catalog";
import { MAX_URLS_PER_TILE } from "@/lib/constants/tiles";
import { executeOfferSender } from "@/lib/email/execute-offer-sender";
import { postOfferDraftToSlack } from "@/lib/email/post-offer-draft-slack";
import { attachSlackMessageTs } from "@/lib/email/send-offer-draft";
import {
  createExecutionContext,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TIMEOUT_MS,
} from "@/lib/execution/context";
import { executeGitHubIssue } from "@/lib/github/execute-github-issue";
import { getMosaicTimezone } from "@/lib/mosaics/timezone";
import { deliverSlackOutput } from "@/lib/outputs/slack-output";
import {
  assertRateLimitAllowed,
  checkAndIncrementRateLimit,
  decrementConcurrentCount,
  logTileJobExecutionEvent,
  RateLimitError,
} from "@/lib/rate-limit/limiter";
import {
  countActiveUrlSources,
  fetchAllTileSourcesContent,
  fetchConnectionContent,
  fetchRuntimeUrlsContent,
  getTileSourceIdentifiers,
  getTileSourceTypeBreakdown,
  type TileSourceContent,
} from "@/lib/sources/tile-content-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatSupabaseError,
  getErrorMessage,
  supabaseErrorMetadata,
} from "@/lib/supabase/errors";
import { createClient, getUser } from "@/lib/supabase/server";
import { triggerDownstreamTiles } from "@/lib/tiles/trigger-downstream";
import { compareBySortOrder } from "@/lib/utils";
import type {
  GitHubIssueConfig,
  Json,
  OfferDraftResult,
  OfferDraftSlackContext,
  OfferSenderConfig,
  Tile,
  TileConnection,
  TileJob,
  TileJobInsert,
  TileJobResultInsert,
  TileJobUpdate,
  TileSource,
} from "@/types/database";

export async function POST(request: Request): Promise<Response> {
  const adminClient = createAdminClient();
  let userId: string | null = null;
  let rateLimitIncremented = false;

  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = user.id;

    const {
      tileId,
      urls,
      debug,
      repo: targetRepo,
      comment,
      slackContext,
    } = (await request.json()) as {
      tileId?: string;
      urls?: string[];
      debug?: boolean;
      repo?: string;
      comment?: string;
      slackContext?: OfferDraftSlackContext & { bot_token?: string };
    };
    const offerComment = typeof comment === "string" ? comment : null;
    const offerSlackBotToken = slackContext?.bot_token;
    const offerSlackContext: OfferDraftSlackContext | undefined = slackContext
      ? {
          team_id: slackContext.team_id,
          channel_id: slackContext.channel_id,
          thread_ts: slackContext.thread_ts,
        }
      : undefined;

    if (!tileId) {
      return NextResponse.json(
        { error: "Tile ID is required" },
        { status: 400 },
      );
    }

    // Validate runtime URLs if provided
    const runtimeUrls: string[] = Array.isArray(urls) ? urls : [];

    if (runtimeUrls.length > MAX_URLS_PER_TILE) {
      return NextResponse.json(
        {
          error: `Too many URLs. Maximum ${MAX_URLS_PER_TILE} URLs allowed per request.`,
        },
        { status: 400 },
      );
    }

    // Check rate limits before proceeding
    const rateLimitResult = await checkAndIncrementRateLimit(
      adminClient,
      user.id,
    );

    try {
      assertRateLimitAllowed(rateLimitResult);
      rateLimitIncremented = true;
    } catch (rateLimitError) {
      if (rateLimitError instanceof RateLimitError) {
        return NextResponse.json(rateLimitError.toJSON(), { status: 429 });
      }
      throw rateLimitError;
    }

    const supabase = await createClient();

    // Fetch tile with sources (RLS on tiles table handles access)
    const { data: tile, error: tileError } = await supabase
      .from("tiles")
      .select(
        `
        *,
        tile_sources!tile_sources_tile_id_fkey (*)
      `,
      )
      .eq("id", tileId)
      .single();

    if (tileError || !tile) {
      console.error("Error fetching tile:", tileError);
      return NextResponse.json({ error: "Tile not found" }, { status: 404 });
    }

    const typedTile = tile as unknown as Tile & { tile_sources: TileSource[] };
    typedTile.tile_sources.sort(compareBySortOrder);

    if (typedTile.tile_type === "knowledge_base") {
      return NextResponse.json(
        {
          error:
            "Knowledge base tiles store static content and cannot be executed",
        },
        { status: 400 },
      );
    }

    // Verify user has access to the mosaic (owner or member)
    const { data: mosaic } = await supabase
      .from("mosaics")
      .select("owner_id")
      .eq("id", typedTile.mosaic_id)
      .single();

    if (!mosaic) {
      // Check if user is a member (in case they don't own it)
      const { data: membership } = await supabase
        .from("mosaic_members")
        .select("role")
        .eq("mosaic_id", typedTile.mosaic_id)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Fetch incoming connections for this tile
    const { data: incomingConnections } = await adminClient
      .from("tile_connections")
      .select("*")
      .eq("target_tile_id", tileId);

    const connections = (incomingConnections || []) as TileConnection[];

    const hasRuntimeUrls = runtimeUrls.length > 0;
    const hasConfiguredSources =
      typedTile.tile_sources && typedTile.tile_sources.length > 0;
    const hasConnections = connections.length > 0;
    const isOfferSender = typedTile.tile_type === "offer_sender";

    // Validate we have at least one source. Offer sender is exempt — it can run
    // from just a user comment / Slack thread, no scraping required.
    if (
      !hasRuntimeUrls &&
      !hasConfiguredSources &&
      !hasConnections &&
      !isOfferSender
    ) {
      return NextResponse.json(
        {
          error:
            "No sources configured. Tile has no sources and no connected tiles.",
        },
        { status: 400 },
      );
    }
    if (isOfferSender && !offerComment?.trim() && !hasConnections) {
      return NextResponse.json(
        {
          error:
            "Offer Sender needs an instruction (comment) or a connected tile to know who to send to.",
        },
        { status: 400 },
      );
    }

    // Create execution context for this run
    const executionContext = createExecutionContext({
      rootAgentId: tileId,
      userId: user.id,
      maxDepth: typedTile.max_chain_depth ?? DEFAULT_MAX_DEPTH,
      timeoutMs: typedTile.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS,
    });

    // Log execution start
    await logTileJobExecutionEvent(adminClient, {
      executionId: executionContext.executionId,
      tileId: tileId,
      eventType: "started",
      metadata: {
        tileType: typedTile.tile_type,
        maxDepth: executionContext.maxDepth,
        timeoutMs: executionContext.timeoutMs,
        sourceCount: typedTile.tile_sources.length,
        trigger: "manual",
        ...(debug ? { debug: true } : {}),
      },
    });

    // Create a job with execution tracking
    const jobInsert: TileJobInsert = {
      tile_id: tileId,
      status: "processing",
      started_at: new Date().toISOString(),
      metadata: {
        execution_id: executionContext.executionId,
        chain_depth: 0,
      },
      execution_id: executionContext.executionId,
      chain_depth: 0,
    };

    const { data: jobData, error: jobError } = await adminClient
      .from("tile_jobs")
      .insert(jobInsert as never)
      .select()
      .single();

    const job = jobData as TileJob | null;

    if (jobError || !job) {
      console.error(
        `[tiles/run] Failed to create job for tile ${tileId}:`,
        formatSupabaseError(jobError),
      );
      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tileId,
        eventType: "failed",
        metadata: {
          phase: "job_creation",
          error: jobError?.message || "No job data returned",
          ...supabaseErrorMetadata(jobError),
        },
      });
      return NextResponse.json(
        { error: "Failed to create job", details: jobError?.message },
        { status: 500 },
      );
    }

    try {
      // Fetch content based on source priority
      let sourceResults: TileSourceContent[];
      let sourceMode: "runtime" | "configured" | "linked" | "connection";

      const sourceFetchStart = Date.now();

      if (hasRuntimeUrls) {
        sourceMode = "runtime";
        sourceResults = await fetchRuntimeUrlsContent(
          runtimeUrls,
          executionContext,
        );
      } else if (hasConfiguredSources) {
        sourceMode = "configured";
        sourceResults = await fetchAllTileSourcesContent(
          typedTile.tile_sources,
          adminClient,
          executionContext,
        );

        // Update source last_scraped_at for configured sources
        const now = new Date().toISOString();
        await Promise.all(
          typedTile.tile_sources
            .filter((s) => s.is_active)
            .map((source) =>
              adminClient
                .from("tile_sources")
                .update({ last_scraped_at: now } as never)
                .eq("id", source.id),
            ),
        );

        // Also include connection-derived content alongside configured sources
        if (hasConnections) {
          const connectionResults = await fetchConnectionContent(
            tileId,
            typedTile.tile_type,
            connections,
            adminClient,
            executionContext,
            countActiveUrlSources(typedTile.tile_sources),
          );
          sourceResults.push(...connectionResults);
        }
      } else if (hasConnections) {
        // Tiles with only connections (no direct sources or runtime URLs)
        const connectionResults = await fetchConnectionContent(
          tileId,
          typedTile.tile_type,
          connections,
          adminClient,
          executionContext,
        );
        sourceMode = connectionResults.length > 0 ? "linked" : "connection";
        sourceResults = connectionResults;
      } else {
        // Offer Sender (or any tile with neither sources nor connections) runs
        // purely from comment input — nothing to fetch.
        sourceResults = [];
        sourceMode = "configured";
      }

      const sourceFetchDurationMs = Date.now() - sourceFetchStart;

      // Collect successful fetches
      const successfulFetches = sourceResults.filter(
        (r) => r.success && r.content,
      );
      const fetchedContent = successfulFetches.map((r) => r.content!);

      // Offer Sender can legitimately have zero source content (comment-only).
      if (fetchedContent.length === 0 && !isOfferSender) {
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

      // Get source identifiers for report
      const sourceIdentifiers = getTileSourceIdentifiers(sourceResults);
      const sourceBreakdown = getTileSourceTypeBreakdown(sourceResults);

      let resultContent: import("@/types/database").Json;
      let resultFormat = typedTile.output_format;
      let slackContent: import("@/types/database").Json;
      let analysisDebugInfo: DebugInfo | undefined;

      const aiAnalysisStart = Date.now();

      if (typedTile.tile_type === "catalog") {
        const catalogResult = await executeCatalogUpdate(
          tileId,
          fetchedContent,
          typedTile.system_prompt,
          adminClient,
          job.id,
        );
        resultContent = catalogResult.jobResultContent;
        resultFormat = "json";
        slackContent = catalogResult.diff.summary;
      } else if (typedTile.tile_type === "github_issue") {
        const githubResult = await executeGitHubIssue(
          tileId,
          fetchedContent,
          typedTile.system_prompt,
          adminClient,
          (typedTile.config ?? {}) as unknown as GitHubIssueConfig,
          typedTile.language,
          targetRepo as string | undefined,
        );
        resultContent = githubResult.jobResultContent;
        resultFormat = "json";
        slackContent = githubResult.slackSummary;
      } else if (isOfferSender) {
        const offerResult = await executeOfferSender(
          tileId,
          fetchedContent,
          offerComment,
          typedTile.system_prompt,
          (typedTile.config ?? {}) as unknown as OfferSenderConfig,
          typedTile.language,
          adminClient,
          offerSlackContext,
        );
        resultContent = offerResult.jobResultContent as unknown as Json;
        resultFormat = "json";
        slackContent = offerResult.slackSummary;
      } else {
        const timezone = await getMosaicTimezone(adminClient, tileId);
        const analysis = await analyzeContent(
          fetchedContent,
          typedTile.system_prompt || "",
          typedTile.output_format,
          typedTile.language,
          typedTile.output_schema,
          timezone,
        );

        if (!analysis.success) {
          throw new Error(analysis.error || "AI analysis failed");
        }

        resultContent = analysis.content;
        slackContent = resultContent;
        analysisDebugInfo = analysis.debugInfo;
      }

      const aiAnalysisDurationMs = Date.now() - aiAnalysisStart;

      // Save job result
      const reportInsert: TileJobResultInsert = {
        job_id: job.id,
        tile_id: tileId,
        content: resultContent,
        format: resultFormat,
        source_urls: sourceIdentifiers,
      };

      const { error: reportError } = await adminClient
        .from("tile_job_results")
        .insert(reportInsert as never);

      if (reportError) {
        throw new Error("Failed to save report");
      }

      // Offer Sender: post draft preview into the originating Slack thread
      // (if invoked via the bot) with Approve/Cancel buttons. Skip the regular
      // Slack output — drafts aren't a completed result.
      if (isOfferSender && offerSlackContext && offerSlackBotToken) {
        try {
          const posted = await postOfferDraftToSlack(
            offerSlackBotToken,
            offerSlackContext.channel_id,
            offerSlackContext.thread_ts,
            job.id,
            resultContent as unknown as OfferDraftResult,
          );
          if (posted?.ts) {
            await attachSlackMessageTs(adminClient, job.id, posted.ts);
          }
        } catch (err) {
          console.error(
            "[tiles/run] failed to post offer draft to Slack:",
            err,
          );
        }
      } else if (!isOfferSender) {
        await deliverSlackOutput(adminClient, typedTile, {
          content: slackContent,
        });
      }

      // Update job as completed
      const totalDurationMs = Date.now() - executionContext.startTime;

      const debugMetadata = debug
        ? {
            debug: {
              ...analysisDebugInfo,
              sourceFetchDurationMs,
              aiAnalysisDurationMs,
              totalDurationMs,
              sourceDetails: sourceResults.map((r) => ({
                identifier: r.identifier,
                type: r.sourceType,
                success: r.success,
                contentLength: r.content?.length ?? 0,
                error: r.error,
              })),
            },
          }
        : {};

      const completedUpdate: TileJobUpdate = {
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          execution_id: executionContext.executionId,
          chain_depth: 0,
          source_mode: sourceMode,
          sources_total: sourceResults.length,
          sources_succeeded: successfulFetches.length,
          sources_failed: sourceResults.length - successfulFetches.length,
          ...sourceBreakdown,
          ...debugMetadata,
        },
      };

      await adminClient
        .from("tile_jobs")
        .update(completedUpdate as never)
        .eq("id", job.id);

      // Log successful completion
      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tileId,
        jobId: job.id,
        eventType: "completed",
        metadata: {
          sourcesTotal: sourceResults.length,
          sourcesSucceeded: successfulFetches.length,
          durationMs: Date.now() - executionContext.startTime,
          ...(debug ? { debug: true } : {}),
        },
      });

      revalidatePath(`/mosaics/${typedTile.mosaic_id}`);

      // Offer Sender drafts are not a "completed result" until the user approves
      // and the email actually goes out — skip downstream cascading.
      if (!isOfferSender) {
        triggerDownstreamTiles(adminClient, {
          completedTileId: tileId,
          completedJobId: job.id,
          mosaicId: typedTile.mosaic_id,
          userId: user.id,
        }).catch((err) =>
          console.error(
            `[tiles/run] Failed to trigger downstream tiles (tile=${tileId}, job=${job.id}, mosaic=${typedTile.mosaic_id}):`,
            err,
          ),
        );
      }

      return NextResponse.json({
        success: true,
        jobId: job.id,
        executionId: executionContext.executionId,
      });
    } catch (processError) {
      // Update job as failed
      const errorMessage = getErrorMessage(processError);

      const failedUpdate: TileJobUpdate = {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      };

      await adminClient
        .from("tile_jobs")
        .update(failedUpdate as never)
        .eq("id", job.id);

      // Log failure
      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tileId,
        jobId: job.id,
        eventType: "failed",
        metadata: {
          error: errorMessage,
          durationMs: Date.now() - executionContext.startTime,
          ...(debug ? { debug: true } : {}),
        },
      });

      revalidatePath(`/mosaics/${typedTile.mosaic_id}`);

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 },
    );
  } finally {
    // Always decrement the concurrent count when done
    if (rateLimitIncremented && userId) {
      await decrementConcurrentCount(adminClient, userId);
    }
  }
}
