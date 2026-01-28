-- Migration: Add source types for multi-source support
-- This adds support for different source types (url, agent_report) to enable agents to use other agents' reports as input

-- Create the source_type enum
CREATE TYPE source_type AS ENUM ('url', 'agent_report');

-- Add new columns to sources table
ALTER TABLE sources
  ADD COLUMN type source_type NOT NULL DEFAULT 'url',
  ADD COLUMN source_reference_id uuid REFERENCES agents(id) ON DELETE CASCADE,
  ADD COLUMN config jsonb DEFAULT '{}';

-- Make url nullable (only required for 'url' type sources)
ALTER TABLE sources ALTER COLUMN url DROP NOT NULL;

-- Add constraint: url must be present for 'url' type sources
ALTER TABLE sources ADD CONSTRAINT sources_url_required_for_url_type
  CHECK (
    (type = 'url' AND url IS NOT NULL) OR
    (type != 'url')
  );

-- Add constraint: source_reference_id must be present for 'agent_report' type sources
ALTER TABLE sources ADD CONSTRAINT sources_reference_required_for_agent_report
  CHECK (
    (type = 'agent_report' AND source_reference_id IS NOT NULL) OR
    (type != 'agent_report')
  );

-- Add constraint: prevent self-referencing (agent cannot use itself as a source)
ALTER TABLE sources ADD CONSTRAINT sources_no_self_reference
  CHECK (agent_id != source_reference_id);

-- Create index for faster lookups of agent_report sources
CREATE INDEX idx_sources_source_reference_id ON sources(source_reference_id) WHERE source_reference_id IS NOT NULL;

-- Create index for type filtering
CREATE INDEX idx_sources_type ON sources(type);

-- Update RLS policies for sources to include referenced agent ownership check
-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view their own sources" ON sources;
DROP POLICY IF EXISTS "Users can insert sources for their agents" ON sources;
DROP POLICY IF EXISTS "Users can update their own sources" ON sources;
DROP POLICY IF EXISTS "Users can delete their own sources" ON sources;

-- Recreate policies with updated logic
CREATE POLICY "Users can view their own sources"
  ON sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agents WHERE agents.id = sources.agent_id AND agents.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sources for their agents"
  ON sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents WHERE agents.id = sources.agent_id AND agents.owner_id = auth.uid()
    )
    AND (
      -- For agent_report type, must also own the referenced agent
      sources.type != 'agent_report'
      OR EXISTS (
        SELECT 1 FROM agents WHERE agents.id = sources.source_reference_id AND agents.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own sources"
  ON sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM agents WHERE agents.id = sources.agent_id AND agents.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agents WHERE agents.id = sources.agent_id AND agents.owner_id = auth.uid()
    )
    AND (
      -- For agent_report type, must also own the referenced agent
      sources.type != 'agent_report'
      OR EXISTS (
        SELECT 1 FROM agents WHERE agents.id = sources.source_reference_id AND agents.owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own sources"
  ON sources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM agents WHERE agents.id = sources.agent_id AND agents.owner_id = auth.uid()
    )
  );

-- Backfill: All existing sources are 'url' type (already handled by default value)
-- No explicit backfill needed since default is 'url' and existing sources have valid URLs

COMMENT ON COLUMN sources.type IS 'The type of source: url (web scraping) or agent_report (use another agent''s output)';
COMMENT ON COLUMN sources.source_reference_id IS 'For agent_report type: references the agent whose reports to use as input';
COMMENT ON COLUMN sources.config IS 'Type-specific configuration (e.g., report filters, date ranges)';
