"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import type { Agent, Job, Json, Report, ReportInsert } from "@/types/database";

export type ReportWithAgent = Report & {
  agent: Pick<Agent, "id" | "name" | "owner_id"> | null;
};

export type ReportWithDetails = Report & {
  agent: Pick<Agent, "id" | "name" | "owner_id"> | null;
  job: Job | null;
};

export async function getReportsForAgent(agentId: string): Promise<Report[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  // Verify ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("owner_id", user.id)
    .single();

  if (!agent) {
    return [];
  }

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching reports:", error);
    return [];
  }

  return (data || []) as Report[];
}

export async function getAllReports(
  limit: number = 50,
): Promise<ReportWithAgent[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      `
      *,
      agent:agents!inner (
        id,
        name,
        owner_id
      )
    `,
    )
    .eq("agents.owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching reports:", error);
    return [];
  }

  return (data || []) as ReportWithAgent[];
}

export async function getReport(id: string): Promise<ReportWithDetails | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("reports")
    .select(
      `
      *,
      agent:agents!inner (
        id,
        name,
        owner_id
      ),
      job:jobs (*)
    `,
    )
    .eq("id", id)
    .eq("agents.owner_id", user.id)
    .single();

  if (error) {
    console.error("Error fetching report:", error);
    return null;
  }

  return data as ReportWithDetails;
}

export async function createReport(
  jobId: string,
  agentId: string,
  content: Json,
  format: "text" | "list" | "table" | "json",
  sourceUrls: string[],
): Promise<Report | null> {
  const supabase = await createClient();

  const reportInsert: ReportInsert = {
    job_id: jobId,
    agent_id: agentId,
    content,
    format,
    source_urls: sourceUrls,
  };

  const { data, error } = await supabase
    .from("reports")
    .insert(reportInsert as never)
    .select()
    .single();

  if (error) {
    console.error("Error creating report:", error);
    return null;
  }

  return data;
}
