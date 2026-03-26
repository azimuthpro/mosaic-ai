-- Add sort_order column to tile_sources for user-defined ordering
ALTER TABLE public.tile_sources
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Backfill existing sources: set sort_order based on created_at order within each tile
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tile_id ORDER BY created_at) - 1 AS rn
  FROM public.tile_sources
)
UPDATE public.tile_sources ts
SET sort_order = ranked.rn
FROM ranked
WHERE ts.id = ranked.id;
