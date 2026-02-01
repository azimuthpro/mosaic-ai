-- Migration: Unified Output Format
-- Merges output_format and display_format into a single unified setting
-- Adds output_schema for Zod schema support when using JSON format

-- Add output_schema column for Zod schema storage
ALTER TABLE public.tiles
ADD COLUMN IF NOT EXISTS output_schema text DEFAULT NULL;

-- Migrate existing output_format values (list, table → text)
UPDATE public.tiles
SET output_format = CASE
  WHEN output_format IN ('text', 'list', 'table') THEN 'text'
  ELSE 'json'
END;

-- Update constraint to only allow text/json
ALTER TABLE public.tiles DROP CONSTRAINT IF EXISTS tiles_output_format_check;
ALTER TABLE public.tiles ADD CONSTRAINT tiles_output_format_check
  CHECK (output_format IN ('text', 'json'));

-- Drop display_format column (no longer needed)
ALTER TABLE public.tiles DROP COLUMN IF EXISTS display_format;

-- Migrate tile_job_results format values
UPDATE public.tile_job_results
SET format = CASE
  WHEN format IN ('text', 'list', 'table') THEN 'text'
  ELSE 'json'
END;

-- Update constraint on tile_job_results table
ALTER TABLE public.tile_job_results DROP CONSTRAINT IF EXISTS tile_job_results_format_check;
ALTER TABLE public.tile_job_results ADD CONSTRAINT tile_job_results_format_check
  CHECK (format IN ('text', 'json'));

-- Also update legacy reports table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reports' AND table_schema = 'public') THEN
    UPDATE public.reports
    SET format = CASE
      WHEN format IN ('text', 'list', 'table') THEN 'text'
      ELSE 'json'
    END;
  END IF;
END $$;

-- Also update legacy agents table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public') THEN
    UPDATE public.agents
    SET output_format = CASE
      WHEN output_format IN ('text', 'list', 'table') THEN 'text'
      ELSE 'json'
    END;
  END IF;
END $$;
