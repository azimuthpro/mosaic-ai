import { generateText } from "ai";

import { flashModel } from "@/lib/ai/models";
import { normalizeGitHubConfig } from "@/lib/github/execute-github-issue";
import type { GitHubIssueConfig, Tile, TileSource } from "@/types/database";

import type { TileEnrichment } from "./types";
import { stripCodeFences } from "./utils";

function describeSource(s: TileSource): string {
  const config = s.config as Record<string, unknown> | null;
  switch (s.type) {
    case "url":
      return s.url ? `URL: ${s.url}` : "Source: url";
    case "web_search":
      return `Web Search: "${config?.query || "unknown"}"`;
    case "slack_channel":
      return `Slack Channel: #${config?.channel_name || "unknown"}`;
    default:
      return `Source: ${s.type}`;
  }
}

/** Build a text summary of a tile's configuration for the LLM */
function buildTileContext(tile: Tile, sources: TileSource[]): string {
  const parts: string[] = [
    `Tile Name: ${tile.name}`,
    `Type: ${tile.tile_type}`,
  ];

  if (tile.description) {
    parts.push(`Description: ${tile.description}`);
  }
  if (tile.system_prompt) {
    parts.push(`System Prompt: ${tile.system_prompt}`);
  }
  if (tile.output_format) {
    parts.push(`Output Format: ${tile.output_format}`);
  }

  if (sources.length > 0) {
    const sourceDescs = sources.map((s) => describeSource(s));
    parts.push(`Sources: ${sourceDescs.join(", ")}`);
  }

  const hasConfig =
    tile.config &&
    typeof tile.config === "object" &&
    Object.keys(tile.config as object).length > 0;

  if (hasConfig) {
    parts.push(`Config: ${JSON.stringify(tile.config)}`);
  }

  if (tile.tile_type === "github_issue" && hasConfig) {
    const { repos } = normalizeGitHubConfig(
      tile.config as unknown as GitHubIssueConfig,
    );
    if (repos.length > 0) {
      parts.push(
        `GitHub Repositories: ${repos.map((r) => `${r.owner}/${r.repo}`).join(", ")}`,
      );
    }
  }

  return parts.join("\n");
}

/** Generate semantic enrichment for a tile using LLM */
export async function enrichTile(
  tile: Tile,
  sources: TileSource[],
): Promise<TileEnrichment> {
  const context = buildTileContext(tile, sources);

  const prompt = `You are analyzing an AI tile configuration to generate semantic metadata for search indexing.

Given the following tile configuration:
${context}

Generate a JSON object with exactly these fields:
1. "semantic_description": A 2-3 sentence natural language description of what this tile does, what kind of information it provides, and what questions it can answer. Be specific about the domain and capabilities.
2. "keywords": An array of 5-15 relevant keywords/phrases that a user might search for when looking for this tile's capabilities.
3. "example_queries": An array of exactly 3 natural language questions that a user might ask that this tile could answer.

Respond ONLY with the JSON object, no code fences or other text.`;

  const { text } = await generateText({
    model: flashModel,
    prompt,
  });

  try {
    const parsed = JSON.parse(stripCodeFences(text));
    return {
      semantic_description: String(parsed.semantic_description || ""),
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.map(String)
        : [],
      example_queries: Array.isArray(parsed.example_queries)
        ? parsed.example_queries.map(String)
        : [],
    };
  } catch {
    return {
      semantic_description: `${tile.name}: ${tile.description || tile.tile_type} tile`,
      keywords: [
        tile.name,
        tile.tile_type,
        ...(tile.description?.split(" ").slice(0, 5) || []),
      ],
      example_queries: [],
    };
  }
}

/** Build the text that will be embedded */
export function buildEmbeddableText(
  tile: Tile,
  enrichment: TileEnrichment,
): string {
  const parts = [
    enrichment.semantic_description,
    `Keywords: ${enrichment.keywords.join(", ")}`,
    ...enrichment.example_queries.map((q) => `Example question: ${q}`),
    `Tile name: ${tile.name}`,
    `Tile type: ${tile.tile_type}`,
  ];
  if (tile.description) {
    parts.push(`Description: ${tile.description}`);
  }
  return parts.join("\n");
}
