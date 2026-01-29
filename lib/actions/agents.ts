"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getUser } from "@/lib/supabase/server";
import { wouldCreateCircularDependency } from "@/lib/utils/dependency-graph";
import type {
  Agent,
  AgentInsert,
  AgentUpdate,
  Json,
  LanguageCode,
  OutputFormat,
  Source,
  SourceInsert,
  SourceType,
  WebSearchConfig,
} from "@/types/database";

export type AgentWithSources = Agent & { sources: Source[] };

type SourceWithAgent = {
  id: string;
  agent_id: string;
  agents: { owner_id: string };
};

export async function getAgents(): Promise<AgentWithSources[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  // Get agents owned by user
  const { data, error } = await supabase
    .from("agents")
    .select(
      `
      *,
      sources!sources_agent_id_fkey (*)
    `,
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching agents:", error);
    return [];
  }

  return (data || []) as AgentWithSources[];
}

/**
 * Gets agents that are shared with the current user (not owned by them).
 */
export async function getSharedAgents(): Promise<AgentWithSources[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  // Get agent IDs where user is a member
  const { data: membershipsData } = await supabase
    .from("agent_members")
    .select("agent_id")
    .eq("user_id", user.id);

  const memberships = membershipsData as { agent_id: string }[] | null;

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const agentIds = memberships.map((m) => m.agent_id);

  // Get those agents (excluding ones the user owns)
  const { data, error } = await supabase
    .from("agents")
    .select(
      `
      *,
      sources!sources_agent_id_fkey (*)
    `,
    )
    .in("id", agentIds)
    .neq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching shared agents:", error);
    return [];
  }

  return (data || []) as AgentWithSources[];
}

export async function getAgent(id: string): Promise<AgentWithSources | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  // First try to get as owner
  const { data: ownedAgent } = await supabase
    .from("agents")
    .select(
      `
      *,
      sources!sources_agent_id_fkey (*)
    `,
    )
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  if (ownedAgent) {
    return ownedAgent as AgentWithSources;
  }

  // Check if user is a member of this agent
  const { data: membership } = await supabase
    .from("agent_members")
    .select("id")
    .eq("agent_id", id)
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return null;
  }

  // User is a member, get the agent
  const { data, error } = await supabase
    .from("agents")
    .select(
      `
      *,
      sources!sources_agent_id_fkey (*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching shared agent:", error);
    return null;
  }

  return data as AgentWithSources;
}

export async function createAgent(formData: FormData) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const systemPrompt = formData.get("systemPrompt") as string;
  const outputFormat = (formData.get("outputFormat") as OutputFormat) || "text";
  const language = (formData.get("language") as LanguageCode) || "en";
  const scheduleCron = formData.get("scheduleCron") as string | null;
  const sourcesJson = formData.get("sources") as string;

  // Parse sources (frontend sends camelCase)
  let sources: {
    url?: string;
    name?: string;
    type?: SourceType;
    sourceReferenceId?: string;
    config?: WebSearchConfig;
  }[] = [];
  try {
    sources = JSON.parse(sourcesJson || "[]");
  } catch {
    return { error: "Invalid sources format" };
  }

  // Create agent
  const agentInsert: AgentInsert = {
    owner_id: user.id,
    name,
    description: description || null,
    system_prompt: systemPrompt,
    output_format: outputFormat,
    language,
    schedule_cron: scheduleCron || null,
    is_active: true,
  };

  const { data: agentData, error: agentError } = await supabase
    .from("agents")
    .insert(agentInsert as never)
    .select()
    .single();

  const agent = agentData as Agent | null;

  if (agentError || !agent) {
    console.error("Error creating agent:", agentError);
    return { error: "Failed to create agent" };
  }

  // Create sources
  if (sources.length > 0) {
    // Check for circular dependencies in agent_report sources
    for (const source of sources) {
      if (source.type === "agent_report" && source.sourceReferenceId) {
        const { wouldCreateCycle } = await wouldCreateCircularDependency(
          supabase,
          user.id,
          agent.id,
          source.sourceReferenceId,
        );
        if (wouldCreateCycle) {
          // Delete the agent we just created since sources have circular dependency
          await supabase.from("agents").delete().eq("id", agent.id);
          return {
            error:
              "Cannot create agent: adding this agent as a source would create a circular dependency",
          };
        }
      }
    }

    // Validate web_search sources have required config
    for (const source of sources) {
      if (source.type === "web_search" && !source.config?.query) {
        await supabase.from("agents").delete().eq("id", agent.id);
        return { error: "Web search source requires a search query" };
      }
    }

    const sourceData: SourceInsert[] = sources.map((s) => ({
      agent_id: agent.id,
      url: s.type === "url" ? s.url : null,
      name: s.name || null,
      type: s.type || "url",
      source_reference_id:
        s.type === "agent_report" ? s.sourceReferenceId : null,
      config:
        s.type === "web_search" && s.config
          ? (s.config as unknown as Json)
          : {},
    }));

    const { error: sourcesError } = await supabase
      .from("sources")
      .insert(sourceData as never);

    if (sourcesError) {
      console.error("Error creating sources:", sourcesError);
      // Rollback: delete the agent we just created
      await supabase.from("agents").delete().eq("id", agent.id);
      return { error: "Failed to create sources" };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/agents");
  redirect(`/agents/${agent.id}`);
}

export async function updateAgent(id: string, formData: FormData) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const systemPrompt = formData.get("systemPrompt") as string;
  const outputFormat = (formData.get("outputFormat") as OutputFormat) || "text";
  const language = (formData.get("language") as LanguageCode) || "en";
  const scheduleCron = formData.get("scheduleCron") as string | null;
  const isActive = formData.get("isActive") === "true";

  const updateData: AgentUpdate = {
    name,
    description: description || null,
    system_prompt: systemPrompt,
    output_format: outputFormat,
    language,
    schedule_cron: scheduleCron || null,
    is_active: isActive,
  };

  const { error } = await supabase
    .from("agents")
    .update(updateData as never)
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Error updating agent:", error);
    return { error: "Failed to update agent" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/agents");
  revalidatePath(`/agents/${id}`);

  return { success: true };
}

export async function deleteAgent(id: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Error deleting agent:", error);
    return { error: "Failed to delete agent" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/agents");
  redirect("/dashboard");
}

export async function toggleAgentActive(id: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get current state
  const { data: agentData, error: fetchError } = await supabase
    .from("agents")
    .select("is_active")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();

  const agent = agentData as { is_active: boolean } | null;

  if (fetchError || !agent) {
    return { error: "Agent not found" };
  }

  const newIsActive = !agent.is_active;

  // Toggle
  const { error } = await supabase
    .from("agents")
    .update({ is_active: newIsActive } as never)
    .eq("id", id)
    .eq("owner_id", user.id);

  if (error) {
    console.error("Error toggling agent:", error);
    return { error: "Failed to toggle agent" };
  }

  revalidatePath("/dashboard");
  revalidatePath("/agents");
  revalidatePath(`/agents/${id}`);

  return { success: true, isActive: newIsActive };
}

// Source management
interface AddSourceParams {
  agentId: string;
  type?: SourceType;
  url?: string;
  name?: string;
  sourceReferenceId?: string;
  config?: WebSearchConfig;
}

export async function addSource(
  agentId: string,
  urlOrParams: string | AddSourceParams,
  name?: string,
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const params: AddSourceParams =
    typeof urlOrParams === "string"
      ? { agentId, type: "url", url: urlOrParams, name }
      : { ...urlOrParams, agentId };

  const sourceType = params.type ?? "url";

  // Verify agent ownership
  const { data: agent } = await supabase
    .from("agents")
    .select("id")
    .eq("id", agentId)
    .eq("owner_id", user.id)
    .single();

  if (!agent) {
    return { error: "Agent not found" };
  }

  // For agent_report type, verify ownership of referenced agent and check for circular dependencies
  if (sourceType === "agent_report") {
    if (!params.sourceReferenceId) {
      return { error: "Agent report source requires a reference agent" };
    }

    // Verify ownership of referenced agent
    const { data: referencedAgent } = await supabase
      .from("agents")
      .select("id, name")
      .eq("id", params.sourceReferenceId)
      .eq("owner_id", user.id)
      .single();

    if (!referencedAgent) {
      return { error: "Referenced agent not found or not owned by you" };
    }

    // Check for circular dependency
    const { wouldCreateCycle, cycle } = await wouldCreateCircularDependency(
      supabase,
      user.id,
      agentId,
      params.sourceReferenceId,
    );

    if (wouldCreateCycle) {
      return {
        error: `Cannot add source: would create circular dependency${cycle ? ` (${cycle.join(" -> ")})` : ""}`,
      };
    }
  }

  // For web_search type, validate that query is provided
  if (sourceType === "web_search") {
    if (!params.config?.query) {
      return { error: "Web search source requires a search query" };
    }
  }

  const sourceInsert: SourceInsert = {
    agent_id: agentId,
    type: sourceType,
    url: sourceType === "url" ? params.url : null,
    name: params.name ?? null,
    source_reference_id:
      sourceType === "agent_report" ? params.sourceReferenceId : null,
    config:
      sourceType === "web_search" && params.config
        ? (params.config as unknown as Json)
        : {},
  };

  const { data, error } = await supabase
    .from("sources")
    .insert(sourceInsert as never)
    .select()
    .single();

  if (error) {
    console.error("Error adding source:", error);
    return { error: "Failed to add source" };
  }

  revalidatePath(`/agents/${agentId}`);
  return { success: true, source: data };
}

export async function deleteSource(sourceId: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get source and verify ownership through agent
  const { data: source } = await supabase
    .from("sources")
    .select(
      `
      id,
      agent_id,
      agents!inner (owner_id)
    `,
    )
    .eq("id", sourceId)
    .single();

  const typedSource = source as SourceWithAgent | null;

  if (!typedSource || typedSource.agents.owner_id !== user.id) {
    return { error: "Source not found" };
  }

  const { error } = await supabase.from("sources").delete().eq("id", sourceId);

  if (error) {
    console.error("Error deleting source:", error);
    return { error: "Failed to delete source" };
  }

  revalidatePath(`/agents/${typedSource.agent_id}`);
  return { success: true };
}

/**
 * Gets user's agents that can be used as sources for another agent.
 * Excludes the agent being edited to prevent self-reference.
 */
export async function getUserAgentsForSourceSelection(
  excludeAgentId?: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  let query = supabase
    .from("agents")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("name", { ascending: true });

  if (excludeAgentId) {
    query = query.neq("id", excludeAgentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching agents for source selection:", error);
    return [];
  }

  return (data || []) as { id: string; name: string }[];
}
