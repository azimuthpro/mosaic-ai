import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, TileType } from "@/types/database";

import { embedQuery, toPgVector } from "./embed";
import type { TileCandidate } from "./types";

interface SearchOptions {
  threshold?: number;
  limit?: number;
}

interface MatchTileRow {
  tile_id: string;
  mosaic_id: string;
  semantic_description: string;
  keywords: string[];
  example_queries: string[];
  similarity: number;
}

/** Search for tiles matching a user query via vector similarity */
export async function searchTiles(
  supabase: SupabaseClient<Database>,
  mosaicId: string,
  query: string,
  options: SearchOptions = {},
): Promise<TileCandidate[]> {
  const { threshold = 0.3, limit = 5 } = options;

  const queryEmbedding = await embedQuery(query);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const { data, error } = (await (supabase.rpc as Function)("match_tiles", {
    query_embedding: toPgVector(queryEmbedding),
    match_mosaic_id: mosaicId,
    match_threshold: threshold,
    match_count: limit,
  })) as { data: MatchTileRow[] | null; error: { message: string } | null };

  if (error) {
    console.error("[router/search] Vector search failed:", error);
    throw new Error(`Vector search failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  const tileIds = data.map((r) => r.tile_id);
  const { data: tiles } = await supabase
    .from("tiles")
    .select("id, name, tile_type")
    .in("id", tileIds);

  const tileMap = new Map(
    ((tiles || []) as { id: string; name: string; tile_type: TileType }[]).map(
      (t) => [t.id, t],
    ),
  );

  return data.map((r): TileCandidate => {
    const tile = tileMap.get(r.tile_id);
    return {
      tile_id: r.tile_id,
      tile_name: tile?.name || "Unknown",
      tile_type: tile?.tile_type || ("analyzer" as TileType),
      semantic_description: r.semantic_description,
      keywords: r.keywords || [],
      example_queries: r.example_queries || [],
      similarity: r.similarity,
    };
  });
}
