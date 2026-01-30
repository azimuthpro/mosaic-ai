import { NextResponse } from "next/server";

import { authenticateApiRequest, verifyTileAccess } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TileJob, TileReport } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JobWithReport = TileJob & {
  tile_reports: TileReport[] | null;
};

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

  const adminClient = createAdminClient();

  // Get the latest job for this tile
  const { data: jobData, error: jobError } = await adminClient
    .from("tile_jobs")
    .select(
      `
      *,
      tile_reports (*)
    `,
    )
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (jobError || !jobData) {
    return NextResponse.json(
      {
        tile_id: tileId,
        status: "no_jobs",
        message: "No jobs have been run for this tile yet",
      },
      { status: 200 },
    );
  }

  const job = jobData as unknown as JobWithReport;
  const report =
    job.tile_reports && job.tile_reports.length > 0
      ? job.tile_reports[0]
      : null;

  return NextResponse.json({
    tile_id: tileId,
    job_id: job.id,
    status: job.status,
    started_at: job.started_at,
    completed_at: job.completed_at,
    error_message: job.error_message,
    execution_id: job.execution_id,
    metadata: job.metadata,
    report: report
      ? {
          id: report.id,
          content: report.content,
          format: report.format,
          source_urls: report.source_urls,
          created_at: report.created_at,
        }
      : null,
  });
}
