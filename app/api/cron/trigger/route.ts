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
  fetchAllTileSourcesContent,
  getTileSourceIdentifiers,
  getTileSourceTypeBreakdown,
} from "@/lib/sources/tile-content-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  MosaicSettings,
  Tile,
  TileJob,
  TileJobInsert,
  TileJobUpdate,
  TileReportInsert,
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

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

async function processTile(
  adminClient: ReturnType<typeof createAdminClient>,
  tile: TileWithSources,
): Promise<TileResult> {
  if (!tile.tile_sources || tile.tile_sources.length === 0) {
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
    await logExecutionEvent(adminClient, {
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
      throw new Error("Failed to create job");
    }

    try {
      // Fetch content from all sources (URLs, tile reports, web search)
      const sourceResults = await fetchAllTileSourcesContent(
        tile.tile_sources,
        adminClient,
        executionContext,
      );

      // Update source timestamps
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
      const reportInsert: TileReportInsert = {
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
      await logExecutionEvent(adminClient, {
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

      await logExecutionEvent(adminClient, {
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
    const typedTiles = allTiles.filter((tile) => {
      if (!tile.schedule_cron) return false;
      const settings = tile.mosaics.settings as MosaicSettings | null;
      return shouldTileRunNow(tile.schedule_cron, settings?.timezone);
    });

    if (typedTiles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No tiles scheduled to run at this time",
        processed: 0,
        totalWithSchedule: allTiles.length,
      });
    }

    // Process all tiles
    const results = await Promise.allSettled(
      typedTiles.map((tile) => processTile(adminClient, tile)),
    );

    // Extract results from Promise.allSettled
    const processedResults: TileResult[] = results.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      return { tileId: "unknown", error: getErrorMessage(result.reason) };
    });

    const successful = processedResults.filter(
      (r) => r.success === true,
    ).length;
    const failed = processedResults.filter((r) => r.error !== undefined).length;

    return NextResponse.json({
      success: true,
      processed: typedTiles.length,
      totalWithSchedule: allTiles.length,
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
