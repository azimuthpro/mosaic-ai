-- =============================================================================
-- SLACK INTEGRATION
-- Adds user_integrations table, slack_channel source type, and tile output columns
-- =============================================================================

-- Add slack_channel to source_type enum
ALTER TYPE public.source_type ADD VALUE IF NOT EXISTS 'slack_channel';

-- User integrations table (OAuth tokens for Slack etc.)
CREATE TABLE public.user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider varchar(50) NOT NULL,
  access_token text NOT NULL,
  metadata jsonb DEFAULT '{}' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, provider)
);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own integrations"
  ON public.user_integrations FOR ALL USING (user_id = auth.uid());

-- Add Slack output columns to tiles
ALTER TABLE public.tiles
  ADD COLUMN IF NOT EXISTS slack_output_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_output_channel_id text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS slack_output_channel_name text DEFAULT NULL;
