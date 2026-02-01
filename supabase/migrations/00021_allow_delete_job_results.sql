-- Migration: Allow owners and admins to delete tile jobs and results
-- Regular members can only view, not delete

-- Add DELETE policy for tile_jobs
-- Owners and admins can delete jobs for tiles in their mosaics
CREATE POLICY "Owners and admins can delete tile jobs"
  ON tile_jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaics m ON t.mosaic_id = m.id
      LEFT JOIN mosaic_members mm ON m.id = mm.mosaic_id AND mm.user_id = auth.uid()
      WHERE t.id = tile_jobs.tile_id
      AND (
        m.owner_id = auth.uid()
        OR mm.role IN ('owner', 'admin')
      )
    )
  );

-- Add DELETE policy for tile_job_results
-- Owners and admins can delete results for tiles in their mosaics
CREATE POLICY "Owners and admins can delete tile job results"
  ON tile_job_results
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaics m ON t.mosaic_id = m.id
      LEFT JOIN mosaic_members mm ON m.id = mm.mosaic_id AND mm.user_id = auth.uid()
      WHERE t.id = tile_job_results.tile_id
      AND (
        m.owner_id = auth.uid()
        OR mm.role IN ('owner', 'admin')
      )
    )
  );

-- Add comment documenting the change
COMMENT ON POLICY "Owners and admins can delete tile jobs" ON tile_jobs IS
  'Allows mosaic owners and admin members to delete tile jobs. Regular members cannot delete.';
COMMENT ON POLICY "Owners and admins can delete tile job results" ON tile_job_results IS
  'Allows mosaic owners and admin members to delete tile job results. Regular members cannot delete.';
