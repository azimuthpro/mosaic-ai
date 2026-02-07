-- Add trigger_on_source_update column to tiles table
-- When true, this tile will automatically run when a connected source tile completes a job
ALTER TABLE public.tiles
  ADD COLUMN trigger_on_source_update boolean NOT NULL DEFAULT false;
