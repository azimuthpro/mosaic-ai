"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import type { TileJob, TileJobResult } from "@/types/database";

export interface TileExecutionStatus {
  lastJob: TileJob | null;
  lastResult: TileJobResult | null;
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

  // Get the last result if there's a completed job
  let lastResult: TileJobResult | null = null;
  if (lastJob?.status === "completed") {
    const { data: resultData } = await supabase
      .from("tile_job_results")
      .select("*")
      .eq("job_id", lastJob.id)
      .single();

    lastResult = resultData ? (resultData as TileJobResult) : null;
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
    lastResult,
    recentJobs,
    sourcesCount: sourcesCount || 0,
    successfulSources: Number(successfulSources),
  };
}

export interface ExecutionLogEntry {
  id: string;
  job_id: string;
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
    .from("tile_job_execution_logs")
    .select("id, job_id, event_type, metadata, created_at")
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
    .from("tile_job_execution_logs")
    .select("id, job_id, event_type, metadata, created_at")
    .in("job_id", jobIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching execution logs:", error);
    return [];
  }

  return (data || []) as ExecutionLogEntry[];
}

export interface TileJobResultSummary {
  id: string;
  job_id: string;
  content: unknown;
  format: string;
  source_urls: string[];
  created_at: string;
}

// Backwards compatible alias
export type TileReportSummary = TileJobResultSummary;

/**
 * Get recent job results for a tile
 */
export async function getTileJobResults(
  tileId: string,
  limit: number = 10,
): Promise<TileJobResultSummary[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("tile_job_results")
    .select("id, job_id, content, format, source_urls, created_at")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching tile job results:", error);
    return [];
  }

  return (data || []) as TileJobResultSummary[];
}

// Backwards compatible alias
export const getTileReports = getTileJobResults;

/**
 * Delete a tile job result (owners and admins only)
 */
export async function deleteTileJobResult(
  resultId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("tile_job_results")
    .delete()
    .eq("id", resultId);

  if (error) {
    console.error("Error deleting tile job result:", error);
    return { success: false, error: "Failed to delete job result" };
  }

  return { success: true };
}

/**
 * Delete a tile job and its results (owners and admins only)
 */
export async function deleteTileJob(
  jobId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("tile_jobs").delete().eq("id", jobId);

  if (error) {
    console.error("Error deleting tile job:", error);
    return { success: false, error: "Failed to delete job" };
  }

  return { success: true };
}
