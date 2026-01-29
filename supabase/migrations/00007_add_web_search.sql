-- Migration: Add web_search source type
-- This adds support for web search sources using Tavily API

-- Add 'web_search' to the source_type enum
ALTER TYPE source_type ADD VALUE 'web_search';

-- Update constraint to handle web_search type (requires query in config)
-- Note: The config column already exists from migration 00006

COMMENT ON TYPE source_type IS 'Types of sources: url (web scraping), agent_report (use another agent''s output), web_search (AI-powered web search)';
