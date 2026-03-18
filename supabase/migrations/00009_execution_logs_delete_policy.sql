-- Add DELETE policy for tile_job_execution_logs (was missing — only SELECT existed)
CREATE POLICY "Admins can delete logs" ON public.tile_job_execution_logs FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tiles t
    LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
    WHERE t.id = tile_id AND (is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
  )
);
