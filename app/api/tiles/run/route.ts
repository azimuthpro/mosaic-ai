import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { analyzeContent } from "@/lib/ai/gemini";
import {
  createExecutionContext,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TIMEOUT_MS,
} from "@/lib/execution/context";
import {
  assertRateLimitAllowed,
  checkAndIncrementRateLimit,
  decrementConcurrentCount,
  logTileJobExecutionEvent,
  RateLimitError,
} from "@/lib/rate-limit/limiter";
import {
  fetchAllTileSourcesContent,
  fetchConnectionContent,
  fetchRuntimeUrlsContent,
  getTileSourceIdentifiers,
  getTileSourceTypeBreakdown,
  type TileSourceContent,
} from "@/lib/sources/tile-content-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { triggerDownstreamTiles } from "@/lib/tiles/trigger-downstream";
import type {
  Tile,
  TileConnection,
  TileJob,
  TileJobInsert,
  TileJobResultInsert,
  TileJobUpdate,
  TileSource,
} from "@/types/database";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

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

    const { tileId, urls } = await request.json();

    if (!tileId) {
      return NextResponse.json(
        { error: "Tile ID is required" },
        { status: 400 },
      );
    }

    // Validate runtime URLs if provided
    const runtimeUrls: string[] = Array.isArray(urls) ? urls : [];

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

    // Validate we have at least one source
    if (!hasRuntimeUrls && !hasConfiguredSources && !hasConnections) {
      return NextResponse.json(
        {
          error:
            "No sources configured. Tile has no sources and no connected tiles.",
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
      return NextResponse.json(
        { error: "Failed to create job" },
        { status: 500 },
      );
    }

    try {
      // Fetch content based on source priority
      let sourceResults: TileSourceContent[];
      let sourceMode: "runtime" | "configured" | "linked" | "connection";

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
        sourceResults = [];
        sourceMode = "configured";
      }

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
        typedTile.system_prompt || "",
        typedTile.output_format,
        typedTile.language,
        typedTile.output_schema,
      );

      if (!analysis.success) {
        throw new Error(analysis.error || "AI analysis failed");
      }

      // Get source identifiers for report
      const sourceIdentifiers = getTileSourceIdentifiers(sourceResults);
      const sourceBreakdown = getTileSourceTypeBreakdown(sourceResults);

      // Create report
      const reportInsert: TileJobResultInsert = {
        job_id: job.id,
        tile_id: tileId,
        content: analysis.content,
        format: typedTile.output_format,
        source_urls: sourceIdentifiers,
      };

      const { error: reportError } = await adminClient
        .from("tile_job_results")
        .insert(reportInsert as never);

      if (reportError) {
        throw new Error("Failed to save report");
      }

      // Update job as completed
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
        },
      });

      revalidatePath(`/mosaics/${typedTile.mosaic_id}`);

      // Trigger downstream tiles (fire and forget)
      triggerDownstreamTiles(adminClient, {
        completedTileId: tileId,
        completedJobId: job.id,
        mosaicId: typedTile.mosaic_id,
        userId: user.id,
      }).catch((err) =>
        console.error("Failed to trigger downstream tiles:", err),
      );

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
