-- Add Google Sheets sync columns to tiles (one-way push from catalog).
ALTER TABLE public.tiles
  ADD COLUMN IF NOT EXISTS sheets_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sheets_spreadsheet_id text,
  ADD COLUMN IF NOT EXISTS sheets_spreadsheet_url text,
  ADD COLUMN IF NOT EXISTS sheets_last_synced_at timestamptz;
