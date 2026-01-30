-- Migration: Fix execution_logs to support both agents and tiles
-- The execution_logs table originally only referenced agents.
-- Now that tiles execute independently, we need to support tile_id as well.

-- ============================================================================
-- EXECUTION LOGS: Add tile_id column and make agent_id nullable
-- ============================================================================

-- Make agent_id nullable (previously required)
ALTER TABLE execution_logs
  ALTER COLUMN agent_id DROP NOT NULL;

-- Add tile_id column that references tiles
ALTER TABLE execution_logs
  ADD COLUMN IF NOT EXISTS tile_id uuid REFERENCES tiles(id) ON DELETE CASCADE;

-- Add index for tile_id queries
CREATE INDEX IF NOT EXISTS idx_execution_logs_tile_id ON execution_logs(tile_id) WHERE tile_id IS NOT NULL;

-- Add constraint to ensure at least one of agent_id or tile_id is set
ALTER TABLE execution_logs
  ADD CONSTRAINT execution_logs_requires_agent_or_tile
  CHECK (agent_id IS NOT NULL OR tile_id IS NOT NULL);

-- ============================================================================
-- UPDATE RLS POLICIES for execution_logs
-- ============================================================================

-- Drop the existing policy that only checks agents
DROP POLICY IF EXISTS "Users can view execution logs for their agents" ON execution_logs;

-- Create new policy that checks both agents and tiles
CREATE POLICY "Users can view execution logs for their agents or tiles"
  ON execution_logs FOR SELECT
  USING (
    agent_id IN (SELECT id FROM agents WHERE owner_id = auth.uid())
    OR
    tile_id IN (
      SELECT t.id FROM tiles t
      JOIN mosaics m ON t.mosaic_id = m.id
      WHERE m.owner_id = auth.uid()
    )
    OR
    tile_id IN (
      SELECT t.id FROM tiles t
      JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id
      WHERE mm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- UPDATE log_execution_event FUNCTION
-- ============================================================================

-- Drop the old function first (it has a different signature)
DROP FUNCTION IF EXISTS log_execution_event(uuid, uuid, uuid, text, jsonb);

-- Create the function with the new signature that accepts tile_id
CREATE OR REPLACE FUNCTION log_execution_event(
  p_execution_id uuid,
  p_agent_id uuid,
  p_job_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}',
  p_tile_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO execution_logs (execution_id, agent_id, tile_id, job_id, event_type, metadata)
  VALUES (p_execution_id, p_agent_id, p_tile_id, p_job_id, p_event_type, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION log_execution_event IS 'Log an execution event for either an agent or tile. Pass agent_id for agents, tile_id for tiles.';
