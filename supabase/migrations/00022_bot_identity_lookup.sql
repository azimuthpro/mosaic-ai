-- =============================================================================
-- Indexed identity lookup for the Slack bot
--
-- Replaces a paged auth.admin.listUsers() scan in the bot, which was capped at
-- 1000 users: beyond that, nobody new could be matched to their Slack account.
--
-- Service-role only: the single caller uses createAdminClient().
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.find_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(text) TO service_role;
