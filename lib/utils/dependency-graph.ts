import type { SupabaseClient } from "@supabase/supabase-js";

import { HARD_MAX_DEPTH } from "@/lib/execution/context";
import type { Database } from "@/types/database";

type DependencyGraph = Map<string, Set<string>>;

interface AgentReportSource {
  agent_id: string;
  source_reference_id: string;
}

export interface ChainDepthResult {
  depth: number;
  chain: string[];
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
  const pathSet = new Set<string>();
  const pathList: string[] = [];

  function dfs(agentId: string): string[] | null {
    if (pathSet.has(agentId)) {
      const cycleStart = pathList.indexOf(agentId);
      return [...pathList.slice(cycleStart), agentId];
    }

    if (visited.has(agentId)) return null;

    visited.add(agentId);
    pathSet.add(agentId);
    pathList.push(agentId);

    const dependencies = graph.get(agentId);
    if (dependencies) {
      for (const depId of dependencies) {
        const cycle = dfs(depId);
        if (cycle) return cycle;
      }
    }

    pathSet.delete(agentId);
    pathList.pop();
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

/**
 * Calculates the maximum chain depth starting from a given agent.
 * This is the longest path in the dependency graph from this agent.
 */
export function calculateMaxChainDepth(
  graph: DependencyGraph,
  agentId: string,
  visited: Set<string> = new Set(),
): ChainDepthResult {
  if (visited.has(agentId)) {
    return { depth: 0, chain: [] };
  }

  visited.add(agentId);
  const dependencies = graph.get(agentId);

  if (!dependencies || dependencies.size === 0) {
    return { depth: 0, chain: [agentId] };
  }

  let maxDepth = 0;
  let longestChain: string[] = [agentId];

  for (const depId of dependencies) {
    const result = calculateMaxChainDepth(graph, depId, new Set(visited));
    if (result.depth + 1 > maxDepth) {
      maxDepth = result.depth + 1;
      longestChain = [agentId, ...result.chain];
    }
  }

  return { depth: maxDepth, chain: longestChain };
}

/**
 * Calculates the depth of the longest chain that would include the new reference.
 */
export async function calculateChainDepthWithNewReference(
  supabase: SupabaseClient<Database>,
  userId: string,
  agentId: string,
  referencedAgentId: string,
): Promise<ChainDepthResult> {
  const graph = await buildDependencyGraph(supabase, userId);

  // Add the new reference to the graph
  const deps = graph.get(agentId) ?? new Set<string>();
  deps.add(referencedAgentId);
  graph.set(agentId, deps);

  return calculateMaxChainDepth(graph, agentId);
}

/**
 * Checks if adding a new agent_report source would exceed the chain depth limit.
 *
 * @param supabase - Supabase client
 * @param userId - The user's ID (for ownership filtering)
 * @param agentId - The agent that would have the new source
 * @param referencedAgentId - The agent being referenced as a source
 * @param maxDepth - Maximum allowed chain depth (defaults to hard limit)
 */
export async function wouldExceedChainDepth(
  supabase: SupabaseClient<Database>,
  userId: string,
  agentId: string,
  referencedAgentId: string,
  maxDepth: number = HARD_MAX_DEPTH,
): Promise<{
  wouldExceed: boolean;
  currentDepth: number;
  maxDepth: number;
  chain: string[];
}> {
  const result = await calculateChainDepthWithNewReference(
    supabase,
    userId,
    agentId,
    referencedAgentId,
  );

  return {
    wouldExceed: result.depth >= maxDepth,
    currentDepth: result.depth,
    maxDepth,
    chain: result.chain,
  };
}

/**
 * Gets agent names for a list of agent IDs (for better error messages).
 */
export async function getAgentNames(
  supabase: SupabaseClient<Database>,
  agentIds: string[],
): Promise<Map<string, string>> {
  if (agentIds.length === 0) return new Map();

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .in("id", agentIds);

  const nameMap = new Map<string, string>();
  const typedAgents = agents as { id: string; name: string }[] | null;
  for (const agent of typedAgents ?? []) {
    nameMap.set(agent.id, agent.name);
  }

  return nameMap;
}

/**
 * Formats a chain of agent IDs as a readable string with names.
 */
export async function formatChainWithNames(
  supabase: SupabaseClient<Database>,
  chain: string[],
): Promise<string> {
  const nameMap = await getAgentNames(supabase, chain);
  return chain.map((id) => nameMap.get(id) || id.slice(0, 8)).join(" → ");
}
