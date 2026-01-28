-- Add language column to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';

-- Add check constraint for allowed languages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agents_language_check'
  ) THEN
    ALTER TABLE agents ADD CONSTRAINT agents_language_check
      CHECK (language IN ('en', 'pl', 'es', 'it', 'de'));
  END IF;
END $$;

-- Create skills table for custom user skills
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add check constraint for skill categories
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'skills_category_check'
  ) THEN
    ALTER TABLE skills ADD CONSTRAINT skills_category_check
      CHECK (category IN ('news', 'market', 'research', 'social', 'deep-search', 'custom'));
  END IF;
END $$;

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS skills_user_id_idx ON skills(user_id);

-- Create index on is_public for community skills queries
CREATE INDEX IF NOT EXISTS skills_is_public_idx ON skills(is_public) WHERE is_public = true;

-- Enable RLS on skills table
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own skills
CREATE POLICY "Users can view own skills"
  ON skills FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Users can view public skills from others
CREATE POLICY "Users can view public skills"
  ON skills FOR SELECT
  USING (is_public = true);

-- Policy: Users can insert their own skills
CREATE POLICY "Users can create own skills"
  ON skills FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own skills
CREATE POLICY "Users can update own skills"
  ON skills FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own skills
CREATE POLICY "Users can delete own skills"
  ON skills FOR DELETE
  USING (user_id = auth.uid());

-- Trigger for updated_at on skills
CREATE OR REPLACE FUNCTION update_skills_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skills_updated_at ON skills;
CREATE TRIGGER skills_updated_at
  BEFORE UPDATE ON skills
  FOR EACH ROW
  EXECUTE FUNCTION update_skills_updated_at();
