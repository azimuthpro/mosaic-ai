-- Create the mosaic_api_keys table for API authentication
CREATE TABLE IF NOT EXISTS public.mosaic_api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  key_hash varchar(64) NOT NULL,  -- SHA-256 hash of the API key
  key_prefix varchar(12) NOT NULL,  -- First chars for identification (e.g., "msk_abc12345")
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for faster lookups by key_hash
CREATE INDEX IF NOT EXISTS idx_mosaic_api_keys_key_hash ON public.mosaic_api_keys(key_hash);

-- Create index for mosaic_id lookups
CREATE INDEX IF NOT EXISTS idx_mosaic_api_keys_mosaic_id ON public.mosaic_api_keys(mosaic_id);

-- Create index for active keys
CREATE INDEX IF NOT EXISTS idx_mosaic_api_keys_active ON public.mosaic_api_keys(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.mosaic_api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view API keys for mosaics they own or are admin members of
CREATE POLICY "Users can view their mosaic API keys" ON public.mosaic_api_keys
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaics m
      WHERE m.id = mosaic_api_keys.mosaic_id
      AND m.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.mosaic_members mm
      WHERE mm.mosaic_id = mosaic_api_keys.mosaic_id
      AND mm.user_id = auth.uid()
      AND mm.role IN ('owner', 'admin')
    )
  );

-- Policy: Users can create API keys for mosaics they own or are admin members of
CREATE POLICY "Users can create mosaic API keys" ON public.mosaic_api_keys
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mosaics m
      WHERE m.id = mosaic_api_keys.mosaic_id
      AND m.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.mosaic_members mm
      WHERE mm.mosaic_id = mosaic_api_keys.mosaic_id
      AND mm.user_id = auth.uid()
      AND mm.role IN ('owner', 'admin')
    )
  );

-- Policy: Users can update API keys for mosaics they own or are admin members of
CREATE POLICY "Users can update their mosaic API keys" ON public.mosaic_api_keys
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaics m
      WHERE m.id = mosaic_api_keys.mosaic_id
      AND m.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.mosaic_members mm
      WHERE mm.mosaic_id = mosaic_api_keys.mosaic_id
      AND mm.user_id = auth.uid()
      AND mm.role IN ('owner', 'admin')
    )
  );

-- Policy: Users can delete API keys for mosaics they own or are admin members of
CREATE POLICY "Users can delete their mosaic API keys" ON public.mosaic_api_keys
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.mosaics m
      WHERE m.id = mosaic_api_keys.mosaic_id
      AND m.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.mosaic_members mm
      WHERE mm.mosaic_id = mosaic_api_keys.mosaic_id
      AND mm.user_id = auth.uid()
      AND mm.role IN ('owner', 'admin')
    )
  );

-- Add comment for documentation
COMMENT ON TABLE public.mosaic_api_keys IS 'API keys for authenticating programmatic access to mosaic tiles';
COMMENT ON COLUMN public.mosaic_api_keys.key_hash IS 'SHA-256 hash of the full API key';
COMMENT ON COLUMN public.mosaic_api_keys.key_prefix IS 'First characters of the key for identification (e.g., msk_abc12345)';
