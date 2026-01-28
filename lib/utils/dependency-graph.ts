import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type DependencyGraph = Map<string, Set<string>>;

interface AgentReportSource {
  agent_id: string;
  source_reference_id: string;
}

/**
 * Builds a dependency graph from all agent_report type sources.
 * The graph maps agent_id -> set of agent_ids it depends on.
 */
export async function buildDependencyGraph(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<DependencyGraph> {
  const { data: sources } = await supabase
    .from("sources")
    .select(
      `
      agent_id,
      source_reference_id,
      agents!sources_agent_id_fkey (owner_id)
    `,
    )
    .eq("type", "agent_report")
    .not("source_reference_id", "is", null);

  if (!sources) return new Map();

  const graph: DependencyGraph = new Map();

  for (const source of sources) {
    const typedSource = source as AgentReportSource & {
      agents: { owner_id: string } | null;
    };

    if (typedSource.agents?.owner_id !== userId) continue;

    const { agent_id, source_reference_id } = typedSource;
    const deps = graph.get(agent_id) ?? new Set<string>();
    deps.add(source_reference_id);
    graph.set(agent_id, deps);
  }

  return graph;
}

/**
 * Detects if there's a circular dependency starting from a given agent.
 * Uses DFS with path tracking.
 */
export function detectCircularDependency(
  graph: DependencyGraph,
  startAgentId: string,
): { hasCycle: boolean; cycle?: string[] } {
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(agentId: string): string[] | null {
    if (path.includes(agentId)) {
      // Found cycle - return the cycle path
      const cycleStart = path.indexOf(agentId);
      return [...path.slice(cycleStart), agentId];
    }

    if (visited.has(agentId)) {
      return null;
    }

    visited.add(agentId);
    path.push(agentId);

    const dependencies = graph.get(agentId);
    if (dependencies) {
      for (const depId of dependencies) {
        const cycle = dfs(depId);
        if (cycle) return cycle;
      }
    }

    path.pop();
    return null;
  }

  const cycle = dfs(startAgentId);
  return cycle ? { hasCycle: true, cycle } : { hasCycle: false };
}

/**
 * Checks if adding a new agent_report source would create a circular dependency.
 * This should be called before inserting a new agent_report source.
 *
 * @param supabase - Supabase client
 * @param userId - The user's ID (for ownership filtering)
 * @param agentId - The agent that would have the new source
 * @param referencedAgentId - The agent being referenced as a source
 */
export async function wouldCreateCircularDependency(
  supabase: SupabaseClient<Database>,
  userId: string,
  agentId: string,
  referencedAgentId: string,
): Promise<{ wouldCreateCycle: boolean; cycle?: string[] }> {
  if (agentId === referencedAgentId) {
    return { wouldCreateCycle: true, cycle: [agentId, agentId] };
  }

  const graph = await buildDependencyGraph(supabase, userId);

  const deps = graph.get(agentId) ?? new Set<string>();
  deps.add(referencedAgentId);
  graph.set(agentId, deps);

  const result = detectCircularDependency(graph, agentId);
  return { wouldCreateCycle: result.hasCycle, cycle: result.cycle };
}
