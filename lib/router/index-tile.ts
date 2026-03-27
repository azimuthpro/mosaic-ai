import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tile, TileSource } from "@/types/database";

import { embedDocument, toPgVector } from "./embed";
import { buildEmbeddableText, enrichTile } from "./enrich";

/** Index a single tile: enrich, embed, and upsert into tile_embeddings */
export async function indexTile(
  adminClient: SupabaseClient<Database>,
  tile: Tile,
  sources: TileSource[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const enrichment = await enrichTile(tile, sources);
    const embeddableText = buildEmbeddableText(tile, enrichment);
    const embedding = await embedDocument(embeddableText);

    const { error } = await adminClient.from("tile_embeddings").upsert(
      {
        tile_id: tile.id,
        mosaic_id: tile.mosaic_id,
        semantic_description: enrichment.semantic_description,
        keywords: enrichment.keywords,
        example_queries: enrichment.example_queries,
        embedded_text: embeddableText,
        embedding: toPgVector(embedding),
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "tile_id" },
    );

    if (error) {
      console.error(
        `[router/index] Failed to upsert embedding for tile ${tile.id}:`,
        error,
      );
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[router/index] Failed to index tile ${tile.id}:`, message);
    return { success: false, error: message };
  }
}

/** Remove a tile's embedding */
export async function deindexTile(
  adminClient: SupabaseClient<Database>,
  tileId: string,
): Promise<void> {
  await adminClient.from("tile_embeddings").delete().eq("tile_id", tileId);
}

/** Batch index all active tiles in a mosaic */
export async function indexMosaicTiles(
  adminClient: SupabaseClient<Database>,
  mosaicId: string,
): Promise<{ indexed: number; failed: number; errors: string[] }> {
  const { data: tiles, error } = await adminClient
    .from("tiles")
    .select(`*, tile_sources!tile_sources_tile_id_fkey (*)`)
    .eq("mosaic_id", mosaicId)
    .eq("is_active", true);

  if (error || !tiles) {
    return {
      indexed: 0,
      failed: 0,
      errors: [error?.message || "No tiles found"],
    };
  }

  const results = { indexed: 0, failed: 0, errors: [] as string[] };

  for (const tileData of tiles) {
    const tile = tileData as unknown as Tile & {
      tile_sources: TileSource[];
    };
    const result = await indexTile(adminClient, tile, tile.tile_sources || []);
    if (result.success) {
      results.indexed++;
    } else {
      results.failed++;
      results.errors.push(`${tile.id}: ${result.error}`);
    }
  }

  return results;
}
