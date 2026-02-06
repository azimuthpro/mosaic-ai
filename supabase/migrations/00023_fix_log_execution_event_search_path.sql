-- Fix function search_path security warning for log_execution_event
-- Sets immutable search_path to prevent search_path manipulation attacks
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

CREATE OR REPLACE FUNCTION public.log_execution_event(
  p_execution_id uuid,
  p_tile_id uuid,
  p_job_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.execution_logs (execution_id, tile_id, job_id, event_type, metadata)
  VALUES (p_execution_id, p_tile_id, p_job_id, p_event_type, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;
