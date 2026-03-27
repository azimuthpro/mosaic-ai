import type { TileType } from "@/types/database";

/** Output of the enrichment LLM call */
export interface TileEnrichment {
  semantic_description: string;
  keywords: string[];
  example_queries: string[];
}

/** A tile candidate returned by vector search */
export interface TileCandidate {
  tile_id: string;
  tile_name: string;
  tile_type: TileType;
  semantic_description: string;
  keywords: string[];
  example_queries: string[];
  similarity: number;
}

/** A selected tile from the LLM reasoning step */
export interface SelectedTile {
  tile_id: string;
  justification: string;
  parameters: Record<string, string>;
  confidence: number;
}

/** Final router result */
export interface RouterResult {
  selected_tiles: SelectedTile[];
  candidates_considered: number;
  query: string;
  mosaic_id: string;
}

/** Error result */
export interface RouterError {
  error: string;
  code: "NO_MATCHES" | "LLM_ERROR" | "EMBEDDING_ERROR" | "AUTH_ERROR";
}
