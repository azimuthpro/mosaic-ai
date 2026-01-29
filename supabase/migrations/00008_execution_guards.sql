-- Migration: Add execution guards and rate limiting
-- This adds loop guards, execution tracking, and rate limiting to the agent system

-- ============================================================================
-- AGENTS TABLE: Add execution configuration columns
-- ============================================================================

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS max_chain_depth smallint DEFAULT 5
    CHECK (max_chain_depth BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS execution_timeout_ms integer DEFAULT 300000
    CHECK (execution_timeout_ms BETWEEN 10000 AND 600000);

COMMENT ON COLUMN agents.max_chain_depth IS 'Maximum depth for agent chain execution (1-10, default 5)';
COMMENT ON COLUMN agents.execution_timeout_ms IS 'Maximum execution time in milliseconds (10s-10min, default 5min)';

-- ============================================================================
-- JOBS TABLE: Add execution tracking columns
-- ============================================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS execution_id uuid,
  ADD COLUMN IF NOT EXISTS chain_depth smallint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES jobs(id) ON DELETE SET NULL;

COMMENT ON COLUMN jobs.execution_id IS 'Unique ID for the execution chain this job belongs to';
COMMENT ON COLUMN jobs.chain_depth IS 'Depth in the agent chain (0 = root)';
COMMENT ON COLUMN jobs.parent_job_id IS 'ID of the job that triggered this one (for chained agents)';

-- Index for execution chain queries
CREATE INDEX IF NOT EXISTS idx_jobs_execution_id ON jobs(execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_parent_job_id ON jobs(parent_job_id) WHERE parent_job_id IS NOT NULL;

-- ============================================================================
-- EXECUTION LOGS TABLE: Detailed execution tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS execution_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  execution_id uuid NOT NULL,
  agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE execution_logs IS 'Detailed logs for agent execution chains';
COMMENT ON COLUMN execution_logs.event_type IS 'Type of event: started, completed, failed, timeout, cycle_detected, depth_exceeded';

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_execution_logs_execution_id ON execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_agent_id ON execution_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at ON execution_logs(created_at);

-- RLS for execution_logs (users can only see logs for their agents)
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view execution logs for their agents"
  ON execution_logs FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE owner_id = auth.uid()
    )
  );

-- Service role can insert execution logs
CREATE POLICY "Service role can insert execution logs"
  ON execution_logs FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- USER RATE LIMITS TABLE: Track execution rates per user
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  executions_this_hour integer DEFAULT 0,
  hour_window_start timestamptz DEFAULT now(),
  concurrent_executions integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE user_rate_limits IS 'Tracks execution rate limits per user';
COMMENT ON COLUMN user_rate_limits.executions_this_hour IS 'Number of executions in the current hour window';
COMMENT ON COLUMN user_rate_limits.hour_window_start IS 'Start of the current hourly window';
COMMENT ON COLUMN user_rate_limits.concurrent_executions IS 'Number of currently running executions';

-- RLS for user_rate_limits
ALTER TABLE user_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limits"
  ON user_rate_limits FOR SELECT
  USING (user_id = auth.uid());

-- Service role policies for rate limit management
CREATE POLICY "Service role can manage rate limits"
  ON user_rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RATE LIMIT FUNCTIONS: Atomic increment/decrement operations
-- ============================================================================

-- Function to check and increment execution count
-- Returns: { allowed: boolean, current_count: int, max_count: int, resets_at: timestamptz }
CREATE OR REPLACE FUNCTION check_and_increment_execution_count(
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
  v_result jsonb;
  v_row user_rate_limits%ROWTYPE;
  v_new_count integer;
  v_allowed boolean;
  v_hour_start timestamptz;
BEGIN
  -- Calculate current hour window start
  v_hour_start := date_trunc('hour', now());

  -- Upsert and lock the row
  INSERT INTO user_rate_limits (user_id, executions_this_hour, hour_window_start, concurrent_executions, updated_at)
  VALUES (p_user_id, 0, v_hour_start, 0, now())
  ON CONFLICT (user_id) DO UPDATE
  SET updated_at = now()
  RETURNING * INTO v_row;

  -- Check if we need to reset the hour window
  IF v_row.hour_window_start < v_hour_start THEN
    -- Reset the counter for new hour
    UPDATE user_rate_limits
    SET executions_this_hour = 0,
        hour_window_start = v_hour_start,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_row;
  END IF;

  -- Check limits
  v_allowed := (v_row.executions_this_hour < p_max_per_hour) AND
               (v_row.concurrent_executions < p_max_concurrent);

  IF v_allowed THEN
    -- Increment both counters
    UPDATE user_rate_limits
    SET executions_this_hour = executions_this_hour + 1,
        concurrent_executions = concurrent_executions + 1,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING executions_this_hour INTO v_new_count;
  ELSE
    v_new_count := v_row.executions_this_hour;
  END IF;

  v_result := jsonb_build_object(
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

  RETURN v_result;
END;
$$;

-- Function to decrement concurrent execution count (called when execution completes)
CREATE OR REPLACE FUNCTION decrement_concurrent_execution_count(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE user_rate_limits
  SET concurrent_executions = GREATEST(0, concurrent_executions - 1),
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Function to get current rate limit status without incrementing
CREATE OR REPLACE FUNCTION get_rate_limit_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row user_rate_limits%ROWTYPE;
  v_hour_start timestamptz;
BEGIN
  v_hour_start := date_trunc('hour', now());

  SELECT * INTO v_row
  FROM user_rate_limits
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'executions_this_hour', 0,
      'concurrent_executions', 0,
      'hour_window_start', v_hour_start,
      'resets_at', v_hour_start + interval '1 hour'
    );
  END IF;

  -- If the window has passed, report as reset
  IF v_row.hour_window_start < v_hour_start THEN
    RETURN jsonb_build_object(
      'executions_this_hour', 0,
      'concurrent_executions', v_row.concurrent_executions,
      'hour_window_start', v_hour_start,
      'resets_at', v_hour_start + interval '1 hour'
    );
  END IF;

  RETURN jsonb_build_object(
    'executions_this_hour', v_row.executions_this_hour,
    'concurrent_executions', v_row.concurrent_executions,
    'hour_window_start', v_row.hour_window_start,
    'resets_at', v_row.hour_window_start + interval '1 hour'
  );
END;
$$;

-- ============================================================================
-- EXECUTION LOG HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_execution_event(
  p_execution_id uuid,
  p_agent_id uuid,
  p_job_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO execution_logs (execution_id, agent_id, job_id, event_type, metadata)
  VALUES (p_execution_id, p_agent_id, p_job_id, p_event_type, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
