-- =============================================================================
-- Atomic claim for offer_sender drafts
--
-- "Approve & Send" used to read the draft, check status = 'draft' in TypeScript,
-- send the email, then write the new status. Two clicks could both pass the
-- check and both send — and because the send ran before Slack was acknowledged,
-- Slack showed "operation timed out", which invites a second click.
-- A single conditional UPDATE is the lock.
--
-- Both functions are service-role only: every caller uses createAdminClient().
-- =============================================================================

-- Claims the latest result row of an offer_sender job by moving its JSON status
-- from 'draft' to p_next_status. Returns no rows when the draft was already
-- claimed or decided, which is how callers detect a lost race.
CREATE OR REPLACE FUNCTION public.claim_offer_draft(p_job_id uuid, p_next_status text)
RETURNS TABLE (id uuid, tile_id uuid, job_id uuid, content jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE tile_job_results r
  SET content = jsonb_set(r.content, '{status}', to_jsonb(p_next_status))
  WHERE r.id = (
    SELECT inner_r.id
    FROM tile_job_results inner_r
    WHERE inner_r.job_id = p_job_id
    ORDER BY inner_r.created_at DESC
    LIMIT 1
  )
    AND r.content->>'status' = 'draft'
  RETURNING r.id, r.tile_id, r.job_id, r.content
$$;

REVOKE EXECUTE ON FUNCTION public.claim_offer_draft(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_offer_draft(uuid, text) TO service_role;

-- Writes only the Slack message timestamp, leaving the rest of the draft alone.
-- Read-modify-writing the whole JSON from TypeScript could put a stale 'draft'
-- status back over a claim made in between, re-opening the double-send window.
CREATE OR REPLACE FUNCTION public.attach_offer_slack_ts(p_job_id uuid, p_ts text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE tile_job_results r
  SET content = jsonb_set(r.content, '{slack_context,draft_message_ts}', to_jsonb(p_ts))
  WHERE r.id = (
    SELECT inner_r.id
    FROM tile_job_results inner_r
    WHERE inner_r.job_id = p_job_id
    ORDER BY inner_r.created_at DESC
    LIMIT 1
  )
    AND r.content ? 'slack_context'
$$;

REVOKE EXECUTE ON FUNCTION public.attach_offer_slack_ts(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_offer_slack_ts(uuid, text) TO service_role;
