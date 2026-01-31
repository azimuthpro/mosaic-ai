import { analyzeContent } from "@/lib/ai/gemini";
import { authenticateApiRequest, verifyTileAccess } from "@/lib/api/auth";
import { createSSEResponse, SSE_ERROR_CODES, SSEWriter } from "@/lib/api/sse";
import {
  createExecutionContext,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TIMEOUT_MS,
} from "@/lib/execution/context";
import { logExecutionEvent } from "@/lib/rate-limit/limiter";
import {
  fetchLinkedTileUrls,
  fetchRuntimeUrlsContent,
  fetchTileSourceContent,
  getTileSourceIdentifiers,
  getTileSourceTypeBreakdown,
  type TileSourceContent,
} from "@/lib/sources/tile-content-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Tile,
  TileConnection,
  TileJobInsert,
  TileJobUpdate,
  TileReport,
  TileReportInsert,
  TileSource,
} from "@/types/database";

type TileWithSources = Tile & {
  tile_sources: TileSource[];
};

type TileWithReport = {
  id: string;
  name: string;
  tile_type: string;
  latest_report: TileReport | null;
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

      // Get tile connections for pipeline/analyzer tiles
      const { data: incomingConnections } = await adminClient
        .from("tile_connections")
        .select("*")
        .eq("target_tile_id", tileId);

      const connections = (incomingConnections || []) as TileConnection[];

      // Check if tile has sources or connections (for pipeline tiles)
      const isPipelineTile =
        typedTile.tile_type === "recursive" ||
        typedTile.tile_type === "analyzer";
      const hasRuntimeUrls = runtimeUrls.length > 0;
      const hasDirectSources =
        typedTile.tile_sources && typedTile.tile_sources.length > 0;
      const hasConnections = connections.length > 0;

      // For url_reader tiles, check if we can get URLs from linked tiles
      let linkedTileUrls: string[] = [];
      if (
        !hasRuntimeUrls &&
        !hasDirectSources &&
        typedTile.tile_type === "url_reader"
      ) {
        linkedTileUrls = await fetchLinkedTileUrls(tileId, adminClient);
      }

      if (
        !hasRuntimeUrls &&
        !hasDirectSources &&
        !hasConnections &&
        linkedTileUrls.length === 0
      ) {
        writer.sendError(
          "No URLs provided. Tile has no sources configured and no linked tiles.",
          SSE_ERROR_CODES.NO_SOURCES,
        );
        writer.close();
        return;
      }

      // Determine source mode for url_reader tiles
      let sourceMode: "runtime" | "configured" | "linked" | "pipeline" =
        "configured";
      if (hasRuntimeUrls) {
        sourceMode = "runtime";
      } else if (!hasDirectSources && linkedTileUrls.length > 0) {
        sourceMode = "linked";
      } else if (isPipelineTile && hasConnections) {
        sourceMode = "pipeline";
      }

      // Create execution context
      const executionContext = createExecutionContext({
        rootAgentId: tileId,
        userId: authResult.apiKey?.created_by || "api-key",
        maxDepth: typedTile.max_chain_depth ?? DEFAULT_MAX_DEPTH,
        timeoutMs: typedTile.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS,
      });

      // Log execution start
      await logExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        agentId: tileId,
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
        writer.sendError(
          "Failed to create job",
          SSE_ERROR_CODES.INTERNAL_ERROR,
        );
        writer.close();
        return;
      }

      const job = jobData as { id: string };

      // Send started event
      writer.sendStarted(job.id, tileId);

      // For pipeline tiles, get all tiles in the mosaic for context
      let availableTiles: TileWithReport[] = [];

      if (isPipelineTile) {
        // Fetch all tiles in the mosaic with their latest reports
        const { data: mosaicTilesData } = await adminClient
          .from("tiles")
          .select("id, name, tile_type")
          .eq("mosaic_id", mosaicId)
          .neq("id", tileId);

        const mosaicTiles = (mosaicTilesData || []) as SimpleTile[];

        if (mosaicTiles.length > 0) {
          // Get latest reports for each tile
          const tileIds = mosaicTiles.map((t) => t.id);
          const { data: reports } = await adminClient
            .from("tile_reports")
            .select("*")
            .in("tile_id", tileIds)
            .order("created_at", { ascending: false });

          const reportsByTile = new Map<string, TileReport>();
          for (const report of (reports || []) as TileReport[]) {
            if (!reportsByTile.has(report.tile_id)) {
              reportsByTile.set(report.tile_id, report);
            }
          }

          availableTiles = mosaicTiles.map((t) => ({
            id: t.id,
            name: t.name,
            tile_type: t.tile_type,
            latest_report: reportsByTile.get(t.id) || null,
          }));

          // Send context event
          writer.sendContext(
            job.id,
            availableTiles.map((t) => ({
              tile_id: t.id,
              name: t.name,
              has_report: t.latest_report !== null,
            })),
          );
        }
      }

      // Fetch content from all sources based on priority
      const sourceResults: TileSourceContent[] = [];

      // Source priority for url_reader tiles:
      // 1. Runtime URLs (if provided) - use only these
      // 2. Configured sources - use if no runtime URLs
      // 3. Linked tile URLs - use if no runtime URLs and no configured sources
      if (sourceMode === "runtime") {
        // Process runtime URLs
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
      } else if (sourceMode === "linked") {
        // Process linked tile URLs
        writer.sendProgress(job.id, "linked", "url", "fetching");

        const results = await fetchRuntimeUrlsContent(
          linkedTileUrls,
          executionContext,
        );
        sourceResults.push(...results);

        const succeeded = results.filter((r) => r.success).length;
        writer.sendProgress(
          job.id,
          "linked",
          "url",
          succeeded > 0 ? "completed" : "failed",
        );
      } else if (typedTile.tile_sources && typedTile.tile_sources.length > 0) {
        // Process direct sources (URL, web search)
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
      }

      // Process connected tiles (for pipeline/analyzer)
      if (isPipelineTile && connections.length > 0) {
        for (const connection of connections) {
          const connectedTile = availableTiles.find(
            (t) => t.id === connection.source_tile_id,
          );

          if (!connectedTile) continue;

          writer.sendPipeline(
            job.id,
            connection.source_tile_id,
            "fetching_report",
          );

          if (connectedTile.latest_report) {
            // Format report content
            const content =
              typeof connectedTile.latest_report.content === "string"
                ? connectedTile.latest_report.content
                : JSON.stringify(connectedTile.latest_report.content, null, 2);

            sourceResults.push({
              sourceId: connection.id,
              sourceType: "agent_report",
              identifier: connectedTile.name,
              success: true,
              content,
              title: `Report from ${connectedTile.name}`,
              metadata: {
                reportId: connectedTile.latest_report.id,
                reportCreatedAt: connectedTile.latest_report.created_at,
                tileId: connectedTile.id,
                tileName: connectedTile.name,
              },
            });

            writer.sendPipeline(job.id, connection.source_tile_id, "completed");
          } else {
            writer.sendPipeline(
              job.id,
              connection.source_tile_id,
              "failed",
              "No report available",
            );
          }
        }
      }

      // Update source last_scraped_at (only for configured sources mode)
      if (sourceMode === "configured" && typedTile.tile_sources) {
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

      // Create report
      const reportInsert: TileReportInsert = {
        job_id: job.id,
        tile_id: tileId,
        content: analysis.content,
        format: typedTile.output_format,
        source_urls: sourceIdentifiers,
      };

      const { data: reportData, error: reportError } = await adminClient
        .from("tile_reports")
        .insert(reportInsert as never)
        .select()
        .single();

      if (reportError || !reportData) {
        // Update job as failed
        const failedUpdate: TileJobUpdate = {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: "Failed to save report",
        };

        await adminClient
          .from("tile_jobs")
          .update(failedUpdate as never)
          .eq("id", job.id);

        writer.sendError(
          "Failed to save report",
          SSE_ERROR_CODES.REPORT_SAVE_FAILED,
        );
        writer.close();
        return;
      }

      const report = reportData as TileReport;

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
      await logExecutionEvent(adminClient, {
        executionId: executionContext.executionId,
        agentId: tileId,
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
        id: report.id,
        content: report.content,
        format: report.format,
        source_urls: report.source_urls,
        created_at: report.created_at,
      });

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
