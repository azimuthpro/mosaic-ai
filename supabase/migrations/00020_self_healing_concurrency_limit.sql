-- =============================================================================
-- Self-healing concurrent execution counter
--
-- concurrent_executions is decremented in a `finally` block. When the platform
-- kills a function (e.g. at the Vercel max duration) the decrement never runs,
-- and after three such leaks every execution is rejected with
-- "Maximum concurrent executions reached (3/3)" forever.
--
-- Track when the last execution started. No execution outlives
-- MAX_TIMEOUT_MS (10 min, lib/execution/context.ts), so if the most recent
-- start is older than 15 minutes every counted execution is dead and the
-- counter is reset.
-- =============================================================================

ALTER TABLE public.user_rate_limits
  ADD COLUMN IF NOT EXISTS last_execution_started_at timestamptz;

CREATE OR REPLACE FUNCTION public.check_and_increment_execution_count(
  p_user_id uuid,
  p_max_per_hour integer DEFAULT 100,
  p_max_concurrent integer DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row user_rate_limits%ROWTYPE;
  v_new_count integer;
  v_allowed boolean;
  v_hour_start timestamptz;
  v_stale_before timestamptz;
BEGIN
  v_hour_start := date_trunc('hour', now());
  v_stale_before := now() - interval '15 minutes';

  INSERT INTO user_rate_limits (user_id, executions_this_hour, hour_window_start, concurrent_executions, updated_at)
  VALUES (p_user_id, 0, v_hour_start, 0, now())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO v_row;

  IF v_row.hour_window_start < v_hour_start THEN
    UPDATE user_rate_limits SET executions_this_hour = 0, hour_window_start = v_hour_start, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_row;
  END IF;

  -- Rows that predate this migration have no start time; treat them as stale.
  IF v_row.concurrent_executions > 0
     AND COALESCE(v_row.last_execution_started_at, '-infinity') < v_stale_before THEN
    UPDATE user_rate_limits SET concurrent_executions = 0, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_row;
  END IF;

  v_allowed := (v_row.executions_this_hour < p_max_per_hour) AND (v_row.concurrent_executions < p_max_concurrent);

  IF v_allowed THEN
    UPDATE user_rate_limits
    SET executions_this_hour = executions_this_hour + 1,
        concurrent_executions = concurrent_executions + 1,
        last_execution_started_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id RETURNING executions_this_hour INTO v_new_count;
  ELSE
    v_new_count := v_row.executions_this_hour;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'current_count', v_new_count,
    'max_per_hour', p_max_per_hour,
    'concurrent_executions', v_row.concurrent_executions,
    'max_concurrent', p_max_concurrent,
    'resets_at', v_hour_start + interval '1 hour',
    'reason', CASE
      WHEN NOT v_allowed AND v_row.concurrent_executions >= p_max_concurrent THEN 'max_concurrent_exceeded'
      WHEN NOT v_allowed AND v_row.executions_this_hour >= p_max_per_hour THEN 'hourly_limit_exceeded'
      ELSE null
    END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_execution_count(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
