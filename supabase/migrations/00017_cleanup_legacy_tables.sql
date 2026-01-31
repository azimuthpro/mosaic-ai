-- Migration: Clean up legacy tables and fix RLS policies
-- 1. Fix overly permissive RLS policy on tile_job_results
-- 2. Fix execution_logs policy that references legacy agents table
-- 3. Drop unused legacy tables (agents, agent_members, sources, jobs, reports, skills)

-- ============================================================================
-- Fix RLS Policy for tile_job_results
-- ============================================================================

-- Remove the overly permissive INSERT policy
-- Service role bypasses RLS anyway, so this policy is not needed
-- Regular users should not be able to insert job results directly
DROP POLICY IF EXISTS "Service role can insert tile job results" ON tile_job_results;
DROP POLICY IF EXISTS "Service role can insert tile reports" ON tile_job_results;

-- ============================================================================
-- Fix RLS Policy for execution_logs
-- ============================================================================

-- Drop the existing policy that references the agents table (which will be dropped)
DROP POLICY IF EXISTS "Users can view execution logs for their agents or tiles" ON execution_logs;

-- Create new policy that only checks tiles (agents are being removed)
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

-- Also need to update the constraint that requires agent_id OR tile_id
-- Since agents are being removed, we only need tile_id
ALTER TABLE execution_logs DROP CONSTRAINT IF EXISTS execution_logs_requires_agent_or_tile;
ALTER TABLE execution_logs ADD CONSTRAINT execution_logs_requires_tile CHECK (tile_id IS NOT NULL);

-- Drop the agent_id column since agents table is being removed
ALTER TABLE execution_logs DROP COLUMN IF EXISTS agent_id;

-- Drop the job_id column if it references the legacy jobs table
-- First check if it has a FK to jobs and drop that constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%job%'
    AND table_name = 'execution_logs'
  ) THEN
    ALTER TABLE execution_logs DROP CONSTRAINT IF EXISTS execution_logs_job_id_fkey;
  END IF;
END $$;

-- Keep job_id but it should reference tile_jobs now (if not already)
-- The column can store tile_job IDs

-- ============================================================================
-- Update log_execution_event function to remove agent_id parameter
-- ============================================================================

CREATE OR REPLACE FUNCTION log_execution_event(
  p_execution_id uuid,
  p_tile_id uuid,
  p_job_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO execution_logs (execution_id, tile_id, job_id, event_type, metadata)
  VALUES (p_execution_id, p_tile_id, p_job_id, p_event_type, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION log_execution_event(uuid, uuid, uuid, text, jsonb) IS 'Log an execution event for a tile.';

-- Drop the old function signature that had agent_id
DROP FUNCTION IF EXISTS log_execution_event(uuid, uuid, uuid, uuid, text, jsonb);

-- ============================================================================
-- Drop Legacy Tables
-- These tables have been replaced by the new mosaic/tile architecture:
-- - agents -> tiles
-- - agent_members -> mosaic_members
-- - sources -> tile_sources
-- - jobs -> tile_jobs
-- - reports -> tile_job_results
-- - skills -> tile_skills (user-level skills are no longer used)
-- ============================================================================

-- Drop in order respecting foreign key dependencies

-- First drop policies
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
DROP POLICY IF EXISTS "Service role can insert reports" ON reports;
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Service role can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Service role can update jobs" ON jobs;
DROP POLICY IF EXISTS "Users can view their own sources" ON sources;
DROP POLICY IF EXISTS "Users can insert their own sources" ON sources;
DROP POLICY IF EXISTS "Users can update their own sources" ON sources;
DROP POLICY IF EXISTS "Users can delete their own sources" ON sources;
DROP POLICY IF EXISTS "Users can view agent members" ON agent_members;
DROP POLICY IF EXISTS "Owners can manage agent members" ON agent_members;
DROP POLICY IF EXISTS "Users can view their own agents" ON agents;
DROP POLICY IF EXISTS "Users can view shared agents" ON agents;
DROP POLICY IF EXISTS "Users can insert their own agents" ON agents;
DROP POLICY IF EXISTS "Users can update their own agents" ON agents;
DROP POLICY IF EXISTS "Users can delete their own agents" ON agents;
DROP POLICY IF EXISTS "Users can manage their own skills" ON skills;

-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS sources CASCADE;
DROP TABLE IF EXISTS agent_members CASCADE;
DROP TABLE IF EXISTS agents CASCADE;
DROP TABLE IF EXISTS skills CASCADE;

-- ============================================================================
-- Clean up any orphaned data or constraints
-- ============================================================================

-- Remove any remaining references to legacy tables in execution_logs
-- (execution_logs.agent_id references are handled by CASCADE above)

-- Add comment documenting the cleanup
COMMENT ON SCHEMA public IS 'Mosaic AI schema - legacy agent tables removed in migration 00017';
