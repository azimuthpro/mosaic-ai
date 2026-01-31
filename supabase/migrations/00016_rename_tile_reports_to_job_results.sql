-- Migration: Rename tile_reports to tile_job_results
-- This renames the table to better reflect that it contains job output/results

-- Rename the table
ALTER TABLE tile_reports RENAME TO tile_job_results;

-- Rename the sequence (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'tile_reports_id_seq') THEN
    ALTER SEQUENCE tile_reports_id_seq RENAME TO tile_job_results_id_seq;
  END IF;
END $$;

-- Rename indexes
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'tile_job_results'
    AND indexname LIKE '%tile_reports%'
  LOOP
    EXECUTE format('ALTER INDEX %I RENAME TO %I',
      idx.indexname,
      replace(idx.indexname, 'tile_reports', 'tile_job_results'));
  END LOOP;
END $$;

-- Rename foreign key constraints
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'tile_job_results'::regclass
    AND conname LIKE '%tile_reports%'
  LOOP
    EXECUTE format('ALTER TABLE tile_job_results RENAME CONSTRAINT %I TO %I',
      con.conname,
      replace(con.conname, 'tile_reports', 'tile_job_results'));
  END LOOP;
END $$;

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view tile reports" ON tile_job_results;
DROP POLICY IF EXISTS "Service role can insert tile reports" ON tile_job_results;

CREATE POLICY "Users can view tile job results"
  ON tile_job_results
  FOR SELECT
  USING (
    tile_id IN (
      SELECT t.id FROM tiles t
      JOIN mosaics m ON t.mosaic_id = m.id
      LEFT JOIN mosaic_members mm ON m.id = mm.mosaic_id
      WHERE m.owner_id = auth.uid() OR mm.user_id = auth.uid()
    )
  );

-- Note: No INSERT policy needed - service role bypasses RLS
-- Regular users should not insert job results directly

-- Add comment to document the rename
COMMENT ON TABLE tile_job_results IS 'Stores the output/results from tile job executions. Renamed from tile_reports for clarity.';
