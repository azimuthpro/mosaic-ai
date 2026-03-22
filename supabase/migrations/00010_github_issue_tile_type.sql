-- Add 'github_issue' tile type
ALTER TYPE public.tile_type ADD VALUE IF NOT EXISTS 'github_issue';

-- Add generic config column to tiles for type-specific configuration
ALTER TABLE public.tiles ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}';
