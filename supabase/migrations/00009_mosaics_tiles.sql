-- Migration: Mosaic AI Core Refactor - Mosaics and Tiles Architecture
-- This migration introduces the workspace-based Mosaic/Tile model:
-- - Mosaics: Workspace containers (users can have multiple)
-- - Tiles: Visual grid-based representation (replaces agents)
-- - Tile Connections: Visual connections between tiles
-- - Mosaic-level sharing (tiles inherit permissions)

-- ============================================================================
-- TILE TYPE ENUM
-- ============================================================================

CREATE TYPE tile_type AS ENUM ('url_reader', 'web_search', 'recursive', 'analyzer');
CREATE TYPE tile_pattern AS ENUM ('solid', 'stripes', 'dots', 'gradient');

COMMENT ON TYPE tile_type IS 'Types of tiles: url_reader (scrape URLs), web_search (AI search), recursive (chain outputs), analyzer (process data)';
COMMENT ON TYPE tile_pattern IS 'Visual patterns for tile appearance';

-- ============================================================================
-- MOSAICS TABLE: Workspace containers
-- ============================================================================

CREATE TABLE public.mosaics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  settings jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE mosaics IS 'Workspace containers for organizing tiles';
COMMENT ON COLUMN mosaics.settings IS 'Mosaic-specific settings (e.g., default schedule, grid size)';

-- RLS for mosaics
ALTER TABLE public.mosaics ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own mosaics
CREATE POLICY "Owners can manage own mosaics"
  ON public.mosaics FOR ALL
  USING (owner_id = auth.uid());

-- Members can view mosaics they belong to
CREATE POLICY "Members can view shared mosaics"
  ON public.mosaics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM mosaic_members
      WHERE mosaic_members.mosaic_id = mosaics.id
      AND mosaic_members.user_id = auth.uid()
    )
  );

-- Index for faster lookups
CREATE INDEX idx_mosaics_owner ON public.mosaics(owner_id);

-- Updated at trigger
CREATE TRIGGER update_mosaics_updated_at
  BEFORE UPDATE ON public.mosaics
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- ============================================================================
-- MOSAIC_MEMBERS TABLE: Mosaic-level sharing
-- ============================================================================

CREATE TABLE public.mosaic_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(mosaic_id, user_id)
);

COMMENT ON TABLE mosaic_members IS 'Sharing permissions at the mosaic level';
COMMENT ON COLUMN mosaic_members.role IS 'Member role: owner (full control), admin (manage tiles), member (view only)';

-- RLS for mosaic_members
ALTER TABLE public.mosaic_members ENABLE ROW LEVEL SECURITY;

-- Users can view memberships for mosaics they own or are members of
CREATE POLICY "Users can view their memberships"
  ON public.mosaic_members FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.mosaics
      WHERE mosaics.id = mosaic_members.mosaic_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Only mosaic owners can manage members
CREATE POLICY "Owners can manage mosaic members"
  ON public.mosaic_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaics
      WHERE mosaics.id = mosaic_members.mosaic_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_mosaic_members_mosaic ON public.mosaic_members(mosaic_id);
CREATE INDEX idx_mosaic_members_user ON public.mosaic_members(user_id);

-- ============================================================================
-- TILES TABLE: Visual grid-based intelligence gathering units
-- ============================================================================

CREATE TABLE public.tiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  tile_type tile_type NOT NULL,

  -- Visual properties
  color varchar(7) NOT NULL DEFAULT '#3B82F6', -- Hex color
  pattern tile_pattern DEFAULT 'solid' NOT NULL,

  -- Grid position
  grid_x integer NOT NULL DEFAULT 0,
  grid_y integer NOT NULL DEFAULT 0,
  grid_width integer NOT NULL DEFAULT 1 CHECK (grid_width >= 1),
  grid_height integer NOT NULL DEFAULT 1 CHECK (grid_height >= 1),

  -- Configuration (from agents)
  system_prompt text,
  output_format text NOT NULL DEFAULT 'text' CHECK (output_format IN ('text', 'list', 'table', 'json')),
  language varchar(5) DEFAULT 'en' NOT NULL,
  schedule_cron varchar(100),
  is_active boolean DEFAULT true NOT NULL,

  -- Execution settings
  max_chain_depth smallint DEFAULT 5 CHECK (max_chain_depth BETWEEN 1 AND 10),
  execution_timeout_ms integer DEFAULT 300000 CHECK (execution_timeout_ms BETWEEN 10000 AND 600000),

  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE tiles IS 'Visual intelligence gathering units displayed on a mosaic canvas';
COMMENT ON COLUMN tiles.tile_type IS 'Type: url_reader, web_search, recursive (pipeline), analyzer';
COMMENT ON COLUMN tiles.color IS 'Hex color code for tile appearance (e.g., #3B82F6)';
COMMENT ON COLUMN tiles.pattern IS 'Visual pattern: solid, stripes, dots, gradient';
COMMENT ON COLUMN tiles.grid_x IS 'X position on the mosaic grid';
COMMENT ON COLUMN tiles.grid_y IS 'Y position on the mosaic grid';

-- RLS for tiles
ALTER TABLE public.tiles ENABLE ROW LEVEL SECURITY;

-- Users can manage tiles in mosaics they own
CREATE POLICY "Owners can manage tiles"
  ON public.tiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaics
      WHERE mosaics.id = tiles.mosaic_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Members with admin role can manage tiles
CREATE POLICY "Admins can manage tiles"
  ON public.tiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaic_members
      WHERE mosaic_members.mosaic_id = tiles.mosaic_id
      AND mosaic_members.user_id = auth.uid()
      AND mosaic_members.role IN ('owner', 'admin')
    )
  );

-- Members can view tiles
CREATE POLICY "Members can view tiles"
  ON public.tiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaic_members
      WHERE mosaic_members.mosaic_id = tiles.mosaic_id
      AND mosaic_members.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_tiles_mosaic ON public.tiles(mosaic_id);
CREATE INDEX idx_tiles_type ON public.tiles(tile_type);
CREATE INDEX idx_tiles_active ON public.tiles(is_active) WHERE is_active = true;

-- Updated at trigger
CREATE TRIGGER update_tiles_updated_at
  BEFORE UPDATE ON public.tiles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- ============================================================================
-- TILE_CONNECTIONS TABLE: Visual connections between tiles
-- ============================================================================

CREATE TABLE public.tile_connections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  source_tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  target_tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(source_tile_id, target_tile_id),
  CHECK(source_tile_id != target_tile_id)
);

COMMENT ON TABLE tile_connections IS 'Connections between tiles - source tile output feeds into target tile';
COMMENT ON COLUMN tile_connections.source_tile_id IS 'Tile that provides output';
COMMENT ON COLUMN tile_connections.target_tile_id IS 'Tile that receives input from source';

-- RLS for tile_connections
ALTER TABLE public.tile_connections ENABLE ROW LEVEL SECURITY;

-- Users can manage connections in mosaics they own
CREATE POLICY "Owners can manage connections"
  ON public.tile_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaics
      WHERE mosaics.id = tile_connections.mosaic_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Admins can manage connections
CREATE POLICY "Admins can manage connections"
  ON public.tile_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaic_members
      WHERE mosaic_members.mosaic_id = tile_connections.mosaic_id
      AND mosaic_members.user_id = auth.uid()
      AND mosaic_members.role IN ('owner', 'admin')
    )
  );

-- Members can view connections
CREATE POLICY "Members can view connections"
  ON public.tile_connections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaic_members
      WHERE mosaic_members.mosaic_id = tile_connections.mosaic_id
      AND mosaic_members.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_tile_connections_mosaic ON public.tile_connections(mosaic_id);
CREATE INDEX idx_tile_connections_source ON public.tile_connections(source_tile_id);
CREATE INDEX idx_tile_connections_target ON public.tile_connections(target_tile_id);

-- ============================================================================
-- TILE_SOURCES TABLE: Data inputs for tiles (renamed from sources)
-- ============================================================================

CREATE TABLE public.tile_sources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  url text,
  name text,
  is_active boolean DEFAULT true NOT NULL,
  last_scraped_at timestamptz,
  type source_type NOT NULL DEFAULT 'url',
  source_reference_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE,
  config jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  -- Constraints
  CONSTRAINT tile_sources_url_required_for_url_type
    CHECK ((type = 'url' AND url IS NOT NULL) OR (type != 'url')),
  CONSTRAINT tile_sources_reference_required_for_agent_report
    CHECK ((type = 'agent_report' AND source_reference_id IS NOT NULL) OR (type != 'agent_report')),
  CONSTRAINT tile_sources_no_self_reference
    CHECK (tile_id != source_reference_id)
);

COMMENT ON TABLE tile_sources IS 'Data input sources for tiles';
COMMENT ON COLUMN tile_sources.type IS 'Source type: url, agent_report, web_search';
COMMENT ON COLUMN tile_sources.source_reference_id IS 'For agent_report type: references the tile whose reports to use';

-- RLS for tile_sources
ALTER TABLE public.tile_sources ENABLE ROW LEVEL SECURITY;

-- Users can manage sources for tiles in mosaics they own
CREATE POLICY "Owners can manage tile sources"
  ON public.tile_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaics ON mosaics.id = tiles.mosaic_id
      WHERE tiles.id = tile_sources.tile_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Admins can manage tile sources
CREATE POLICY "Admins can manage tile sources"
  ON public.tile_sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaic_members ON mosaic_members.mosaic_id = tiles.mosaic_id
      WHERE tiles.id = tile_sources.tile_id
      AND mosaic_members.user_id = auth.uid()
      AND mosaic_members.role IN ('owner', 'admin')
    )
  );

-- Members can view tile sources
CREATE POLICY "Members can view tile sources"
  ON public.tile_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaic_members ON mosaic_members.mosaic_id = tiles.mosaic_id
      WHERE tiles.id = tile_sources.tile_id
      AND mosaic_members.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_tile_sources_tile ON public.tile_sources(tile_id);
CREATE INDEX idx_tile_sources_reference ON public.tile_sources(source_reference_id) WHERE source_reference_id IS NOT NULL;
CREATE INDEX idx_tile_sources_type ON public.tile_sources(type);

-- Updated at trigger
CREATE TRIGGER update_tile_sources_updated_at
  BEFORE UPDATE ON public.tile_sources
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- ============================================================================
-- TILE_JOBS TABLE: Execution history for tile runs
-- ============================================================================

CREATE TABLE public.tile_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb DEFAULT '{}' NOT NULL,
  execution_id uuid,
  chain_depth smallint DEFAULT 0,
  parent_job_id uuid REFERENCES public.tile_jobs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE tile_jobs IS 'Execution history for tile runs';

-- RLS for tile_jobs
ALTER TABLE public.tile_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view jobs for tiles in their mosaics
CREATE POLICY "Users can view tile jobs"
  ON public.tile_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaics ON mosaics.id = tiles.mosaic_id
      WHERE tiles.id = tile_jobs.tile_id
      AND (mosaics.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.mosaic_members
        WHERE mosaic_members.mosaic_id = mosaics.id
        AND mosaic_members.user_id = auth.uid()
      ))
    )
  );

-- Service role can insert/update jobs
CREATE POLICY "Service role can manage tile jobs"
  ON public.tile_jobs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_tile_jobs_tile ON public.tile_jobs(tile_id);
CREATE INDEX idx_tile_jobs_status ON public.tile_jobs(status);
CREATE INDEX idx_tile_jobs_execution ON public.tile_jobs(execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX idx_tile_jobs_parent ON public.tile_jobs(parent_job_id) WHERE parent_job_id IS NOT NULL;

-- ============================================================================
-- TILE_REPORTS TABLE: Analysis results from tile runs
-- ============================================================================

CREATE TABLE public.tile_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id uuid REFERENCES public.tile_jobs(id) ON DELETE CASCADE NOT NULL,
  tile_id uuid REFERENCES public.tiles(id) ON DELETE CASCADE NOT NULL,
  content jsonb NOT NULL,
  format text NOT NULL DEFAULT 'text' CHECK (format IN ('text', 'list', 'table', 'json')),
  source_urls text[] DEFAULT array[]::text[],
  created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE tile_reports IS 'Analysis results from tile runs';

-- RLS for tile_reports
ALTER TABLE public.tile_reports ENABLE ROW LEVEL SECURITY;

-- Users can view reports for tiles in their mosaics
CREATE POLICY "Users can view tile reports"
  ON public.tile_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tiles
      JOIN public.mosaics ON mosaics.id = tiles.mosaic_id
      WHERE tiles.id = tile_reports.tile_id
      AND (mosaics.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.mosaic_members
        WHERE mosaic_members.mosaic_id = mosaics.id
        AND mosaic_members.user_id = auth.uid()
      ))
    )
  );

-- Service role can insert reports
CREATE POLICY "Service role can insert tile reports"
  ON public.tile_reports FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_tile_reports_tile ON public.tile_reports(tile_id);
CREATE INDEX idx_tile_reports_job ON public.tile_reports(job_id);
CREATE INDEX idx_tile_reports_created ON public.tile_reports(created_at);

-- ============================================================================
-- DATA MIGRATION: Migrate existing agents to tiles (only if agents table exists)
-- ============================================================================

DO $$
BEGIN
  -- Only run migration if agents table exists (not a fresh database)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') THEN
    -- Create a default mosaic for each user who has agents
    INSERT INTO public.mosaics (owner_id, name, description)
    SELECT DISTINCT
      a.owner_id,
      'My First Mosaic',
      'Migrated from existing agents'
    FROM public.agents a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.mosaics m WHERE m.owner_id = a.owner_id
    );

    -- Migrate agents to tiles
    INSERT INTO public.tiles (
      id,
      mosaic_id,
      name,
      description,
      tile_type,
      color,
      pattern,
      grid_x,
      grid_y,
      system_prompt,
      output_format,
      language,
      schedule_cron,
      is_active,
      max_chain_depth,
      execution_timeout_ms,
      created_at,
      updated_at
    )
    SELECT
      a.id,
      m.id,
      a.name,
      a.description,
      'url_reader'::tile_type,  -- Default type, will update based on sources
      '#3B82F6',  -- Default blue color
      'solid'::tile_pattern,
      ROW_NUMBER() OVER (PARTITION BY a.owner_id ORDER BY a.created_at) - 1,  -- Sequential grid_x
      0,  -- All at row 0
      a.system_prompt,
      a.output_format,
      COALESCE(a.language, 'en'),
      a.schedule_cron,
      a.is_active,
      COALESCE(a.max_chain_depth, 5),
      COALESCE(a.execution_timeout_ms, 300000),
      a.created_at,
      a.updated_at
    FROM public.agents a
    JOIN public.mosaics m ON m.owner_id = a.owner_id;

    -- Update tile types based on source types
    UPDATE public.tiles t
    SET tile_type = 'recursive'::tile_type
    WHERE EXISTS (
      SELECT 1 FROM public.sources s
      WHERE s.agent_id = t.id
      AND s.type = 'agent_report'
    );

    UPDATE public.tiles t
    SET tile_type = 'web_search'::tile_type
    WHERE EXISTS (
      SELECT 1 FROM public.sources s
      WHERE s.agent_id = t.id
      AND s.type = 'web_search'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.sources s
      WHERE s.agent_id = t.id
      AND s.type = 'agent_report'
    );

    -- Migrate sources to tile_sources
    INSERT INTO public.tile_sources (
      id,
      tile_id,
      url,
      name,
      is_active,
      last_scraped_at,
      type,
      source_reference_id,
      config,
      created_at,
      updated_at
    )
    SELECT
      s.id,
      s.agent_id,  -- agent_id becomes tile_id (same UUIDs)
      s.url,
      s.name,
      s.is_active,
      s.last_scraped_at,
      s.type,
      s.source_reference_id,  -- Will reference tiles now (same UUIDs as agents)
      s.config,
      s.created_at,
      s.updated_at
    FROM public.sources s;

    -- Migrate jobs to tile_jobs
    INSERT INTO public.tile_jobs (
      id,
      tile_id,
      status,
      started_at,
      completed_at,
      error_message,
      metadata,
      execution_id,
      chain_depth,
      parent_job_id,
      created_at
    )
    SELECT
      j.id,
      j.agent_id,  -- agent_id becomes tile_id
      j.status,
      j.started_at,
      j.completed_at,
      j.error_message,
      j.metadata,
      j.execution_id,
      j.chain_depth,
      j.parent_job_id,
      j.created_at
    FROM public.jobs j;

    -- Migrate reports to tile_reports
    INSERT INTO public.tile_reports (
      id,
      job_id,
      tile_id,
      content,
      format,
      source_urls,
      created_at
    )
    SELECT
      r.id,
      r.job_id,
      r.agent_id,  -- agent_id becomes tile_id
      r.content,
      r.format,
      r.source_urls,
      r.created_at
    FROM public.reports r;

    -- Create tile connections from agent_report sources
    INSERT INTO public.tile_connections (mosaic_id, source_tile_id, target_tile_id)
    SELECT DISTINCT
      t.mosaic_id,
      ts.source_reference_id,  -- Source tile (provides output)
      ts.tile_id  -- Target tile (receives input)
    FROM public.tile_sources ts
    JOIN public.tiles t ON t.id = ts.tile_id
    WHERE ts.type = 'agent_report'
    AND ts.source_reference_id IS NOT NULL
    ON CONFLICT (source_tile_id, target_tile_id) DO NOTHING;

    -- Add comments to mark legacy tables as deprecated
    COMMENT ON TABLE public.agents IS 'DEPRECATED: Use tiles table instead. Kept for backwards compatibility.';
    COMMENT ON TABLE public.agent_members IS 'DEPRECATED: Use mosaic_members table instead. Kept for backwards compatibility.';
    COMMENT ON TABLE public.sources IS 'DEPRECATED: Use tile_sources table instead. Kept for backwards compatibility.';
    COMMENT ON TABLE public.jobs IS 'DEPRECATED: Use tile_jobs table instead. Kept for backwards compatibility.';
    COMMENT ON TABLE public.reports IS 'DEPRECATED: Use tile_reports table instead. Kept for backwards compatibility.';
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check for circular dependencies in tile connections
CREATE OR REPLACE FUNCTION check_tile_circular_dependency(
  p_source_tile_id uuid,
  p_target_tile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_cycle boolean;
BEGIN
  -- Check if adding this connection would create a cycle
  WITH RECURSIVE connection_chain AS (
    -- Start from the target tile
    SELECT source_tile_id, target_tile_id, 1 as depth
    FROM tile_connections
    WHERE source_tile_id = p_target_tile_id

    UNION ALL

    -- Follow connections
    SELECT tc.source_tile_id, tc.target_tile_id, cc.depth + 1
    FROM tile_connections tc
    JOIN connection_chain cc ON tc.source_tile_id = cc.target_tile_id
    WHERE cc.depth < 20  -- Prevent infinite loops
  )
  SELECT EXISTS (
    SELECT 1 FROM connection_chain WHERE target_tile_id = p_source_tile_id
  ) INTO v_has_cycle;

  RETURN v_has_cycle;
END;
$$;

COMMENT ON FUNCTION check_tile_circular_dependency IS 'Returns true if adding a connection from source to target would create a circular dependency';

-- ============================================================================
-- NOTE: Keep legacy tables for backwards compatibility during transition
-- They can be dropped in a future migration after full verification
-- Tables to eventually drop: agents, agent_members, sources, jobs, reports
-- ============================================================================
