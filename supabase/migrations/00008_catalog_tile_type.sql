-- Add 'catalog' tile type
ALTER TYPE public.tile_type ADD VALUE IF NOT EXISTS 'catalog';

-- Catalog schemas: AI-detected entity schema per catalog tile
CREATE TABLE IF NOT EXISTS public.catalog_schemas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tile_id uuid NOT NULL UNIQUE REFERENCES public.tiles(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  fields jsonb NOT NULL DEFAULT '[]',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Catalog entries: persistent entities
CREATE TABLE IF NOT EXISTS public.catalog_entries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tile_id uuid NOT NULL REFERENCES public.tiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}',
  match_key text NOT NULL,
  source_job_id uuid REFERENCES public.tile_jobs(id) ON DELETE SET NULL,
  last_updated_job_id uuid REFERENCES public.tile_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_entries_tile_id ON public.catalog_entries(tile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_entries_tile_match ON public.catalog_entries(tile_id, match_key);
CREATE INDEX IF NOT EXISTS idx_catalog_entries_data_gin ON public.catalog_entries USING gin(data);

-- Catalog entry events: chronological events per entity
CREATE TABLE IF NOT EXISTS public.catalog_entry_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id uuid NOT NULL REFERENCES public.catalog_entries(id) ON DELETE CASCADE,
  tile_id uuid NOT NULL REFERENCES public.tiles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.tile_jobs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  event_date date,
  source_url text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_entry_events_entry_created ON public.catalog_entry_events(entry_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_entry_events_tile_id ON public.catalog_entry_events(tile_id);

-- Catalog diffs: change summary per execution
CREATE TABLE IF NOT EXISTS public.catalog_diffs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tile_id uuid NOT NULL REFERENCES public.tiles(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.tile_jobs(id) ON DELETE SET NULL,
  added_entries jsonb NOT NULL DEFAULT '[]',
  updated_entries jsonb NOT NULL DEFAULT '[]',
  new_events jsonb NOT NULL DEFAULT '[]',
  summary text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_diffs_tile_id ON public.catalog_diffs(tile_id, created_at DESC);

-- RLS policies (same pattern as tiles → mosaics join)
ALTER TABLE public.catalog_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_entry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_diffs ENABLE ROW LEVEL SECURITY;

-- catalog_schemas: read/write for mosaic owners and members
CREATE POLICY "catalog_schemas_select" ON public.catalog_schemas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_schemas.tile_id
        AND (m.owner_id = auth.uid() OR mm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "catalog_schemas_insert" ON public.catalog_schemas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_schemas.tile_id
        AND (m.owner_id = auth.uid() OR mm.role IN ('owner', 'admin'))
    )
  );

CREATE POLICY "catalog_schemas_update" ON public.catalog_schemas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_schemas.tile_id
        AND (m.owner_id = auth.uid() OR mm.role IN ('owner', 'admin'))
    )
  );

-- catalog_entries: read for members, write for owner/admin
CREATE POLICY "catalog_entries_select" ON public.catalog_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_entries.tile_id
        AND (m.owner_id = auth.uid() OR mm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "catalog_entries_insert" ON public.catalog_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_entries.tile_id
        AND (m.owner_id = auth.uid() OR mm.role IN ('owner', 'admin'))
    )
  );

CREATE POLICY "catalog_entries_update" ON public.catalog_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_entries.tile_id
        AND (m.owner_id = auth.uid() OR mm.role IN ('owner', 'admin'))
    )
  );

CREATE POLICY "catalog_entries_delete" ON public.catalog_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_entries.tile_id
        AND (m.owner_id = auth.uid() OR mm.role IN ('owner', 'admin'))
    )
  );

-- catalog_entry_events: read for members, write for owner/admin
CREATE POLICY "catalog_entry_events_select" ON public.catalog_entry_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_entry_events.tile_id
        AND (m.owner_id = auth.uid() OR mm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "catalog_entry_events_insert" ON public.catalog_entry_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_entry_events.tile_id
        AND (m.owner_id = auth.uid() OR mm.role IN ('owner', 'admin'))
    )
  );

-- catalog_diffs: read for members, write for owner/admin
CREATE POLICY "catalog_diffs_select" ON public.catalog_diffs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_diffs.tile_id
        AND (m.owner_id = auth.uid() OR mm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "catalog_diffs_insert" ON public.catalog_diffs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tiles t
      JOIN public.mosaics m ON m.id = t.mosaic_id
      LEFT JOIN public.mosaic_members mm ON mm.mosaic_id = m.id AND mm.user_id = auth.uid()
      WHERE t.id = catalog_diffs.tile_id
        AND (m.owner_id = auth.uid() OR mm.role IN ('owner', 'admin'))
    )
  );
