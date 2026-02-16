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
  logTileJobExecutionEvent,
} from "@/lib/rate-limit/limiter";
import {
  countActiveUrlSources,
  fetchAllTileSourcesContent,
  fetchConnectionContent,
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
import { triggerDownstreamTiles } from "@/lib/tiles/trigger-downstream";
import type {
  MosaicSettings,
  Tile,
  TileConnection,
  TileJob,
  TileJobInsert,
  TileJobResultInsert,
  TileJobUpdate,
  TileSource,
} from "@/types/database";

type TileWithSources = Tile & {
  tile_sources: TileSource[];
  mosaics: { owner_id: string; settings: MosaicSettings | null };
};

/**
 * Check if a tile should run at the current time based on its cron schedule
 * and the mosaic's timezone setting.
 */
function shouldTileRunNow(
  scheduleCron: string,
  timezone: string | undefined,
): boolean {
  // Use UTC if no timezone specified
  const tz = timezone || "UTC";

  // Get current time in the mosaic's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(
    parts.find((p) => p.type === "minute")?.value || "0",
    10,
  );
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value || "";

  // Map weekday string to cron day (0=Sun, 1=Mon, etc)
  const dayOfWeek =
    { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekdayStr] ?? 0;

  // Parse cron: "minute hour dayOfMonth month dayOfWeek"
  // We only care about minute, hour, and dayOfWeek for this scheduler
  const cronParts = scheduleCron.split(" ");
  if (cronParts.length !== 5) return false;

  const [cronMinute, cronHour, , , cronDayOfWeek] = cronParts;

  // Check minute (we run at minute 0, so check if cron expects 0)
  if (cronMinute !== "*" && cronMinute !== "0") {
    // Only run on the exact minute specified
    const cronMinutes = cronMinute.split(",").map(Number);
    if (!cronMinutes.includes(minute)) return false;
  }

  // Check hour
  if (cronHour !== "*") {
    const cronHours = cronHour.split(",").map(Number);
    if (!cronHours.includes(hour)) return false;
  }

  // Check day of week
  if (cronDayOfWeek !== "*") {
    const cronDays = cronDayOfWeek.split(",").map(Number);
    if (!cronDays.includes(dayOfWeek)) return false;
  }

  return true;
}

type TileResult = {
  tileId: string;
  jobId?: string;
  executionId?: string;
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  rateLimited?: boolean;
};

async function processTile(
  adminClient: ReturnType<typeof createAdminClient>,
  tile: TileWithSources,
): Promise<TileResult> {
  // Fetch incoming connections
  const { data: incomingConnections } = await adminClient
    .from("tile_connections")
    .select("*")
    .eq("target_tile_id", tile.id);

  const connections = (incomingConnections || []) as TileConnection[];
  const hasDirectSources = tile.tile_sources && tile.tile_sources.length > 0;
  const hasConnections = connections.length > 0;

  if (!hasDirectSources && !hasConnections) {
    return { tileId: tile.id, skipped: true, reason: "No sources" };
  }

  const userId = tile.mosaics.owner_id;
  let rateLimitIncremented = false;

  // Check rate limits for the tile's mosaic owner
  const rateLimitResult = await checkAndIncrementRateLimit(adminClient, userId);
  if (!rateLimitResult.allowed) {
    return {
      tileId: tile.id,
      skipped: true,
      reason: `Rate limit: ${rateLimitResult.reason}`,
      rateLimited: true,
    };
  }
  rateLimitIncremented = true;

  // Create execution context
  const executionContext = createExecutionContext({
    rootAgentId: tile.id,
    userId,
    maxDepth: tile.max_chain_depth ?? DEFAULT_MAX_DEPTH,
    timeoutMs: tile.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS,
  });

  try {
    // Log execution start
    await logTileJobExecutionEvent(adminClient, {
      executionId: executionContext.executionId,
      tileId: tile.id,
      eventType: "started",
      metadata: {
        trigger: "cron",
        tileType: tile.tile_type,
        maxDepth: executionContext.maxDepth,
        timeoutMs: executionContext.timeoutMs,
        sourceCount: tile.tile_sources.length,
      },
    });

    // Create job with execution tracking
    const jobInsert: TileJobInsert = {
      tile_id: tile.id,
      status: "processing",
      started_at: new Date().toISOString(),
      metadata: {
        execution_id: executionContext.executionId,
        chain_depth: 0,
        trigger: "cron",
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
        `[cron/trigger] Failed to create job for tile ${tile.id}:`,
        formatSupabaseError(jobError),
      );
      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tile.id,
        eventType: "failed",
        metadata: {
          phase: "job_creation",
          trigger: "cron",
          error: jobError?.message || "No job data returned",
          ...supabaseErrorMetadata(jobError),
        },
      });
      throw new Error(`Failed to create job: ${jobError?.message || "No job data returned"}`);
    }

    try {
      // Fetch content from all direct sources (URLs, tile reports, web search)
      const sourceResults: TileSourceContent[] = hasDirectSources
        ? await fetchAllTileSourcesContent(
            tile.tile_sources,
            adminClient,
            executionContext,
          )
        : [];

      // Update source timestamps for direct sources
      if (hasDirectSources) {
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

      // Fetch content from tile connections (URLs, keywords, or full reports)
      if (hasConnections) {
        const connectionResults = await fetchConnectionContent(
          tile.id,
          tile.tile_type,
          connections,
          adminClient,
          executionContext,
          countActiveUrlSources(tile.tile_sources ?? []),
        );
        sourceResults.push(...connectionResults);
      }

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
        tile.system_prompt || "",
        tile.output_format,
        tile.language,
      );

      if (!analysis.success) {
        throw new Error(analysis.error || "Analysis failed");
      }

      // Get source identifiers for report
      const sourceIdentifiers = getTileSourceIdentifiers(sourceResults);
      const sourceBreakdown = getTileSourceTypeBreakdown(sourceResults);

      // Create report
      const reportInsert: TileJobResultInsert = {
        job_id: job.id,
        tile_id: tile.id,
        content: analysis.content,
        format: tile.output_format,
        source_urls: sourceIdentifiers,
      };

      await adminClient.from("tile_job_results").insert(reportInsert as never);

      // Mark job complete
      const completedUpdate: TileJobUpdate = {
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
        .from("tile_jobs")
        .update(completedUpdate as never)
        .eq("id", job.id);

      // Log successful completion
      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tile.id,
        jobId: job.id,
        eventType: "completed",
        metadata: {
          sourcesTotal: sourceResults.length,
          sourcesSucceeded: successfulFetches.length,
          durationMs: Date.now() - executionContext.startTime,
        },
      });

      // Trigger downstream tiles (fire and forget)
      triggerDownstreamTiles(adminClient, {
        completedTileId: tile.id,
        completedJobId: job.id,
        mosaicId: tile.mosaic_id,
        userId,
      }).catch((err) =>
        console.error(`[cron/trigger] Failed to trigger downstream tiles (tile=${tile.id}, job=${job.id}, mosaic=${tile.mosaic_id}):`, err),
      );

      return {
        tileId: tile.id,
        jobId: job.id,
        executionId: executionContext.executionId,
        success: true,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const isGuardError = error instanceof ExecutionGuardError;

      const failedUpdate: TileJobUpdate = {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMessage,
      };

      await adminClient
        .from("tile_jobs")
        .update(failedUpdate as never)
        .eq("id", job.id);

      // Log failure with appropriate event type
      const eventType = isGuardError
        ? (error.code.toLowerCase() as
            | "timeout"
            | "cycle_detected"
            | "depth_exceeded")
        : "failed";

      await logTileJobExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        tileId: tile.id,
        jobId: job.id,
        eventType,
        metadata: {
          error: errorMessage,
          durationMs: Date.now() - executionContext.startTime,
        },
      });

      return {
        tileId: tile.id,
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

const RETENTION_DAYS = {
  executionLogs: 90,
  webhookDeliveries: 30,
} as const;

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function runDataRetentionCleanup(
  adminClient: ReturnType<typeof createAdminClient>,
) {
  const [logsResult, deliveriesResult] = await Promise.allSettled([
    adminClient
      .from("tile_job_execution_logs")
      .delete()
      .lt("created_at", daysAgoISO(RETENTION_DAYS.executionLogs)),
    adminClient
      .from("tile_webhook_deliveries")
      .delete()
      .lt("created_at", daysAgoISO(RETENTION_DAYS.webhookDeliveries)),
  ]);

  return {
    execution_logs: logsResult.status === "fulfilled" ? "ok" : "error",
    webhook_deliveries:
      deliveriesResult.status === "fulfilled" ? "ok" : "error",
  };
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

    // Get all active tiles with schedules (also fetch mosaic settings for timezone)
    const { data: tiles, error: tilesError } = await adminClient
      .from("tiles")
      .select(
        `
        *,
        tile_sources!tile_sources_tile_id_fkey (*),
        mosaics!inner (owner_id, settings)
      `,
      )
      .eq("is_active", true)
      .not("schedule_cron", "is", null);

    if (tilesError) {
      console.error("Error fetching tiles:", tilesError);
      return NextResponse.json(
        { error: "Failed to fetch tiles" },
        { status: 500 },
      );
    }

    const allTiles = (tiles || []) as TileWithSources[];

    // Filter tiles that should run at the current time based on their schedule and timezone
    const scheduledTiles = allTiles.filter((tile) => {
      if (!tile.schedule_cron) return false;
      const settings = tile.mosaics.settings as MosaicSettings | null;
      return shouldTileRunNow(tile.schedule_cron, settings?.timezone);
    });

    if (scheduledTiles.length === 0) {
      const cleanup = await runDataRetentionCleanup(adminClient);
      return NextResponse.json({
        success: true,
        message: "No tiles scheduled to run at this time",
        processed: 0,
        totalWithSchedule: allTiles.length,
        cleanup,
      });
    }

    // Process all scheduled tiles
    const results = await Promise.allSettled(
      scheduledTiles.map((tile) => processTile(adminClient, tile)),
    );

    // Extract results from Promise.allSettled
    const processedResults: TileResult[] = results.map((result) =>
      result.status === "fulfilled"
        ? result.value
        : { tileId: "unknown", error: getErrorMessage(result.reason) },
    );

    const successful = processedResults.filter((r) => r.success).length;
    const failed = processedResults.filter((r) => r.error).length;

    const cleanup = await runDataRetentionCleanup(adminClient);

    return NextResponse.json({
      success: true,
      processed: scheduledTiles.length,
      totalWithSchedule: allTiles.length,
      successful,
      failed,
      results: processedResults,
      cleanup,
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
