-- Multi-Slack-Workspace Support
-- Allow users to connect multiple Slack workspaces by adding provider_team_id
-- to the unique constraint on user_integrations.

-- Add provider_team_id column
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS provider_team_id text NOT NULL DEFAULT '';

-- Backfill from metadata for existing Slack rows
UPDATE public.user_integrations
  SET provider_team_id = metadata->>'team_id'
  WHERE provider = 'slack' AND metadata->>'team_id' IS NOT NULL;

-- Swap unique constraint: (user_id, provider) -> (user_id, provider, provider_team_id)
ALTER TABLE public.user_integrations
  DROP CONSTRAINT IF EXISTS user_integrations_user_id_provider_key;
ALTER TABLE public.user_integrations
  ADD CONSTRAINT user_integrations_user_id_provider_team_key
  UNIQUE(user_id, provider, provider_team_id);

-- Add team_id column for slack output on tiles
ALTER TABLE public.tiles
  ADD COLUMN IF NOT EXISTS slack_output_team_id text DEFAULT NULL;

-- Backfill slack_output_team_id for existing tiles that have slack output enabled
UPDATE public.tiles t
  SET slack_output_team_id = (
    SELECT ui.provider_team_id FROM public.user_integrations ui
    JOIN public.mosaics m ON m.owner_id = ui.user_id
    WHERE m.id = t.mosaic_id AND ui.provider = 'slack' LIMIT 1
  )
  WHERE t.slack_output_enabled = true AND t.slack_output_team_id IS NULL;
