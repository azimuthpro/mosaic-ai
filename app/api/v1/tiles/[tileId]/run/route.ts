import { triggerTileWebhooks } from "@/lib/actions/webhooks";
import { analyzeContent } from "@/lib/ai/gemini";
import { authenticateApiRequest, verifyTileAccess } from "@/lib/api/auth";
import { createSSEResponse, SSE_ERROR_CODES, SSEWriter } from "@/lib/api/sse";
import { MAX_URLS_PER_TILE } from "@/lib/constants/tiles";
import {
  createExecutionContext,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TIMEOUT_MS,
} from "@/lib/execution/context";
import { logTileJobExecutionEvent } from "@/lib/rate-limit/limiter";
import {
  countActiveUrlSources,
  fetchConnectionContent,
  fetchRuntimeUrlsContent,
  fetchTileSourceContent,
  getTileSourceIdentifiers,
  getTileSourceTypeBreakdown,
  type TileSourceContent,
} from "@/lib/sources/tile-content-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatSupabaseError,
  supabaseErrorMetadata,
} from "@/lib/supabase/errors";
import { triggerDownstreamTiles } from "@/lib/tiles/trigger-downstream";
import type {
  Tile,
  TileConnection,
  TileJobInsert,
  TileJobResult,
  TileJobResultInsert,
  TileJobUpdate,
  TileSource,
} from "@/types/database";

type TileWithSources = Tile & {
  tile_sources: TileSource[];
};

type SimpleTile = {
  id: string;
  name: string;
  tile_type: string;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tileId: string }> },
): Promise<Response> {
  const { tileId } = await params;
  const adminClient = createAdminClient();

  // Set up SSE response
  const { response, controller } = createSSEResponse();

  if (!controller) {
    return new Response(JSON.stringify({ error: "Failed to create stream" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const writer = new SSEWriter(controller);

  // Run the execution in a separate async context
  (async () => {
    try {
      // Parse request body for runtime URLs
      let runtimeUrls: string[] = [];
      try {
        const body = await request.json();
        if (Array.isArray(body?.urls)) {
          runtimeUrls = body.urls;
        }
      } catch {
        // No body or invalid JSON is fine, we'll use configured sources
      }

      if (runtimeUrls.length > MAX_URLS_PER_TILE) {
        writer.sendError(
          `Too many URLs. Maximum ${MAX_URLS_PER_TILE} URLs allowed per request.`,
          SSE_ERROR_CODES.TOO_MANY_URLS,
        );
        writer.close();
        return;
      }

      // Authenticate using API key
      const authResult = await authenticateApiRequest(request);

      if (!authResult.valid || !authResult.mosaicId) {
        writer.sendError(
          authResult.error || "Authentication failed",
          authResult.error?.includes("expired")
            ? SSE_ERROR_CODES.EXPIRED_API_KEY
            : SSE_ERROR_CODES.INVALID_API_KEY,
        );
        writer.close();
        return;
      }

      const mosaicId = authResult.mosaicId;

      // Verify tile belongs to the mosaic
      const accessResult = await verifyTileAccess(tileId, mosaicId);

      if (!accessResult.valid) {
        writer.sendError(
          accessResult.error || "Access denied",
          accessResult.error === "Tile not found"
            ? SSE_ERROR_CODES.TILE_NOT_FOUND
            : SSE_ERROR_CODES.ACCESS_DENIED,
        );
        writer.close();
        return;
      }

      // Fetch tile with sources
      const { data: tile, error: tileError } = await adminClient
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
        writer.sendError("Tile not found", SSE_ERROR_CODES.TILE_NOT_FOUND);
        writer.close();
        return;
      }

      const typedTile = tile as unknown as TileWithSources;

      // Get tile connections
      const { data: incomingConnections } = await adminClient
        .from("tile_connections")
        .select("*")
        .eq("target_tile_id", tileId);

      const connections = (incomingConnections || []) as TileConnection[];

      // Check if tile has sources or connections
      const hasRuntimeUrls = runtimeUrls.length > 0;
      const hasDirectSources =
        typedTile.tile_sources && typedTile.tile_sources.length > 0;
      const hasConnections = connections.length > 0;

      if (!hasRuntimeUrls && !hasDirectSources && !hasConnections) {
        writer.sendError(
          "No sources configured. Tile has no sources and no connected tiles.",
          SSE_ERROR_CODES.NO_SOURCES,
        );
        writer.close();
        return;
      }

      // Determine source mode
      let sourceMode: "runtime" | "configured" | "linked" | "connection" =
        "configured";
      if (hasRuntimeUrls) {
        sourceMode = "runtime";
      } else if (!hasDirectSources && hasConnections) {
        sourceMode = "linked";
      }

      // Create execution context
      const executionContext = createExecutionContext({
        rootAgentId: tileId,
        userId: authResult.apiKey?.created_by || "api-key",
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
          apiKeyId: authResult.apiKey?.id,
          sourceCount: typedTile.tile_sources?.length || 0,
          connectionCount: connections.length,
          triggeredBy: "api",
        },
      });

      // Create job
      const jobInsert: TileJobInsert = {
        tile_id: tileId,
        status: "processing",
        started_at: new Date().toISOString(),
        metadata: {
          execution_id: executionContext.executionId,
          chain_depth: 0,
          triggered_by: "api",
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
          `[v1/tiles/run] Failed to create job for tile ${tileId}:`,
          formatSupabaseError(jobError),
        );
        await logTileJobExecutionEvent(adminClient, {
          executionId: executionContext.executionId,
          tileId: tileId,
          eventType: "failed",
          metadata: {
            phase: "job_creation",
            triggeredBy: "api",
            error: jobError?.message || "No job data returned",
            ...supabaseErrorMetadata(jobError),
          },
        });
        writer.sendError(
          `Failed to create job: ${jobError?.message || "Unknown error"}`,
          SSE_ERROR_CODES.INTERNAL_ERROR,
        );
        writer.close();
        return;
      }

      const job = jobData as { id: string };

      // Send started event
      writer.sendStarted(job.id, tileId);

      // Trigger job.started webhooks (fire and forget)
      triggerTileWebhooks(tileId, "job.started", {
        tile: { id: tileId, name: typedTile.name },
        job: {
          id: job.id,
          started_at: jobInsert.started_at || null,
          completed_at: null,
        },
      }).catch((err) =>
        console.error("Failed to trigger started webhooks:", err),
      );

      // Send context event listing available tiles in the mosaic
      if (hasConnections) {
        const { data: mosaicTilesData } = await adminClient
          .from("tiles")
          .select("id, name, tile_type")
          .eq("mosaic_id", mosaicId)
          .neq("id", tileId);

        const mosaicTiles = (mosaicTilesData || []) as SimpleTile[];

        if (mosaicTiles.length > 0) {
          // Check which tiles have at least one report
          const tileIds = mosaicTiles.map((t) => t.id);
          const { data: reports } = await adminClient
            .from("tile_job_results")
            .select("tile_id")
            .in("tile_id", tileIds)
            .order("created_at", { ascending: false });

          const tilesWithReports = new Set(
            (reports || []).map((r: { tile_id: string }) => r.tile_id),
          );

          writer.sendContext(
            job.id,
            mosaicTiles.map((t) => ({
              tile_id: t.id,
              name: t.name,
              has_report: tilesWithReports.has(t.id),
            })),
          );
        }
      }

      // Fetch content from all sources based on priority
      const sourceResults: TileSourceContent[] = [];

      if (sourceMode === "runtime") {
        writer.sendProgress(job.id, "runtime", "url", "fetching");
        const results = await fetchRuntimeUrlsContent(
          runtimeUrls,
          executionContext,
        );
        sourceResults.push(...results);
        const succeeded = results.filter((r) => r.success).length;
        writer.sendProgress(
          job.id,
          "runtime",
          "url",
          succeeded > 0 ? "completed" : "failed",
        );
      } else if (sourceMode === "configured") {
        // Process direct sources (URL, web search) with per-source progress
        for (const source of typedTile.tile_sources.filter(
          (s) => s.is_active,
        )) {
          writer.sendProgress(job.id, source.id, source.type, "fetching");

          try {
            const result = await fetchTileSourceContent(
              source,
              adminClient,
              executionContext,
            );
            sourceResults.push(result);
            writer.sendProgress(
              job.id,
              source.id,
              source.type,
              result.success ? "completed" : "failed",
              {
                contentLength: result.content?.length,
                error: result.error,
              },
            );
          } catch (err) {
            const errorMessage =
              err instanceof Error ? err.message : "Unknown error";
            writer.sendProgress(job.id, source.id, source.type, "failed", {
              error: errorMessage,
            });
            sourceResults.push({
              sourceId: source.id,
              sourceType: source.type,
              identifier: source.url || source.id,
              success: false,
              error: errorMessage,
            });
          }
        }

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
      }

      // Fetch content from tile connections (always, for both configured and linked modes)
      if (hasConnections) {
        writer.sendProgress(
          job.id,
          "connections",
          "tile_connection",
          "fetching",
        );
        const connectionResults = await fetchConnectionContent(
          tileId,
          typedTile.tile_type,
          connections,
          adminClient,
          executionContext,
          countActiveUrlSources(typedTile.tile_sources ?? []),
        );
        sourceResults.push(...connectionResults);

        // Send per-connection SSE events for analyzer tiles
        if (typedTile.tile_type === "analyzer") {
          for (const result of connectionResults) {
            writer.sendConnection(
              job.id,
              result.metadata?.tileId || result.sourceId,
              result.success ? "completed" : "failed",
              result.success ? undefined : result.error,
            );
          }
        }

        const succeeded = connectionResults.filter((r) => r.success).length;
        writer.sendProgress(
          job.id,
          "connections",
          "tile_connection",
          succeeded > 0 ? "completed" : "failed",
        );
      }

      // Check if we have any successful content
      const successfulFetches = sourceResults.filter(
        (r) => r.success && r.content,
      );
      const fetchedContent = successfulFetches.map((r) => r.content!);

      if (fetchedContent.length === 0) {
        const errorDetails = sourceResults
          .filter((r) => !r.success)
          .map((r) => `${r.identifier}: ${r.error}`)
          .join("; ");

        // Update job as failed
        const failedUpdate: TileJobUpdate = {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: `No content could be fetched. Errors: ${errorDetails}`,
        };

        await adminClient
          .from("tile_jobs")
          .update(failedUpdate as never)
          .eq("id", job.id);

        // Trigger job.failed webhooks
        triggerTileWebhooks(tileId, "job.failed", {
          tile: { id: tileId, name: typedTile.name },
          job: {
            id: job.id,
            started_at: jobInsert.started_at || null,
            completed_at: failedUpdate.completed_at || null,
          },
          error: failedUpdate.error_message || "Fetch failed",
        }).catch((err) =>
          console.error("Failed to trigger failed webhooks:", err),
        );

        writer.sendError(
          `No content could be fetched from sources: ${errorDetails}`,
          SSE_ERROR_CODES.FETCH_FAILED,
        );
        writer.close();
        return;
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
        // Update job as failed
        const failedUpdate: TileJobUpdate = {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: analysis.error || "AI analysis failed",
        };

        await adminClient
          .from("tile_jobs")
          .update(failedUpdate as never)
          .eq("id", job.id);

        // Trigger job.failed webhooks
        triggerTileWebhooks(tileId, "job.failed", {
          tile: { id: tileId, name: typedTile.name },
          job: {
            id: job.id,
            started_at: jobInsert.started_at || null,
            completed_at: failedUpdate.completed_at || null,
          },
          error: failedUpdate.error_message || "AI analysis failed",
        }).catch((err) =>
          console.error("Failed to trigger failed webhooks:", err),
        );

        writer.sendError(
          analysis.error || "AI analysis failed",
          SSE_ERROR_CODES.AI_ANALYSIS_FAILED,
        );
        writer.close();
        return;
      }

      // Get source identifiers for report
      const sourceIdentifiers = getTileSourceIdentifiers(sourceResults);
      const sourceBreakdown = getTileSourceTypeBreakdown(sourceResults);

      // Create job result
      const resultInsert: TileJobResultInsert = {
        job_id: job.id,
        tile_id: tileId,
        content: analysis.content,
        format: typedTile.output_format,
        source_urls: sourceIdentifiers,
      };

      const { data: resultData, error: resultError } = await adminClient
        .from("tile_job_results")
        .insert(resultInsert as never)
        .select()
        .single();

      if (resultError || !resultData) {
        // Update job as failed
        const failedUpdate: TileJobUpdate = {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: "Failed to save result",
        };

        await adminClient
          .from("tile_jobs")
          .update(failedUpdate as never)
          .eq("id", job.id);

        // Trigger job.failed webhooks
        triggerTileWebhooks(tileId, "job.failed", {
          tile: { id: tileId, name: typedTile.name },
          job: {
            id: job.id,
            started_at: jobInsert.started_at || null,
            completed_at: failedUpdate.completed_at || null,
          },
          error: "Failed to save result",
        }).catch((err) =>
          console.error("Failed to trigger failed webhooks:", err),
        );

        writer.sendError(
          "Failed to save result",
          SSE_ERROR_CODES.REPORT_SAVE_FAILED,
        );
        writer.close();
        return;
      }

      const jobResult = resultData as TileJobResult;

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
          triggeredBy: "api",
        },
      });

      // Send result event
      writer.sendResult(job.id, {
        id: jobResult.id,
        content: jobResult.content,
        format: jobResult.format,
        source_urls: jobResult.source_urls,
        created_at: jobResult.created_at,
      });

      // Trigger job.completed webhooks (fire and forget)
      triggerTileWebhooks(tileId, "job.completed", {
        tile: { id: tileId, name: typedTile.name },
        job: {
          id: job.id,
          started_at: jobInsert.started_at || null,
          completed_at: completedUpdate.completed_at || null,
        },
        result: {
          content: jobResult.content,
          format: jobResult.format,
          source_urls: jobResult.source_urls,
        },
      }).catch((err) =>
        console.error("Failed to trigger completed webhooks:", err),
      );

      // Trigger downstream tiles (fire and forget)
      triggerDownstreamTiles(adminClient, {
        completedTileId: tileId,
        completedJobId: job.id,
        mosaicId: mosaicId,
        userId: authResult.apiKey?.created_by || "api-key",
      }).catch((err) =>
        console.error(`[v1/tiles/run] Failed to trigger downstream tiles (tile=${tileId}, job=${job.id}, mosaic=${mosaicId}):`, err),
      );

      // Send done event
      writer.sendDone(job.id);
      writer.close();
    } catch (err) {
      console.error("API tile run error:", err);
      writer.sendError(
        err instanceof Error ? err.message : "Internal server error",
        SSE_ERROR_CODES.INTERNAL_ERROR,
      );
      writer.close();
    }
  })();

  return response;
}
