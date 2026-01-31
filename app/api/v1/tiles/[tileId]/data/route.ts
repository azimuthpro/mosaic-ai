import { NextResponse } from "next/server";

import { authenticateApiRequest, verifyTileAccess } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractUrlsFromReport } from "@/lib/tiles/extract-urls-from-job";
import type { TileJob, TileJobResult } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JobWithReport = TileJob & {
  tile_job_results: TileJobResult[] | null;
};

interface UrlReaderDataResponse {
  urls: string[];
  job_id: string;
  created_at: string;
  history?: Array<{
    job_id: string;
    urls: string[];
    created_at: string;
  }>;
}

interface AnalyzerDataResponse {
  content: string;
  format: string;
  job_id: string;
  created_at: string;
  source_urls: string[];
  history?: Array<{
    job_id: string;
    content: string;
    format: string;
    created_at: string;
  }>;
}

interface DefaultDataResponse {
  job_id: string;
  status: string;
  created_at: string;
  result: {
    content: unknown;
    format: string;
    source_urls: string[];
  } | null;
  history?: Array<{
    job_id: string;
    status: string;
    created_at: string;
    result: {
      content: unknown;
      format: string;
    } | null;
  }>;
}

/**
 * GET /api/v1/tiles/{tileId}/data
 *
 * Returns tile data formatted for the requester's tile type.
 *
 * Query params:
 * - for: The requester's tile type (url_reader, analyzer, etc.)
 * - include_history: Whether to include last 10 jobs (default: false)
 *
 * Response varies by `for` param:
 * - for=url_reader: { urls: string[], job_id, created_at }
 * - for=analyzer: { content: string, format: string, job_id, created_at, source_urls }
 * - default: { job_id, status, created_at, result: { content, format, source_urls } }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tileId: string }> },
): Promise<Response> {
  const { tileId } = await params;

  // Authenticate using API key
  const authResult = await authenticateApiRequest(request);

  if (!authResult.valid || !authResult.mosaicId) {
    return NextResponse.json(
      {
        error: authResult.error || "Authentication failed",
        code: authResult.error?.includes("expired")
          ? "EXPIRED_API_KEY"
          : "INVALID_API_KEY",
      },
      { status: 401 },
    );
  }

  // Verify tile belongs to the mosaic
  const accessResult = await verifyTileAccess(tileId, authResult.mosaicId);

  if (!accessResult.valid) {
    return NextResponse.json(
      {
        error: accessResult.error || "Access denied",
        code:
          accessResult.error === "Tile not found"
            ? "TILE_NOT_FOUND"
            : "ACCESS_DENIED",
      },
      { status: accessResult.error === "Tile not found" ? 404 : 403 },
    );
  }

  const url = new URL(request.url);
  const forType = url.searchParams.get("for") || "default";
  const includeHistory = url.searchParams.get("include_history") === "true";

  const adminClient = createAdminClient();

  // Get the latest completed job with its report
  const { data: latestJobData, error: latestJobError } = await adminClient
    .from("tile_jobs")
    .select(
      `
      *,
      tile_job_results (*)
    `,
    )
    .eq("tile_id", tileId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (latestJobError || !latestJobData) {
    return NextResponse.json(
      {
        tile_id: tileId,
        status: "no_data",
        message: "No completed jobs found for this tile",
      },
      { status: 200 },
    );
  }

  const latestJob = latestJobData as unknown as JobWithReport;
  const latestReport =
    latestJob.tile_job_results && latestJob.tile_job_results.length > 0
      ? latestJob.tile_job_results[0]
      : null;

  if (!latestReport) {
    return NextResponse.json(
      {
        tile_id: tileId,
        status: "no_report",
        message: "Latest job has no report",
      },
      { status: 200 },
    );
  }

  // Optionally fetch history (last 10 jobs excluding the latest)
  let history: JobWithReport[] = [];
  if (includeHistory) {
    const { data: historyData } = await adminClient
      .from("tile_jobs")
      .select(
        `
        *,
        tile_job_results (*)
      `,
      )
      .eq("tile_id", tileId)
      .eq("status", "completed")
      .neq("id", latestJob.id)
      .order("created_at", { ascending: false })
      .limit(10);

    history = (historyData || []) as unknown as JobWithReport[];
  }

  // Format response based on requester type
  switch (forType) {
    case "url_reader": {
      const urls = extractUrlsFromReport(latestReport);
      const response: UrlReaderDataResponse = {
        urls,
        job_id: latestJob.id,
        created_at: latestReport.created_at,
      };

      if (includeHistory && history.length > 0) {
        response.history = history
          .filter((j) => j.tile_job_results && j.tile_job_results.length > 0)
          .map((j) => ({
            job_id: j.id,
            urls: extractUrlsFromReport(j.tile_job_results![0]),
            created_at: j.tile_job_results![0].created_at,
          }));
      }

      return NextResponse.json(response);
    }

    case "analyzer": {
      const content =
        typeof latestReport.content === "string"
          ? latestReport.content
          : JSON.stringify(latestReport.content, null, 2);

      const response: AnalyzerDataResponse = {
        content,
        format: latestReport.format,
        job_id: latestJob.id,
        created_at: latestReport.created_at,
        source_urls: latestReport.source_urls,
      };

      if (includeHistory && history.length > 0) {
        response.history = history
          .filter((j) => j.tile_job_results && j.tile_job_results.length > 0)
          .map((j) => {
            const report = j.tile_job_results![0];
            return {
              job_id: j.id,
              content:
                typeof report.content === "string"
                  ? report.content
                  : JSON.stringify(report.content, null, 2),
              format: report.format,
              created_at: report.created_at,
            };
          });
      }

      return NextResponse.json(response);
    }

    default: {
      const response: DefaultDataResponse = {
        job_id: latestJob.id,
        status: latestJob.status,
        created_at: latestReport.created_at,
        result: {
          content: latestReport.content,
          format: latestReport.format,
          source_urls: latestReport.source_urls,
        },
      };

      if (includeHistory && history.length > 0) {
        response.history = history.map((j) => ({
          job_id: j.id,
          status: j.status,
          created_at: j.created_at,
          result:
            j.tile_job_results && j.tile_job_results.length > 0
              ? {
                  content: j.tile_job_results[0].content,
                  format: j.tile_job_results[0].format,
                }
              : null,
        }));
      }

      return NextResponse.json(response);
    }
  }
}
