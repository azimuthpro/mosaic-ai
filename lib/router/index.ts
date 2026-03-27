import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { reasonOverCandidates } from "./reason";
import { searchTiles } from "./search";
import type { RouterError, RouterResult } from "./types";

export type {
  RouterError,
  RouterResult,
  SelectedTile,
  TileCandidate,
} from "./types";

interface RouteOptions {
  threshold?: number;
  maxCandidates?: number;
  skipReasoning?: boolean;
}

/** Route a user query to the best tile(s) in a mosaic */
export async function routeQuery(
  supabase: SupabaseClient<Database>,
  mosaicId: string,
  query: string,
  options: RouteOptions = {},
): Promise<RouterResult | RouterError> {
  const { threshold = 0.3, maxCandidates = 5, skipReasoning = false } = options;

  try {
    const candidates = await searchTiles(supabase, mosaicId, query, {
      threshold,
      limit: maxCandidates,
    });

    if (candidates.length === 0) {
      return {
        error: "No matching tiles found for this query",
        code: "NO_MATCHES",
      };
    }

    if (skipReasoning) {
      return {
        selected_tiles: candidates.map((c) => ({
          tile_id: c.tile_id,
          justification: `Vector similarity: ${c.similarity.toFixed(3)}`,
          parameters: {},
          confidence: c.similarity,
        })),
        candidates_considered: candidates.length,
        query,
        mosaic_id: mosaicId,
      };
    }

    const selectedTiles = await reasonOverCandidates(query, candidates);

    if (selectedTiles.length === 0) {
      return {
        error: "LLM reasoning could not select a tile",
        code: "LLM_ERROR",
      };
    }

    return {
      selected_tiles: selectedTiles,
      candidates_considered: candidates.length,
      query,
      mosaic_id: mosaicId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const code = message.includes("Vector search failed")
      ? "EMBEDDING_ERROR"
      : "LLM_ERROR";
    console.error("[router] Route query failed:", message);
    return { error: message, code } as RouterError;
  }
}
