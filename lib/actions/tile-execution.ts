"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import type { TileJob, TileReport } from "@/types/database";

export interface TileExecutionStatus {
  lastJob: TileJob | null;
  lastReport: TileReport | null;
  recentJobs: TileJob[];
  sourcesCount: number;
  successfulSources: number;
}

/**
 * Get the execution status for a tile (latest job, report, etc.)
 */
export async function getTileExecutionStatus(
  tileId: string,
): Promise<TileExecutionStatus | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  // Get the last 5 jobs for this tile
  const { data: jobsData, error: jobsError } = await supabase
    .from("tile_jobs")
    .select("*")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (jobsError) {
    console.error("Error fetching tile jobs:", jobsError);
    return null;
  }

  const recentJobs = (jobsData || []) as TileJob[];
  const lastJob = recentJobs[0] || null;

  // Get the last report if there's a completed job
  let lastReport: TileReport | null = null;
  if (lastJob?.status === "completed") {
    const { data: reportData } = await supabase
      .from("tile_reports")
      .select("*")
      .eq("job_id", lastJob.id)
      .single();

    lastReport = reportData ? (reportData as TileReport) : null;
  }

  // Get sources count
  const { count: sourcesCount } = await supabase
    .from("tile_sources")
    .select("*", { count: "exact", head: true })
    .eq("tile_id", tileId);

  // Calculate successful sources from last job metadata
  const successfulSources =
    (lastJob?.metadata as Record<string, unknown>)?.successful_sources || 0;

  return {
    lastJob,
    lastReport,
    recentJobs,
    sourcesCount: sourcesCount || 0,
    successfulSources: Number(successfulSources),
  };
}

export interface ExecutionLogEntry {
  id: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Get execution logs for a specific job
 */
export async function getTileExecutionLogs(
  jobId: string,
): Promise<ExecutionLogEntry[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("execution_logs")
    .select("id, event_type, metadata, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching execution logs:", error);
    return [];
  }

  return (data || []) as ExecutionLogEntry[];
}

/**
 * Get all execution logs for a tile (across all jobs)
 */
export async function getTileAllExecutionLogs(
  tileId: string,
  limit: number = 50,
): Promise<ExecutionLogEntry[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  // First get job IDs for this tile
  const { data: jobsData } = await supabase
    .from("tile_jobs")
    .select("id")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!jobsData || jobsData.length === 0) {
    return [];
  }

  const jobIds = (jobsData as { id: string }[]).map((j) => j.id);

  const { data, error } = await supabase
    .from("execution_logs")
    .select("id, event_type, metadata, created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching execution logs:", error);
    return [];
  }

  return (data || []) as ExecutionLogEntry[];
}

export interface TileReportSummary {
  id: string;
  job_id: string;
  content: unknown;
  format: string;
  source_urls: string[];
  created_at: string;
}

/**
 * Get recent reports for a tile
 */
export async function getTileReports(
  tileId: string,
  limit: number = 10,
): Promise<TileReportSummary[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("tile_reports")
    .select("id, job_id, content, format, source_urls, created_at")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching tile reports:", error);
    return [];
  }

  return (data || []) as TileReportSummary[];
}
