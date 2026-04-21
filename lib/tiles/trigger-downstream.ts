import { analyzeContent } from "@/lib/ai/gemini";
import { executeCatalogUpdate } from "@/lib/catalog/execute-catalog";
import {
  createExecutionContext,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TIMEOUT_MS,
} from "@/lib/execution/context";
import { withTimeout } from "@/lib/execution/timeout";
import { getMosaicTimezone } from "@/lib/mosaics/timezone";
import {
  checkAndIncrementRateLimit,
  decrementConcurrentCount,
  logTileJobExecutionEvent,
} from "@/lib/rate-limit/limiter";
import {
  fetchAllTileSourcesContent,
  fetchConnectionContent,
  getTileSourceIdentifiers,
  getTileSourceTypeBreakdown,
  type TileSourceContent,
} from "@/lib/sources/tile-content-fetcher";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  formatSupabaseError,
  getErrorMessage,
  supabaseErrorMetadata,
} from "@/lib/supabase/errors";
import { compareBySortOrder } from "@/lib/utils";
import type {
  Tile,
  TileConnection,
  TileJobInsert,
  TileJobResultInsert,
  TileJobUpdate,
  TileSource,
} from "@/types/database";

const MAX_CASCADE_DEPTH = 5;

interface TriggerDownstreamParams {
  completedTileId: string;
  completedJobId: string;
  mosaicId: string;
  userId: string;
  /** Current cascade depth (0 = first trigger) */
  depth?: number;
  /** Set of tile IDs already visited in this cascade chain */
  visitedTileIds?: Set<string>;
}

/**
 * Triggers downstream tiles that have `trigger_on_source_update` enabled.
 * Called after a tile successfully completes a job.
 */
export async function triggerDownstreamTiles(
  adminClient: ReturnType<typeof createAdminClient>,
  params: TriggerDownstreamParams,
): Promise<void> {
  const {
    completedTileId,
    completedJobId,
    mosaicId,
    userId,
    depth = 0,
    visitedTileIds = new Set([completedTileId]),
  } = params;

  // Safety: prevent infinite cascades
  if (depth >= MAX_CASCADE_DEPTH) {
    console.warn(
      `[trigger-downstream] Max cascade depth (${MAX_CASCADE_DEPTH}) reached for tile ${completedTileId}`,
    );
    await logTileJobExecutionEvent(adminClient, {
      executionId: crypto.randomUUID(),
      tileId: completedTileId,
      eventType: "depth_exceeded",
      metadata: {
        trigger: "source_update",
        cascadeDepth: depth,
        maxCascadeDepth: MAX_CASCADE_DEPTH,
        completedJobId,
        mosaicId,
      },
    });
    return;
  }

  // Find all downstream tiles connected to the completed tile
  const { data: connections } = await adminClient
    .from("tile_connections")
    .select("target_tile_id")
    .eq("source_tile_id", completedTileId);

  if (!connections || connections.length === 0) return;

  const targetTileIds = (connections as { target_tile_id: string }[]).map(
    (c) => c.target_tile_id,
  );

  // Fetch target tiles that have trigger_on_source_update enabled and are active
  const { data: targetTiles } = await adminClient
    .from("tiles")
    .select("*, tile_sources!tile_sources_tile_id_fkey (*)")
    .in("id", targetTileIds)
    .eq("is_active", true)
    .eq("trigger_on_source_update", true);

  if (!targetTiles || targetTiles.length === 0) return;

  const typedTiles = targetTiles as unknown as (Tile & {
    tile_sources: TileSource[];
  })[];

  // Sort each tile's sources by user-defined sort_order
  for (const tile of typedTiles) {
    tile.tile_sources.sort(compareBySortOrder);
  }

  // Process each eligible downstream tile with hard timeout per tile
  await Promise.allSettled(
    typedTiles.map((tile) => {
      const timeoutMs = tile.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS;
      return withTimeout(
        processDownstreamTile(adminClient, tile, {
          completedTileId,
          completedJobId,
          mosaicId,
          userId,
          depth,
          visitedTileIds,
        }),
        timeoutMs,
        `processDownstreamTile(${tile.id})`,
      );
    }),
  );
}

async function processDownstreamTile(
  adminClient: ReturnType<typeof createAdminClient>,
  tile: Tile & { tile_sources: TileSource[] },
  params: Required<TriggerDownstreamParams>,
): Promise<void> {
  const {
    completedTileId,
    completedJobId,
    mosaicId,
    userId,
    depth,
    visitedTileIds,
  } = params;

  // Cycle detection: skip if we've already processed this tile in this chain
  if (visitedTileIds.has(tile.id)) {
    console.warn(
      `[trigger-downstream] Cycle detected: tile ${tile.id} already visited in chain [${[...visitedTileIds].join(" → ")}]`,
    );
    await logTileJobExecutionEvent(adminClient, {
      executionId: crypto.randomUUID(),
      tileId: tile.id,
      eventType: "cycle_detected",
      metadata: {
        trigger: "source_update",
        visitedTileIds: [...visitedTileIds],
        cascadeDepth: depth,
        triggeredByTileId: completedTileId,
        triggeredByJobId: completedJobId,
      },
    });
    return;
  }

  // Check if tile already has a processing job (prevent double-runs)
  const { data: existingJobs } = await adminClient
    .from("tile_jobs")
    .select("id")
    .eq("tile_id", tile.id)
    .eq("status", "processing")
    .limit(1);

  if (existingJobs && existingJobs.length > 0) {
    const existingJobId = (existingJobs[0] as { id: string }).id;
    console.log(
      `[trigger-downstream] Tile ${tile.id} already processing (job ${existingJobId}), skipping`,
    );
    return;
  }

  // Check rate limits
  const rateLimitResult = await checkAndIncrementRateLimit(adminClient, userId);
  if (!rateLimitResult.allowed) {
    console.warn(
      `[trigger-downstream] Rate limited for tile ${tile.id}: ${rateLimitResult.reason}`,
    );
    await logTileJobExecutionEvent(adminClient, {
      executionId: crypto.randomUUID(),
      tileId: tile.id,
      eventType: "rate_limited",
      metadata: {
        trigger: "source_update",
        reason: rateLimitResult.reason,
        currentCount: rateLimitResult.currentCount,
        maxPerHour: rateLimitResult.maxPerHour,
        concurrentExecutions: rateLimitResult.concurrentExecutions,
        maxConcurrent: rateLimitResult.maxConcurrent,
        triggeredByTileId: completedTileId,
        triggeredByJobId: completedJobId,
        cascadeDepth: depth,
      },
    });
    return;
  }

  try {
    const executionContext = createExecutionContext({
      rootAgentId: tile.id,
      userId,
      maxDepth: tile.max_chain_depth ?? DEFAULT_MAX_DEPTH,
      timeoutMs: tile.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS,
    });

    // Log execution start (fire-and-forget to avoid blocking critical path)
    logTileJobExecutionEvent(adminClient, {
      executionId: executionContext.executionId,
      tileId: tile.id,
      eventType: "started",
      metadata: {
        trigger: "source_update",
        triggeredByTileId: completedTileId,
        triggeredByJobId: completedJobId,
        cascadeDepth: depth + 1,
        tileType: tile.tile_type,
      },
    }).catch((err) =>
      console.error(
        `[trigger-downstream] Failed to log started event for tile ${tile.id}:`,
        err,
      ),
    );

    // Create job
    const jobInsert: TileJobInsert = {
      tile_id: tile.id,
      status: "processing",
      started_at: new Date().toISOString(),
      metadata: {
        execution_id: executionContext.executionId,
        chain_depth: 0,
        trigger: "source_update",
        triggered_by_tile_id: completedTileId,
        triggered_by_job_id: completedJobId,
        cascade_depth: depth + 1,
      },
      execution_id: executionContext.executionId,
      chain_depth: 0,
    };

    const { data: jobData, error: jobError } = await adminClient
      .from("tile_jobs")
      .insert(jobInsert as never)
      .select()
      .single();

    if (jobError || !jobData) {
      console.error(
        `[trigger-downstream] Failed to create job for tile ${tile.id}:`,
        formatSupabaseError(jobError),
      );
      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tile.id,
        eventType: "failed",
        metadata: {
          phase: "job_creation",
          trigger: "source_update",
          error: jobError?.message || "No job data returned",
          ...supabaseErrorMetadata(jobError),
          cascadeDepth: depth + 1,
          triggeredByTileId: completedTileId,
        },
      });
      return;
    }

    const job = jobData as { id: string };

    try {
      // Fetch incoming connections for this tile
      const { data: incomingConnections } = await adminClient
        .from("tile_connections")
        .select("*")
        .eq("target_tile_id", tile.id);

      const tileConnections = (incomingConnections || []) as TileConnection[];

      // Fetch content from all sources
      const sourceResults: TileSourceContent[] = [];

      if (tile.tile_sources && tile.tile_sources.length > 0) {
        const directResults = await fetchAllTileSourcesContent(
          tile.tile_sources,
          adminClient,
          executionContext,
        );
        sourceResults.push(...directResults);

        // Update last_scraped_at
        const now = new Date().toISOString();
        await Promise.all(
          tile.tile_sources
            .filter((s) => s.is_active)
            .map((source) =>
              adminClient
                .from("tile_sources")
                .update({ last_scraped_at: now } as never)
                .eq("id", source.id),
            ),
        );
      }

      // Fetch connection content
      if (tileConnections.length > 0) {
        const connectionResults = await fetchConnectionContent(
          tile.id,
          tile.tile_type,
          tileConnections,
          adminClient,
          executionContext,
        );
        sourceResults.push(...connectionResults);
      }

      const successfulFetches = sourceResults.filter(
        (r) => r.success && r.content,
      );
      const fetchedContent = successfulFetches.map((r) => r.content!);

      if (fetchedContent.length === 0) {
        throw new Error("No content fetched from sources");
      }

      const sourceIdentifiers = getTileSourceIdentifiers(sourceResults);
      const sourceBreakdown = getTileSourceTypeBreakdown(sourceResults);

      let resultContent: import("@/types/database").Json;
      let resultFormat = tile.output_format;

      if (tile.tile_type === "catalog") {
        const catalogResult = await executeCatalogUpdate(
          tile.id,
          fetchedContent,
          tile.system_prompt,
          adminClient,
          job.id,
        );
        resultContent = catalogResult.jobResultContent;
        resultFormat = "json";
      } else {
        const timezone = await getMosaicTimezone(adminClient, tile.id);
        const analysis = await analyzeContent(
          fetchedContent,
          tile.system_prompt || "",
          tile.output_format,
          tile.language,
          tile.output_schema,
          timezone,
        );

        if (!analysis.success) {
          throw new Error(analysis.error || "AI analysis failed");
        }

        resultContent = analysis.content;
      }

      const resultInsert: TileJobResultInsert = {
        job_id: job.id,
        tile_id: tile.id,
        content: resultContent,
        format: resultFormat,
        source_urls: sourceIdentifiers,
      };
      await adminClient.from("tile_job_results").insert(resultInsert as never);

      // Mark job completed
      const completedUpdate: TileJobUpdate = {
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          execution_id: executionContext.executionId,
          chain_depth: 0,
          trigger: "source_update",
          triggered_by_tile_id: completedTileId,
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

      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tile.id,
        jobId: job.id,
        eventType: "completed",
        metadata: {
          trigger: "source_update",
          sourcesTotal: sourceResults.length,
          sourcesSucceeded: successfulFetches.length,
          durationMs: Date.now() - executionContext.startTime,
        },
      });

      // Cascade: trigger downstream tiles of this tile
      const nextVisited = new Set(visitedTileIds);
      nextVisited.add(tile.id);

      await triggerDownstreamTiles(adminClient, {
        completedTileId: tile.id,
        completedJobId: job.id,
        mosaicId,
        userId,
        depth: depth + 1,
        visitedTileIds: nextVisited,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      const failedUpdate: TileJobUpdate = {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      };

      await adminClient
        .from("tile_jobs")
        .update(failedUpdate as never)
        .eq("id", job.id);

      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tile.id,
        jobId: job.id,
        eventType: "failed",
        metadata: {
          trigger: "source_update",
          error: errorMessage,
          durationMs: Date.now() - executionContext.startTime,
        },
      });

      console.error(
        `[trigger-downstream] Failed to process tile ${tile.id} (job=${job.id}, execution=${executionContext.executionId}):`,
        errorMessage,
      );
    }
  } finally {
    await decrementConcurrentCount(adminClient, userId);
  }
}
