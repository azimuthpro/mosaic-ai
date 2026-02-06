-- Add tile webhooks table
CREATE TABLE tile_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id UUID NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['job.completed'],
  -- Events: 'job.started', 'job.completed', 'job.failed'
  auth_type VARCHAR(50) DEFAULT 'none',
  -- Auth types: 'none', 'bearer', 'basic', 'header'
  auth_config JSONB DEFAULT '{}',
  -- bearer: {"token": "..."}
  -- basic: {"username": "...", "password": "..."}
  -- header: {"name": "X-Custom-Header", "value": "..."}
  retry_count INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 30000,
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tile_webhooks_tile_id ON tile_webhooks(tile_id);
CREATE INDEX idx_tile_webhooks_is_active ON tile_webhooks(is_active) WHERE is_active = true;

-- Add tile webhook deliveries table
CREATE TABLE tile_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES tile_webhooks(id) ON DELETE CASCADE,
  job_id UUID REFERENCES tile_jobs(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Status: 'pending', 'success', 'failed'
  response_status INTEGER,
  response_body TEXT,
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_tile_webhook_deliveries_webhook_id ON tile_webhook_deliveries(webhook_id);
CREATE INDEX idx_tile_webhook_deliveries_job_id ON tile_webhook_deliveries(job_id);
CREATE INDEX idx_tile_webhook_deliveries_status ON tile_webhook_deliveries(status);
CREATE INDEX idx_tile_webhook_deliveries_created_at ON tile_webhook_deliveries(created_at DESC);

-- RLS policies for tile_webhooks
ALTER TABLE tile_webhooks ENABLE ROW LEVEL SECURITY;

-- Users can view webhooks for tiles in mosaics they have access to
CREATE POLICY "Users can view webhooks for accessible tiles"
  ON tile_webhooks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaic_members mm ON mm.mosaic_id = t.mosaic_id
      WHERE t.id = tile_webhooks.tile_id
      AND mm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaics m ON m.id = t.mosaic_id
      WHERE t.id = tile_webhooks.tile_id
      AND m.owner_id = auth.uid()
    )
  );

-- Only owners and admins can create webhooks
CREATE POLICY "Owners and admins can create webhooks"
  ON tile_webhooks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaic_members mm ON mm.mosaic_id = t.mosaic_id
      WHERE t.id = tile_webhooks.tile_id
      AND mm.user_id = auth.uid()
      AND mm.role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaics m ON m.id = t.mosaic_id
      WHERE t.id = tile_webhooks.tile_id
      AND m.owner_id = auth.uid()
    )
  );

-- Only owners and admins can update webhooks
CREATE POLICY "Owners and admins can update webhooks"
  ON tile_webhooks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaic_members mm ON mm.mosaic_id = t.mosaic_id
      WHERE t.id = tile_webhooks.tile_id
      AND mm.user_id = auth.uid()
      AND mm.role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaics m ON m.id = t.mosaic_id
      WHERE t.id = tile_webhooks.tile_id
      AND m.owner_id = auth.uid()
    )
  );

-- Only owners and admins can delete webhooks
CREATE POLICY "Owners and admins can delete webhooks"
  ON tile_webhooks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaic_members mm ON mm.mosaic_id = t.mosaic_id
      WHERE t.id = tile_webhooks.tile_id
      AND mm.user_id = auth.uid()
      AND mm.role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM tiles t
      JOIN mosaics m ON m.id = t.mosaic_id
      WHERE t.id = tile_webhooks.tile_id
      AND m.owner_id = auth.uid()
    )
  );

-- RLS policies for tile_webhook_deliveries
ALTER TABLE tile_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Users can view deliveries for webhooks they can access
CREATE POLICY "Users can view deliveries for accessible webhooks"
  ON tile_webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tile_webhooks tw
      JOIN tiles t ON t.id = tw.tile_id
      JOIN mosaic_members mm ON mm.mosaic_id = t.mosaic_id
      WHERE tw.id = tile_webhook_deliveries.webhook_id
      AND mm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM tile_webhooks tw
      JOIN tiles t ON t.id = tw.tile_id
      JOIN mosaics m ON m.id = t.mosaic_id
      WHERE tw.id = tile_webhook_deliveries.webhook_id
      AND m.owner_id = auth.uid()
    )
  );

-- System can insert deliveries (using service role)
-- No insert policy needed as deliveries are created by the system
