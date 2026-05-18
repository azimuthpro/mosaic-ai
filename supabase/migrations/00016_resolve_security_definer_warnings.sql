-- =============================================================================
-- Resolve Supabase database linter warnings 0028 / 0029
-- (SECURITY DEFINER functions executable by anon / authenticated via /rest/v1/rpc/)
-- =============================================================================

-- 1. Drop legacy unused functions (no callers in code, not in migrations).
DROP FUNCTION IF EXISTS public.log_execution_event(uuid, uuid, uuid, text, jsonb, uuid);
DROP FUNCTION IF EXISTS public.log_execution_event(uuid, uuid, uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.log_execution_event(uuid, uuid, uuid, text, jsonb, uuid, uuid);
DROP FUNCTION IF EXISTS public.update_skills_updated_at();

-- 2. Service-role-only functions: revoke EXECUTE from anon, authenticated and PUBLIC.
--    All callers in the codebase use createAdminClient() (service_role), which bypasses GRANTs.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_execution_count(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_concurrent_execution_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_rate_limit_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_tile_job_execution_event(uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- 3. Server-action RPCs are being removed; the equivalent logic now runs in
--    TypeScript against the admin client. Drop the SECURITY DEFINER versions.
DROP FUNCTION IF EXISTS public.accept_mosaic_invitation(uuid, uuid);
DROP FUNCTION IF EXISTS public.transfer_mosaic_ownership(uuid, uuid, uuid);

-- 4. Switch check_tile_circular_dependency to SECURITY INVOKER.
--    RLS on tile_connections already restricts visibility to the user's accessible mosaics,
--    which is exactly the traversal we want.
CREATE OR REPLACE FUNCTION public.check_tile_circular_dependency(p_source_tile_id uuid, p_target_tile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_has_cycle boolean;
BEGIN
  WITH RECURSIVE connection_chain AS (
    SELECT source_tile_id, target_tile_id, 1 as depth
    FROM tile_connections
    WHERE source_tile_id = p_target_tile_id
    UNION ALL
    SELECT tc.source_tile_id, tc.target_tile_id, cc.depth + 1
    FROM tile_connections tc
    JOIN connection_chain cc ON tc.source_tile_id = cc.target_tile_id
    WHERE cc.depth < 20
  )
  SELECT EXISTS (SELECT 1 FROM connection_chain WHERE target_tile_id = p_source_tile_id) INTO v_has_cycle;
  RETURN v_has_cycle;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_tile_circular_dependency(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_tile_circular_dependency(uuid, uuid) TO authenticated;

-- 5. Move RLS helpers out of the API-exposed `public` schema into `private`.
--    They are still callable from RLS policy expressions (which qualify the schema),
--    but PostgREST does not expose `private` via /rest/v1/rpc/.

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.is_mosaic_owner(p_mosaic_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM mosaics WHERE id = p_mosaic_id AND owner_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.has_mosaic_access(p_mosaic_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    EXISTS (SELECT 1 FROM mosaics WHERE id = p_mosaic_id AND owner_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM mosaic_members WHERE mosaic_id = p_mosaic_id AND user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION private.is_mosaic_owner(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.has_mosaic_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_mosaic_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_mosaic_access(uuid) TO authenticated, service_role;

-- 6. Drop all policies that reference the public.* helpers, recreate them against private.*,
--    then drop the public.* helpers.

-- mosaic_members
DROP POLICY IF EXISTS "Users can view memberships" ON public.mosaic_members;
DROP POLICY IF EXISTS "Owners can manage memberships" ON public.mosaic_members;
CREATE POLICY "Users can view memberships" ON public.mosaic_members
  FOR SELECT USING (user_id = auth.uid() OR private.is_mosaic_owner(mosaic_id));
CREATE POLICY "Owners can manage memberships" ON public.mosaic_members
  FOR ALL USING (private.is_mosaic_owner(mosaic_id));

-- mosaic_invitations
DROP POLICY IF EXISTS "Owners can manage invitations" ON public.mosaic_invitations;
CREATE POLICY "Owners can manage invitations" ON public.mosaic_invitations
  FOR ALL USING (private.is_mosaic_owner(mosaic_id));

-- tiles
DROP POLICY IF EXISTS "Users can view accessible tiles" ON public.tiles;
DROP POLICY IF EXISTS "Admins can manage tiles" ON public.tiles;
CREATE POLICY "Users can view accessible tiles" ON public.tiles
  FOR SELECT USING (private.has_mosaic_access(mosaic_id));
CREATE POLICY "Admins can manage tiles" ON public.tiles
  FOR ALL USING (
    private.is_mosaic_owner(mosaic_id) OR
    EXISTS (SELECT 1 FROM mosaic_members mm WHERE mm.mosaic_id = tiles.mosaic_id AND mm.user_id = auth.uid() AND mm.role IN ('owner', 'admin'))
  );

-- tile_connections
DROP POLICY IF EXISTS "Users can view accessible connections" ON public.tile_connections;
DROP POLICY IF EXISTS "Admins can manage connections" ON public.tile_connections;
CREATE POLICY "Users can view accessible connections" ON public.tile_connections
  FOR SELECT USING (private.has_mosaic_access(mosaic_id));
CREATE POLICY "Admins can manage connections" ON public.tile_connections
  FOR ALL USING (
    private.is_mosaic_owner(mosaic_id) OR
    EXISTS (SELECT 1 FROM mosaic_members mm WHERE mm.mosaic_id = tile_connections.mosaic_id AND mm.user_id = auth.uid() AND mm.role IN ('owner', 'admin'))
  );

-- tile_sources
DROP POLICY IF EXISTS "Users can view accessible sources" ON public.tile_sources;
DROP POLICY IF EXISTS "Admins can manage sources" ON public.tile_sources;
CREATE POLICY "Users can view accessible sources" ON public.tile_sources
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_sources.tile_id AND private.has_mosaic_access(t.mosaic_id))
  );
CREATE POLICY "Admins can manage sources" ON public.tile_sources
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tiles t
      LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
      WHERE t.id = tile_sources.tile_id AND (private.is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
    )
  );

-- tile_skills
DROP POLICY IF EXISTS "Users can view accessible skills" ON public.tile_skills;
DROP POLICY IF EXISTS "Admins can manage skills" ON public.tile_skills;
CREATE POLICY "Users can view accessible skills" ON public.tile_skills
  FOR SELECT USING (mosaic_id IS NOT NULL AND private.has_mosaic_access(mosaic_id));
CREATE POLICY "Admins can manage skills" ON public.tile_skills
  FOR ALL USING (
    mosaic_id IS NOT NULL AND (
      private.is_mosaic_owner(mosaic_id) OR
      EXISTS (SELECT 1 FROM mosaic_members mm WHERE mm.mosaic_id = tile_skills.mosaic_id AND mm.user_id = auth.uid() AND mm.role IN ('owner', 'admin'))
    )
  );

-- tile_jobs
DROP POLICY IF EXISTS "Users can view accessible jobs" ON public.tile_jobs;
DROP POLICY IF EXISTS "Admins can delete jobs" ON public.tile_jobs;
CREATE POLICY "Users can view accessible jobs" ON public.tile_jobs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_jobs.tile_id AND private.has_mosaic_access(t.mosaic_id))
  );
CREATE POLICY "Admins can delete jobs" ON public.tile_jobs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tiles t
      LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
      WHERE t.id = tile_jobs.tile_id AND (private.is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
    )
  );

-- tile_job_results
DROP POLICY IF EXISTS "Users can view accessible results" ON public.tile_job_results;
DROP POLICY IF EXISTS "Admins can delete results" ON public.tile_job_results;
CREATE POLICY "Users can view accessible results" ON public.tile_job_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_job_results.tile_id AND private.has_mosaic_access(t.mosaic_id))
  );
CREATE POLICY "Admins can delete results" ON public.tile_job_results
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tiles t
      LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
      WHERE t.id = tile_job_results.tile_id AND (private.is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
    )
  );

-- tile_job_execution_logs
DROP POLICY IF EXISTS "Users can view accessible logs" ON public.tile_job_execution_logs;
DROP POLICY IF EXISTS "Admins can delete logs" ON public.tile_job_execution_logs;
CREATE POLICY "Users can view accessible logs" ON public.tile_job_execution_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_job_execution_logs.tile_id AND private.has_mosaic_access(t.mosaic_id))
  );
CREATE POLICY "Admins can delete logs" ON public.tile_job_execution_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tiles t
      LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
      WHERE t.id = tile_job_execution_logs.tile_id AND (private.is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
    )
  );

-- tile_webhooks
DROP POLICY IF EXISTS "Users can view accessible webhooks" ON public.tile_webhooks;
DROP POLICY IF EXISTS "Admins can manage webhooks" ON public.tile_webhooks;
CREATE POLICY "Users can view accessible webhooks" ON public.tile_webhooks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_webhooks.tile_id AND private.has_mosaic_access(t.mosaic_id))
  );
CREATE POLICY "Admins can manage webhooks" ON public.tile_webhooks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tiles t
      LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
      WHERE t.id = tile_webhooks.tile_id AND (private.is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
    )
  );

-- tile_webhook_deliveries
DROP POLICY IF EXISTS "Users can view accessible deliveries" ON public.tile_webhook_deliveries;
CREATE POLICY "Users can view accessible deliveries" ON public.tile_webhook_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tile_webhooks tw
      JOIN tiles t ON t.id = tw.tile_id
      WHERE tw.id = tile_webhook_deliveries.webhook_id AND private.has_mosaic_access(t.mosaic_id)
    )
  );

-- tile_embeddings
DROP POLICY IF EXISTS "Users can view accessible tile embeddings" ON public.tile_embeddings;
CREATE POLICY "Users can view accessible tile embeddings" ON public.tile_embeddings
  FOR SELECT USING (private.has_mosaic_access(mosaic_id));

-- Now safe to drop the public versions.
DROP FUNCTION IF EXISTS public.is_mosaic_owner(uuid);
DROP FUNCTION IF EXISTS public.has_mosaic_access(uuid);
