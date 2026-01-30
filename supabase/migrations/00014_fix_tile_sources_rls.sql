-- Migration: Fix tile_sources RLS policies to include WITH CHECK clauses
-- Problem: INSERT operations may silently fail because FOR ALL policies only have USING clauses
-- Solution: Add explicit WITH CHECK clauses for INSERT/UPDATE operations

-- Drop existing policies
DROP POLICY IF EXISTS "Owners can manage tile sources" ON public.tile_sources;
DROP POLICY IF EXISTS "Admins can manage tile sources" ON public.tile_sources;

-- Recreate owner policy with explicit WITH CHECK
CREATE POLICY "Owners can manage tile sources"
  ON public.tile_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaics ON mosaics.id = tiles.mosaic_id
      WHERE tiles.id = tile_sources.tile_id
      AND mosaics.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaics ON mosaics.id = tiles.mosaic_id
      WHERE tiles.id = tile_sources.tile_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Recreate admin policy with explicit WITH CHECK
CREATE POLICY "Admins can manage tile sources"
  ON public.tile_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaic_members ON mosaic_members.mosaic_id = tiles.mosaic_id
      WHERE tiles.id = tile_sources.tile_id
      AND mosaic_members.user_id = auth.uid()
      AND mosaic_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaic_members ON mosaic_members.mosaic_id = tiles.mosaic_id
      WHERE tiles.id = tile_sources.tile_id
      AND mosaic_members.user_id = auth.uid()
      AND mosaic_members.role IN ('owner', 'admin')
    )
  );
