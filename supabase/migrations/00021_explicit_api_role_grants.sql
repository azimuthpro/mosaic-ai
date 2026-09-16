-- =============================================================================
-- Explicit privileges for the Data API roles
--
-- Earlier migrations relied on Supabase's old default privileges, which granted
-- anon / authenticated / service_role access to every new table and function
-- in `public`. Newer Supabase versions (including the local `supabase start`
-- stack) no longer do, so a database built from these migrations denied the
-- app every table ("permission denied for table ...").
--
-- These grants restate what the production database already has. Row access
-- is still enforced by RLS on every table. service_role has BYPASSRLS but is
-- not a superuser, so it needs EXECUTE on the functions that 00016 revoked
-- from PUBLIC.
--
-- New tables and functions must grant their own privileges.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.check_and_increment_execution_count(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_concurrent_execution_count(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_rate_limit_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_tile_job_execution_event(uuid, uuid, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_tile_circular_dependency(uuid, uuid) TO service_role;
