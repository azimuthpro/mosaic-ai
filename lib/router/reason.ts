import { google } from "@ai-sdk/google";
import { generateText } from "ai";

import type { SelectedTile, TileCandidate } from "./types";
import { stripCodeFences } from "./utils";

const model = google("gemini-flash-latest");

function formatCandidate(c: TileCandidate, index: number): string {
  return `[${index + 1}] ID: ${c.tile_id}
    Name: ${c.tile_name}
    Type: ${c.tile_type}
    Description: ${c.semantic_description}
    Keywords: ${c.keywords.join(", ")}
    Example queries: ${c.example_queries.join("; ")}
    Similarity score: ${c.similarity.toFixed(3)}`;
}

interface RawSelectedTile {
  tile_id?: string;
  justification?: string;
  parameters?: Record<string, string>;
  confidence?: number;
}

function normalizeSelectedTile(item: RawSelectedTile): SelectedTile {
  return {
    tile_id: String(item.tile_id),
    justification: String(item.justification || ""),
    parameters:
      item.parameters && typeof item.parameters === "object"
        ? item.parameters
        : {},
    confidence:
      typeof item.confidence === "number"
        ? Math.min(1, Math.max(0, item.confidence))
        : 0.5,
  };
}

/** Use LLM to reason about which tiles best match the user query */
export async function reasonOverCandidates(
  query: string,
  candidates: TileCandidate[],
): Promise<SelectedTile[]> {
  if (candidates.length === 0) {
    return [];
  }

  const candidateDescriptions = candidates.map(formatCandidate).join("\n\n");

  const prompt = `You are a tile routing assistant. Given a user's question and a list of candidate tiles, select the best tile(s) to answer the question.

User Question: "${query}"

Candidate Tiles:
${candidateDescriptions}

Rules:
1. Select 1-3 tiles that are most relevant to the user's question.
2. If only one tile is clearly the best match, select just that one.
3. Select multiple tiles only if they provide complementary information needed to answer the question.
4. Extract any parameters from the user's query that could be used as input to the tile (e.g., company names, URLs, dates, topics).
5. Assign a confidence score (0.0-1.0) to each selection.

Respond with a JSON array of selected tiles. Each element must have:
- "tile_id": the tile's ID string
- "justification": 1-2 sentences explaining why this tile was selected
- "parameters": an object mapping parameter names to values extracted from the query
- "confidence": a number between 0 and 1

Respond ONLY with the JSON array, no code fences or other text.`;

  const { text } = await generateText({
    model,
    prompt,
  });

  try {
    const parsed = JSON.parse(stripCodeFences(text));

    if (!Array.isArray(parsed)) {
      throw new Error("Expected array response");
    }

    return parsed.map(normalizeSelectedTile);
  } catch (err) {
    console.error("[router/reason] Failed to parse LLM response:", text, err);
    return [
      {
        tile_id: candidates[0].tile_id,
        justification:
          "Selected as highest similarity match (LLM parsing failed)",
        parameters: {},
        confidence: candidates[0].similarity,
      },
    ];
  }
}
