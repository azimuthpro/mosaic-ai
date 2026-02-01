-- Migration: Fix RLS policy for execution_logs table
-- The linter reports RLS is enabled but no policies exist.
-- This migration ensures the SELECT policy is properly created.

-- Drop any existing policies first to ensure clean state
DROP POLICY IF EXISTS "Users can view execution logs for their tiles" ON execution_logs;
DROP POLICY IF EXISTS "Users can view execution logs for their agents or tiles" ON execution_logs;
DROP POLICY IF EXISTS "Users can view execution logs for their agents" ON execution_logs;

-- Create SELECT policy: Users can only view execution logs for tiles in mosaics they have access to
CREATE POLICY "Users can view execution logs for their tiles"
  ON execution_logs FOR SELECT
  USING (
    tile_id IN (
      SELECT t.id FROM tiles t
      JOIN mosaics m ON t.mosaic_id = m.id
      LEFT JOIN mosaic_members mm ON m.id = mm.mosaic_id
      WHERE m.owner_id = auth.uid() OR mm.user_id = auth.uid()
    )
  );

-- Note: INSERT/UPDATE/DELETE operations on execution_logs are performed by
-- the service role via the log_execution_event() function (SECURITY DEFINER),
-- so no additional policies are needed for those operations.

COMMENT ON POLICY "Users can view execution logs for their tiles" ON execution_logs IS
  'Users can view execution logs for tiles in mosaics they own or are members of';
