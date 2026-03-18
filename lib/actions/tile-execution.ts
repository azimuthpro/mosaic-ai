"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import type { TileJob } from "@/types/database";

export interface TileExecutionStatus {
  lastJob: TileJob | null;
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

  // Get the last 10 jobs for this tile (matches execution logs window)
  const { data: jobsData, error: jobsError } = await supabase
    .from("tile_jobs")
    .select("*")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (jobsError) {
    console.error("Error fetching tile jobs:", jobsError);
    return null;
  }

  const recentJobs = (jobsData || []) as TileJob[];
  const lastJob = recentJobs[0] || null;

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

  // Query logs directly by tile_id (includes events with null job_id, e.g. "started")
  const { data, error } = await supabase
    .from("tile_job_execution_logs")
    .select("id, job_id, event_type, metadata, created_at")
    .eq("tile_id", tileId)
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
 * Delete a single execution log entry
 */
export async function deleteExecutionLog(
  logId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Fetch the log entry to get the job_id before deleting
  const { data: logEntry } = await supabase
    .from("tile_job_execution_logs")
    .select("job_id")
    .eq("id", logId)
    .single<{ job_id: string | null }>();

  const { error } = await supabase
    .from("tile_job_execution_logs")
    .delete()
    .eq("id", logId);

  if (error) {
    console.error("Error deleting execution log:", error);
    return { success: false, error: "Failed to delete execution log" };
  }

  // Also delete the associated job and its results
  if (logEntry?.job_id) {
    await supabase
      .from("tile_job_results")
      .delete()
      .eq("job_id", logEntry.job_id);
    await supabase.from("tile_jobs").delete().eq("id", logEntry.job_id);
  }

  return { success: true };
}

/**
 * Delete all execution logs for a tile
 */
export async function deleteAllExecutionLogs(
  tileId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Delete execution logs
  const { error } = await supabase
    .from("tile_job_execution_logs")
    .delete()
    .eq("tile_id", tileId);

  if (error) {
    console.error("Error deleting all execution logs:", error);
    return { success: false, error: "Failed to delete execution logs" };
  }

  // Delete all job results and jobs for this tile
  await supabase.from("tile_job_results").delete().eq("tile_id", tileId);
  await supabase.from("tile_jobs").delete().eq("tile_id", tileId);

  return { success: true };
}

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
