-- =============================================================================
-- MOSAIC AI CONSOLIDATED INITIAL SCHEMA
-- Optimized and Simplified
-- =============================================================================

-- 0. CLEAN SLATE: Drop existing application objects
-- (Only necessary if running on an existing database)
DO $$
BEGIN
  -- Drop tables if they exist
  DROP TABLE IF EXISTS public.tile_webhook_deliveries CASCADE;
  DROP TABLE IF EXISTS public.tile_webhooks CASCADE;
  DROP TABLE IF EXISTS public.tile_job_execution_logs CASCADE;
  DROP TABLE IF EXISTS public.tile_job_results CASCADE;
  DROP TABLE IF EXISTS public.tile_jobs CASCADE;
  DROP TABLE IF EXISTS public.tile_sources CASCADE;
  DROP TABLE IF EXISTS public.tile_connections CASCADE;
  DROP TABLE IF EXISTS public.tiles CASCADE;
  DROP TABLE IF EXISTS public.tile_skills CASCADE;
  DROP TABLE IF EXISTS public.mosaic_api_keys CASCADE;
  DROP TABLE IF EXISTS public.mosaic_invitations CASCADE;
  DROP TABLE IF EXISTS public.mosaic_members CASCADE;
  DROP TABLE IF EXISTS public.mosaics CASCADE;
  DROP TABLE IF EXISTS public.user_rate_limits CASCADE;
  DROP TABLE IF EXISTS public.users CASCADE;
  DROP TABLE IF EXISTS public.allowlist CASCADE;
  
  -- Drop custom enums
  DROP TYPE IF EXISTS public.invitation_status CASCADE;
  DROP TYPE IF EXISTS public.tile_skill_category CASCADE;
  DROP TYPE IF EXISTS public.tile_pattern CASCADE;
  DROP TYPE IF EXISTS public.tile_type CASCADE;
  DROP TYPE IF EXISTS public.source_type CASCADE;
END $$;

-- 1. EXTENSIONS
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS "citext";
CREATE EXTENSION "citext" SCHEMA extensions;

-- 2. ENUMS & TYPES
CREATE TYPE public.source_type AS ENUM ('url', 'web_search');
CREATE TYPE public.tile_type AS ENUM ('url_reader', 'web_search', 'recursive', 'analyzer');
CREATE TYPE public.tile_pattern AS ENUM ('solid', 'stripes', 'dots', 'gradient');
CREATE TYPE public.tile_skill_category AS ENUM ('news', 'market', 'research', 'social', 'deep-search', 'analysis', 'custom');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'cancelled');

-- 3. CORE ACCESS & USERS
CREATE TABLE public.allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email extensions.citext UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  invited_by uuid -- References auth.users(id) - can't add FK until auth schema is ready, but it's handled by server-side logic
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email extensions.citext UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.user_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  executions_this_hour integer DEFAULT 0,
  hour_window_start timestamptz DEFAULT now(),
  concurrent_executions integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- 4. WORKSPACES
CREATE TABLE public.mosaics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  settings jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.mosaic_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(mosaic_id, user_id)
);

CREATE TABLE public.mosaic_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  email extensions.citext NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  token uuid DEFAULT gen_random_uuid() NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status invitation_status DEFAULT 'pending' NOT NULL,
  expires_at timestamptz DEFAULT (now() + interval '7 days') NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.mosaic_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  key_hash varchar(64) NOT NULL,
  key_prefix varchar(12) NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- 5. TILE ENGINE
CREATE TABLE public.tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  tile_type tile_type NOT NULL,
  color varchar(7) NOT NULL DEFAULT '#3B82F6',
  pattern tile_pattern DEFAULT 'solid' NOT NULL,
  grid_x integer NOT NULL DEFAULT 0,
  grid_y integer NOT NULL DEFAULT 0,
  grid_width integer NOT NULL DEFAULT 1 CHECK (grid_width >= 1),
  grid_height integer NOT NULL DEFAULT 1 CHECK (grid_height >= 1),
  system_prompt text,
  output_format text NOT NULL DEFAULT 'text' CHECK (output_format IN ('text', 'json')),
  output_schema text DEFAULT NULL,
  language varchar(5) DEFAULT 'en' NOT NULL,
  schedule_cron varchar(100),
  is_active boolean DEFAULT true NOT NULL,
  max_chain_depth smallint DEFAULT 5 CHECK (max_chain_depth BETWEEN 1 AND 10),
  execution_timeout_ms integer DEFAULT 300000 CHECK (execution_timeout_ms BETWEEN 10000 AND 600000),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- UNIFIED CONNECTIONS (Tracks both visual and data flow)
CREATE TABLE public.tile_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  source_tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  target_tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  config jsonb DEFAULT '{}' NOT NULL, -- Configures data flow (mapping, filters)
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(source_tile_id, target_tile_id),
  CHECK(source_tile_id != target_tile_id)
);

-- EXTERNAL SOURCES ONLY
CREATE TABLE public.tile_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  type source_type NOT NULL DEFAULT 'url',
  url text,
  name text,
  config jsonb DEFAULT '{}' NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  last_scraped_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT tile_sources_url_required_for_url CHECK ((type = 'url' AND url IS NOT NULL) OR (type != 'url'))
);

CREATE TABLE public.tile_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE,
  tile_type tile_type NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  prompt text NOT NULL,
  category tile_skill_category DEFAULT 'custom' NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_system boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT tile_skills_system_has_no_mosaic CHECK ((is_system = true AND mosaic_id IS NULL) OR (is_system = false)),
  CONSTRAINT tile_skills_custom_has_mosaic CHECK ((is_system = false AND mosaic_id IS NOT NULL) OR (is_system = true))
);

-- 6. EXECUTION & LOGGING
CREATE TABLE public.tile_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}' NOT NULL,
  execution_id uuid, -- For tracking chains
  chain_depth smallint DEFAULT 0,
  parent_job_id uuid REFERENCES public.tile_jobs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.tile_job_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.tile_jobs(id) ON DELETE CASCADE NOT NULL,
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  content jsonb NOT NULL,
  format text NOT NULL DEFAULT 'text' CHECK (format IN ('text', 'json')),
  source_urls text[] DEFAULT array[]::text[],
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.tile_job_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL,
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.tile_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE public.tile_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY['job.completed'],
  auth_type varchar(50) DEFAULT 'none',
  auth_config jsonb DEFAULT '{}',
  retry_count integer DEFAULT 3,
  timeout_ms integer DEFAULT 30000,
  is_active boolean DEFAULT true,
  last_triggered_at timestamptz,
  last_status varchar(50),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tile_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid REFERENCES public.tile_webhooks(id) ON DELETE CASCADE NOT NULL,
  job_id uuid REFERENCES public.tile_jobs(id) ON DELETE SET NULL,
  event_type varchar(50) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'pending',
  response_status integer,
  response_body text,
  attempts integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  delivered_at timestamptz
);

-- 7. HELPER FUNCTIONS & TRIGGERS

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- Trigger Assignments
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
CREATE TRIGGER update_mosaics_updated_at BEFORE UPDATE ON public.mosaics FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
CREATE TRIGGER update_tiles_updated_at BEFORE UPDATE ON public.tiles FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
CREATE TRIGGER update_tile_sources_updated_at BEFORE UPDATE ON public.tile_sources FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
CREATE TRIGGER update_tile_skills_updated_at BEFORE UPDATE ON public.tile_skills FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
CREATE TRIGGER update_mosaic_invitations_updated_at BEFORE UPDATE ON public.mosaic_invitations FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- Security Helpers
CREATE OR REPLACE FUNCTION public.is_mosaic_owner(p_mosaic_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM mosaics WHERE id = p_mosaic_id AND owner_id = auth.uid());
$$;

-- RLS Check Helper (uses OR + EXISTS for short-circuit evaluation)
CREATE OR REPLACE FUNCTION public.has_mosaic_access(p_mosaic_id uuid)
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

-- New User Signup Handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Rate Limiting Helpers
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
BEGIN
  v_hour_start := date_trunc('hour', now());

  INSERT INTO user_rate_limits (user_id, executions_this_hour, hour_window_start, concurrent_executions, updated_at)
  VALUES (p_user_id, 0, v_hour_start, 0, now())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
  RETURNING * INTO v_row;

  IF v_row.hour_window_start < v_hour_start THEN
    UPDATE user_rate_limits SET executions_this_hour = 0, hour_window_start = v_hour_start, updated_at = now()
    WHERE user_id = p_user_id RETURNING * INTO v_row;
  END IF;

  v_allowed := (v_row.executions_this_hour < p_max_per_hour) AND (v_row.concurrent_executions < p_max_concurrent);

  IF v_allowed THEN
    UPDATE user_rate_limits SET executions_this_hour = executions_this_hour + 1, concurrent_executions = concurrent_executions + 1, updated_at = now()
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

CREATE OR REPLACE FUNCTION public.decrement_concurrent_execution_count(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_rate_limits SET concurrent_executions = GREATEST(0, concurrent_executions - 1), updated_at = now() WHERE user_id = p_user_id;
END;
$$;

-- Logging Helper
CREATE OR REPLACE FUNCTION public.log_tile_job_execution_event(
  p_execution_id uuid,
  p_tile_id uuid,
  p_job_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.tile_job_execution_logs (execution_id, tile_id, job_id, event_type, metadata)
  VALUES (p_execution_id, p_tile_id, p_job_id, p_event_type, p_metadata)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$;

-- Circular Dependency Check
CREATE OR REPLACE FUNCTION public.check_tile_circular_dependency(p_source_tile_id uuid, p_target_tile_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_has_cycle boolean;
BEGIN
  WITH RECURSIVE connection_chain AS (
    SELECT source_tile_id, target_tile_id, 1 as depth FROM tile_connections WHERE source_tile_id = p_target_tile_id
    UNION ALL
    SELECT tc.source_tile_id, tc.target_tile_id, cc.depth + 1 FROM tile_connections tc JOIN connection_chain cc ON tc.source_tile_id = cc.target_tile_id WHERE cc.depth < 20
  )
  SELECT EXISTS (SELECT 1 FROM connection_chain WHERE target_tile_id = p_source_tile_id) INTO v_has_cycle;
  RETURN v_has_cycle;
END;
$$;

-- Rate Limit Status (read-only, no increment)
CREATE OR REPLACE FUNCTION public.get_rate_limit_status(p_user_id uuid)
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

  SELECT * INTO v_row FROM user_rate_limits WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'executions_this_hour', 0,
      'concurrent_executions', 0,
      'hour_window_start', v_hour_start,
      'resets_at', v_hour_start + interval '1 hour'
    );
  END IF;

  -- Reset counters if we're in a new hour window
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

-- Accept Mosaic Invitation
CREATE OR REPLACE FUNCTION public.accept_mosaic_invitation(p_token uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation mosaic_invitations%ROWTYPE;
  v_existing_member uuid;
BEGIN
  -- Find the invitation by token
  SELECT * INTO v_invitation
  FROM mosaic_invitations
  WHERE token = p_token AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or already used');
  END IF;

  -- Check if expired
  IF v_invitation.expires_at < now() THEN
    UPDATE mosaic_invitations SET status = 'expired', updated_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  -- Check if user is already a member
  SELECT id INTO v_existing_member
  FROM mosaic_members
  WHERE mosaic_id = v_invitation.mosaic_id AND user_id = p_user_id;

  IF FOUND THEN
    -- Mark invitation as accepted even if already a member
    UPDATE mosaic_invitations SET status = 'accepted', updated_at = now() WHERE id = v_invitation.id;
    RETURN jsonb_build_object('success', true, 'mosaic_id', v_invitation.mosaic_id, 'already_member', true);
  END IF;

  -- Add user as a member with the invited role
  INSERT INTO mosaic_members (mosaic_id, user_id, role)
  VALUES (v_invitation.mosaic_id, p_user_id, v_invitation.role);

  -- Mark invitation as accepted
  UPDATE mosaic_invitations SET status = 'accepted', updated_at = now() WHERE id = v_invitation.id;

  RETURN jsonb_build_object('success', true, 'mosaic_id', v_invitation.mosaic_id, 'already_member', false);
END;
$$;

-- Transfer Mosaic Ownership
CREATE OR REPLACE FUNCTION public.transfer_mosaic_ownership(
  p_mosaic_id uuid,
  p_current_owner_id uuid,
  p_new_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mosaic mosaics%ROWTYPE;
  v_new_owner_member mosaic_members%ROWTYPE;
BEGIN
  -- Verify the mosaic exists and the current user is the owner
  SELECT * INTO v_mosaic FROM mosaics WHERE id = p_mosaic_id AND owner_id = p_current_owner_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mosaic not found or you are not the owner');
  END IF;

  -- Verify the new owner is an admin member
  SELECT * INTO v_new_owner_member
  FROM mosaic_members
  WHERE mosaic_id = p_mosaic_id AND user_id = p_new_owner_id AND role = 'admin';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'New owner must be an admin member of the mosaic');
  END IF;

  -- Transfer ownership
  UPDATE mosaics SET owner_id = p_new_owner_id, updated_at = now() WHERE id = p_mosaic_id;

  -- Update the new owner's member role to 'owner'
  UPDATE mosaic_members SET role = 'owner' WHERE mosaic_id = p_mosaic_id AND user_id = p_new_owner_id;

  -- Demote the previous owner to 'admin'
  -- First check if they have a member record, if not create one
  IF EXISTS (SELECT 1 FROM mosaic_members WHERE mosaic_id = p_mosaic_id AND user_id = p_current_owner_id) THEN
    UPDATE mosaic_members SET role = 'admin' WHERE mosaic_id = p_mosaic_id AND user_id = p_current_owner_id;
  ELSE
    INSERT INTO mosaic_members (mosaic_id, user_id, role) VALUES (p_mosaic_id, p_current_owner_id, 'admin');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. RLS POLICIES

-- Apply RLS Enable to all tables
ALTER TABLE public.allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mosaics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mosaic_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mosaic_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mosaic_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tile_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tile_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tile_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tile_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tile_job_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tile_job_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tile_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tile_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Allowlist: Service role only
CREATE POLICY "Allowlist is service role only" ON public.allowlist FOR ALL USING (false);

-- Users: Own profile
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Rate Limits: Own limits
CREATE POLICY "Users can view own rate limits" ON public.user_rate_limits FOR SELECT USING (user_id = auth.uid());

-- Mosaics: Owner and Members
CREATE POLICY "Owners can manage own mosaics" ON public.mosaics FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Members can view shared mosaics" ON public.mosaics FOR SELECT USING (EXISTS (SELECT 1 FROM mosaic_members mm WHERE mm.mosaic_id = mosaics.id AND mm.user_id = auth.uid()));

-- Mosaic Members: Self or Owner
CREATE POLICY "Users can view memberships" ON public.mosaic_members FOR SELECT USING (user_id = auth.uid() OR is_mosaic_owner(mosaic_id));
CREATE POLICY "Owners can manage memberships" ON public.mosaic_members FOR ALL USING (is_mosaic_owner(mosaic_id));

-- Invitations: Owner or invited email
CREATE POLICY "Owners can manage invitations" ON public.mosaic_invitations FOR ALL USING (is_mosaic_owner(mosaic_id));
CREATE POLICY "Users can view their invitations" ON public.mosaic_invitations FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- API Keys: Owner or Admin
CREATE POLICY "Admins can manage API keys" ON public.mosaic_api_keys FOR ALL USING (
  EXISTS (SELECT 1 FROM mosaics m WHERE m.id = mosaic_id AND m.owner_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM mosaic_members mm WHERE mm.mosaic_id = mosaic_id AND mm.user_id = auth.uid() AND mm.role IN ('owner', 'admin'))
);

-- Tiles: Mosaic Access
CREATE POLICY "Users can view accessible tiles" ON public.tiles FOR SELECT USING (has_mosaic_access(mosaic_id));
CREATE POLICY "Admins can manage tiles" ON public.tiles FOR ALL USING (
  is_mosaic_owner(mosaic_id) OR 
  EXISTS (SELECT 1 FROM mosaic_members mm WHERE mm.mosaic_id = mosaic_id AND mm.user_id = auth.uid() AND mm.role IN ('owner', 'admin'))
);

-- Tile Connections: Mosaic Access
CREATE POLICY "Users can view accessible connections" ON public.tile_connections FOR SELECT USING (has_mosaic_access(mosaic_id));
CREATE POLICY "Admins can manage connections" ON public.tile_connections FOR ALL USING (
  is_mosaic_owner(mosaic_id) OR 
  EXISTS (SELECT 1 FROM mosaic_members mm WHERE mm.mosaic_id = mosaic_id AND mm.user_id = auth.uid() AND mm.role IN ('owner', 'admin'))
);

-- Tile Sources: Mosaic Access
CREATE POLICY "Users can view accessible sources" ON public.tile_sources FOR SELECT USING (
  EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_id AND has_mosaic_access(t.mosaic_id))
);
CREATE POLICY "Admins can manage sources" ON public.tile_sources FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tiles t
    LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
    WHERE t.id = tile_id AND (is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
  )
);

-- Skills: System or Mosaic Access
CREATE POLICY "Anyone can view system skills" ON public.tile_skills FOR SELECT USING (is_system = true);
CREATE POLICY "Users can view accessible skills" ON public.tile_skills FOR SELECT USING (mosaic_id IS NOT NULL AND has_mosaic_access(mosaic_id));
CREATE POLICY "Admins can manage skills" ON public.tile_skills FOR ALL USING (
  mosaic_id IS NOT NULL AND (is_mosaic_owner(mosaic_id) OR EXISTS (SELECT 1 FROM mosaic_members mm WHERE mm.mosaic_id = mosaic_id AND mm.user_id = auth.uid() AND mm.role IN ('owner', 'admin')))
);

-- Jobs: Mosaic Access
CREATE POLICY "Users can view accessible jobs" ON public.tile_jobs FOR SELECT USING (
  EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_id AND has_mosaic_access(t.mosaic_id))
);
CREATE POLICY "Admins can delete jobs" ON public.tile_jobs FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tiles t
    LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
    WHERE t.id = tile_id AND (is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
  )
);

-- Results: Mosaic Access
CREATE POLICY "Users can view accessible results" ON public.tile_job_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_id AND has_mosaic_access(t.mosaic_id))
);
CREATE POLICY "Admins can delete results" ON public.tile_job_results FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tiles t
    LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
    WHERE t.id = tile_id AND (is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
  )
);

-- Logs: Mosaic Access
CREATE POLICY "Users can view accessible logs" ON public.tile_job_execution_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_id AND has_mosaic_access(t.mosaic_id))
);

-- Webhooks: Mosaic Access
CREATE POLICY "Users can view accessible webhooks" ON public.tile_webhooks FOR SELECT USING (
  EXISTS (SELECT 1 FROM tiles t WHERE t.id = tile_id AND has_mosaic_access(t.mosaic_id))
);
CREATE POLICY "Admins can manage webhooks" ON public.tile_webhooks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tiles t
    LEFT JOIN mosaic_members mm ON t.mosaic_id = mm.mosaic_id AND mm.user_id = auth.uid()
    WHERE t.id = tile_id AND (is_mosaic_owner(t.mosaic_id) OR mm.role IN ('owner', 'admin'))
  )
);

-- Deliveries: Mosaic Access
CREATE POLICY "Users can view accessible deliveries" ON public.tile_webhook_deliveries FOR SELECT USING (
  EXISTS (SELECT 1 FROM tile_webhooks tw JOIN tiles t ON t.id = tw.tile_id WHERE tw.id = webhook_id AND has_mosaic_access(t.mosaic_id))
);

-- 9. INDEXES

-- Foreign key lookups
CREATE INDEX idx_allowlist_email_active ON public.allowlist(email, is_active);
CREATE INDEX idx_mosaics_owner ON public.mosaics(owner_id);
CREATE INDEX idx_mosaic_members_mosaic ON public.mosaic_members(mosaic_id);
CREATE INDEX idx_mosaic_members_user ON public.mosaic_members(user_id);
CREATE INDEX idx_mosaic_invitations_mosaic ON public.mosaic_invitations(mosaic_id);
CREATE INDEX idx_mosaic_invitations_email_pending ON public.mosaic_invitations(email) WHERE status = 'pending';
CREATE INDEX idx_mosaic_api_keys_key_hash ON public.mosaic_api_keys(key_hash);
CREATE INDEX idx_tiles_mosaic ON public.tiles(mosaic_id);
CREATE INDEX idx_tile_connections_mosaic ON public.tile_connections(mosaic_id);
CREATE INDEX idx_tile_sources_tile ON public.tile_sources(tile_id);
CREATE INDEX idx_tile_jobs_tile_status ON public.tile_jobs(tile_id, status);
CREATE INDEX idx_tile_job_results_job ON public.tile_job_results(job_id);
CREATE INDEX idx_tile_job_execution_logs_execution ON public.tile_job_execution_logs(execution_id);
CREATE INDEX idx_tile_webhooks_tile ON public.tile_webhooks(tile_id);

-- Query performance: sorted lookups for "latest results/jobs" queries
CREATE INDEX idx_tile_job_results_tile_created ON public.tile_job_results(tile_id, created_at DESC);
CREATE INDEX idx_tile_jobs_tile_created ON public.tile_jobs(tile_id, created_at DESC);
CREATE INDEX idx_tile_webhook_deliveries_webhook_created ON public.tile_webhook_deliveries(webhook_id, created_at DESC);

-- Connection graph traversal (circular dependency checks use target_tile_id)
CREATE INDEX idx_tile_connections_target ON public.tile_connections(target_tile_id);

-- Cron scheduler: quickly find active tiles with schedules
CREATE INDEX idx_tiles_active_scheduled ON public.tiles(is_active) WHERE is_active = true AND schedule_cron IS NOT NULL;

-- Webhook event matching (GIN for array contains queries)
CREATE INDEX idx_tile_webhooks_events ON public.tile_webhooks USING gin(events);

-- 10. SYSTEM DATA SEEDING (Skills)

-- URL Reader Skills
INSERT INTO public.tile_skills (tile_type, name, description, prompt, category, is_system) VALUES
(
  'url_reader', 'News Monitor', 'Extract and summarize news articles with key facts and developments',
  'You are a news analyst. Extract and summarize the key information from this content: 1. **Headline Summary**: What is the main story in 1-2 sentences? 2. **Key Facts**: List the most important facts (who, what, when, where) 3. **Impact**: What are the implications or consequences? 4. **Related Context**: Any relevant background information mentioned. Format your response clearly with headers. Focus on facts, avoid speculation.',
  'news', true
),
(
  'url_reader', 'Price Tracker', 'Monitor and extract pricing information from product pages',
  'You are a price monitoring assistant. Extract pricing information from this content: 1. **Product/Service Name**: What is being priced? 2. **Current Price**: The main price (include currency) 3. **Price Variations**: Any tiers, discounts, or alternative pricing 4. **Comparison**: Any competitor pricing mentioned 5. **Price Changes**: Any historical pricing or changes mentioned. If pricing is not found, clearly state that. Be precise with numbers.',
  'market', true
),
(
  'url_reader', 'Article Summarizer', 'Create concise summaries of long-form articles and blog posts',
  'You are a content summarizer. Create a comprehensive summary of this article: 1. **TL;DR**: One paragraph capturing the essence (3-4 sentences max) 2. **Main Points**: Bullet list of key arguments or information 3. **Supporting Details**: Important evidence or examples 4. **Conclusion**: What is the author''s final takeaway? Keep the summary under 300 words. Preserve the author''s main message.',
  'research', true
);

-- Web Search Skills
INSERT INTO public.tile_skills (tile_type, name, description, prompt, category, is_system) VALUES
(
  'web_search', 'Market Research', 'Comprehensive market analysis from search results',
  'You are a market research analyst. Synthesize the search results into a market analysis: 1. **Market Overview**: Current state of the market/industry 2. **Key Players**: Major companies or products mentioned 3. **Trends**: Emerging patterns or developments 4. **Opportunities**: Potential growth areas identified 5. **Challenges**: Risks or obstacles mentioned. Cite sources where possible. Focus on actionable insights.',
  'market', true
),
(
  'web_search', 'Topic Deep Dive', 'In-depth research synthesis on any topic',
  'You are a research synthesizer. Create a comprehensive overview: 1. **Executive Summary**: Key findings in 2-3 sentences 2. **Background**: Essential context for understanding 3. **Current State**: What we know now 4. **Different Perspectives**: Various viewpoints or debates 5. **Knowledge Gaps**: What remains unknown or disputed. Balance depth with clarity. Cite sources throughout.',
  'deep-search', true
);

-- Recursive (Pipeline) Skills
INSERT INTO public.tile_skills (tile_type, name, description, prompt, category, is_system) VALUES
(
  'recursive', 'Data Synthesizer', 'Combine and synthesize data from multiple tile outputs',
  'You are a data synthesizer. Combine the input from connected tiles: 1. **Common Themes**: What patterns appear across sources? 2. **Key Insights**: Most important findings from all inputs 3. **Contradictions**: Any conflicting information? 4. **Synthesis**: Combined narrative from all sources. Create a unified analysis that is more valuable than the parts.',
  'analysis', true
);

-- Analyzer Skills
INSERT INTO public.tile_skills (tile_type, name, description, prompt, category, is_system) VALUES
(
  'analyzer', 'Sentiment Analyzer', 'Analyze sentiment and emotional tone across data',
  'You are a sentiment analyst. Analyze the emotional content: 1. **Overall Sentiment**: Positive, negative, or neutral (with score 1-10) 2. **Sentiment Breakdown**: Distribution across the content 3. **Key Phrases**: Quotes that indicate sentiment 4. **Sentiment Shifts**: Changes in tone throughout. Be objective. Support conclusions with evidence from the text.',
  'analysis', true
);
