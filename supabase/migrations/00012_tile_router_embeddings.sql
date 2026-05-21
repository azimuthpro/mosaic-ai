-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Drop previous partial migration state if exists
DROP FUNCTION IF EXISTS public.match_tiles(extensions.vector(768), uuid, float, int);
DROP TRIGGER IF EXISTS set_tile_embeddings_updated_at ON public.tile_embeddings;
DROP POLICY IF EXISTS "Users can view accessible tile embeddings" ON public.tile_embeddings;
DROP INDEX IF EXISTS public.tile_embeddings_embedding_idx;
DROP INDEX IF EXISTS public.tile_embeddings_mosaic_id_idx;
DROP TABLE IF EXISTS public.tile_embeddings;

-- Tile embeddings table for semantic router
CREATE TABLE public.tile_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,

  -- LLM-generated semantic metadata
  semantic_description text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  example_queries text[] NOT NULL DEFAULT '{}',

  -- The concatenated text that was embedded
  embedded_text text NOT NULL,

  -- 768-dim vector (reduced via outputDimensionality from gemini-embedding-2-preview)
  embedding extensions.vector(768) NOT NULL,

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(tile_id)
);

-- Index for vector similarity search
CREATE INDEX tile_embeddings_embedding_idx
  ON public.tile_embeddings
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 10);

-- Index for filtering by mosaic
CREATE INDEX tile_embeddings_mosaic_id_idx ON public.tile_embeddings(mosaic_id);

-- Auto-update updated_at
CREATE TRIGGER set_tile_embeddings_updated_at
  BEFORE UPDATE ON public.tile_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.tile_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible tile embeddings"
  ON public.tile_embeddings FOR SELECT
  USING (has_mosaic_access(mosaic_id));

-- Vector similarity search function
CREATE OR REPLACE FUNCTION public.match_tiles(
  query_embedding extensions.vector(768),
  match_mosaic_id uuid,
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  tile_id uuid,
  mosaic_id uuid,
  semantic_description text,
  keywords text[],
  example_queries text[],
  similarity float
)
LANGUAGE sql STABLE
SET search_path = 'extensions'
AS $$
  SELECT
    te.tile_id,
    te.mosaic_id,
    te.semantic_description,
    te.keywords,
    te.example_queries,
    1 - (te.embedding <=> query_embedding)::float AS similarity
  FROM public.tile_embeddings te
  INNER JOIN public.tiles t ON t.id = te.tile_id
  WHERE te.mosaic_id = match_mosaic_id
    AND t.is_active = true
    AND 1 - (te.embedding <=> query_embedding)::float > match_threshold
  ORDER BY te.embedding <=> query_embedding
  LIMIT match_count;
$$;
