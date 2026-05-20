-- Track which user's Google account owns a tile's catalog sync. Token
-- resolution for push uses this column instead of the mosaic owner, so any
-- owner/admin of the mosaic can enable sync against their own Drive.
ALTER TABLE public.tiles
  ADD COLUMN IF NOT EXISTS sheets_owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
