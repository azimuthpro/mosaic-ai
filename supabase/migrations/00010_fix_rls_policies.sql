-- Migration: Fix RLS security issues and infinite recursion
--
-- Issues fixed:
-- 1. Remove overly permissive "service role" policies that actually allowed any user access
-- 2. Fix infinite recursion between mosaics and mosaic_members policies

-- ============================================================================
-- FIX 1: Remove overly permissive "service role" policies
-- The service_role key bypasses RLS entirely, so these policies actually
-- allow ANY authenticated user to write to these tables - a security issue.
-- Server-side code using service_role key will still work (RLS bypassed).
-- ============================================================================

DROP POLICY IF EXISTS "Service role can insert execution logs" ON public.execution_logs;
DROP POLICY IF EXISTS "Service role can manage tile jobs" ON public.tile_jobs;
DROP POLICY IF EXISTS "Service role can insert tile reports" ON public.tile_reports;
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.user_rate_limits;

-- ============================================================================
-- FIX 2: Fix infinite recursion between mosaics and mosaic_members
--
-- The recursion occurs because:
-- - mosaics "Members can view shared mosaics" policy queries mosaic_members
-- - mosaic_members "Users can view their memberships" policy queries mosaics
--
-- Solution: Use a SECURITY DEFINER function to check ownership without
-- triggering RLS on the mosaics table, breaking the recursion cycle.
-- ============================================================================

-- Create a security definer function to check mosaic ownership
-- This bypasses RLS when checking the mosaics table, preventing recursion
CREATE OR REPLACE FUNCTION public.is_mosaic_owner(p_mosaic_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM mosaics
    WHERE id = p_mosaic_id AND owner_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_mosaic_owner IS 'Check if current user owns the mosaic (SECURITY DEFINER to avoid RLS recursion)';

-- Drop the problematic mosaic_members policies
DROP POLICY IF EXISTS "Users can view their memberships" ON public.mosaic_members;
DROP POLICY IF EXISTS "Owners can manage mosaic members" ON public.mosaic_members;

-- Recreate mosaic_members policies using the security definer function
-- Users can see their own memberships OR all memberships for mosaics they own
CREATE POLICY "Users can view memberships"
  ON public.mosaic_members FOR SELECT
  USING (
    user_id = auth.uid() OR is_mosaic_owner(mosaic_id)
  );

-- Owners can manage (insert, update, delete) members
CREATE POLICY "Owners can manage mosaic members"
  ON public.mosaic_members FOR ALL
  USING (is_mosaic_owner(mosaic_id))
  WITH CHECK (is_mosaic_owner(mosaic_id));
