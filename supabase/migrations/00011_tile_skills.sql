-- Migration: Tile Skills Library
-- This migration introduces tile-type-specific skills:
-- - System default skills (read-only) available to all users
-- - Mosaic-specific custom skills for personalization
-- - Skills organized by tile type and category

-- ============================================================================
-- TILE SKILL CATEGORY TYPE
-- ============================================================================

CREATE TYPE tile_skill_category AS ENUM (
  'news',
  'market',
  'research',
  'social',
  'deep-search',
  'analysis',
  'custom'
);

COMMENT ON TYPE tile_skill_category IS 'Categories for organizing tile skills';

-- ============================================================================
-- TILE_SKILLS TABLE
-- ============================================================================

CREATE TABLE public.tile_skills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mosaic_id uuid REFERENCES public.mosaics(id) ON DELETE CASCADE,  -- NULL for system defaults
  tile_type tile_type NOT NULL,
  name varchar(255) NOT NULL,
  description text,
  prompt text NOT NULL,
  category tile_skill_category DEFAULT 'custom' NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_system boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Constraints
  CONSTRAINT tile_skills_system_has_no_mosaic
    CHECK ((is_system = true AND mosaic_id IS NULL) OR (is_system = false)),
  CONSTRAINT tile_skills_custom_has_mosaic
    CHECK ((is_system = false AND mosaic_id IS NOT NULL) OR (is_system = true))
);

COMMENT ON TABLE tile_skills IS 'Skill templates for tiles - system defaults and mosaic-specific custom skills';
COMMENT ON COLUMN tile_skills.mosaic_id IS 'NULL for system defaults, mosaic ID for custom skills';
COMMENT ON COLUMN tile_skills.tile_type IS 'The tile type this skill is designed for';
COMMENT ON COLUMN tile_skills.category IS 'Category for organizing skills in the UI';
COMMENT ON COLUMN tile_skills.is_system IS 'True for read-only system defaults, false for custom skills';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.tile_skills ENABLE ROW LEVEL SECURITY;

-- Everyone can view system skills
CREATE POLICY "Anyone can view system skills"
  ON public.tile_skills FOR SELECT
  USING (is_system = true);

-- Users can view skills in mosaics they own
CREATE POLICY "Owners can view mosaic skills"
  ON public.tile_skills FOR SELECT
  USING (
    mosaic_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.mosaics
      WHERE mosaics.id = tile_skills.mosaic_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Members can view skills in shared mosaics
CREATE POLICY "Members can view mosaic skills"
  ON public.tile_skills FOR SELECT
  USING (
    mosaic_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.mosaic_members
      WHERE mosaic_members.mosaic_id = tile_skills.mosaic_id
      AND mosaic_members.user_id = auth.uid()
    )
  );

-- Owners can manage skills in their mosaics
CREATE POLICY "Owners can manage mosaic skills"
  ON public.tile_skills FOR ALL
  USING (
    is_system = false AND
    mosaic_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.mosaics
      WHERE mosaics.id = tile_skills.mosaic_id
      AND mosaics.owner_id = auth.uid()
    )
  );

-- Admins can manage skills in shared mosaics
CREATE POLICY "Admins can manage mosaic skills"
  ON public.tile_skills FOR ALL
  USING (
    is_system = false AND
    mosaic_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.mosaic_members
      WHERE mosaic_members.mosaic_id = tile_skills.mosaic_id
      AND mosaic_members.user_id = auth.uid()
      AND mosaic_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_tile_skills_mosaic ON public.tile_skills(mosaic_id) WHERE mosaic_id IS NOT NULL;
CREATE INDEX idx_tile_skills_tile_type ON public.tile_skills(tile_type);
CREATE INDEX idx_tile_skills_system ON public.tile_skills(is_system) WHERE is_system = true;
CREATE INDEX idx_tile_skills_category ON public.tile_skills(category);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE TRIGGER update_tile_skills_updated_at
  BEFORE UPDATE ON public.tile_skills
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- ============================================================================
-- SEED SYSTEM DEFAULT SKILLS
-- ============================================================================

-- URL Reader Skills
INSERT INTO public.tile_skills (tile_type, name, description, prompt, category, is_system) VALUES
(
  'url_reader',
  'News Monitor',
  'Extract and summarize news articles with key facts and developments',
  'You are a news analyst. Extract and summarize the key information from this content:

1. **Headline Summary**: What is the main story in 1-2 sentences?
2. **Key Facts**: List the most important facts (who, what, when, where)
3. **Impact**: What are the implications or consequences?
4. **Related Context**: Any relevant background information mentioned

Format your response clearly with headers. Focus on facts, avoid speculation.',
  'news',
  true
),
(
  'url_reader',
  'Price Tracker',
  'Monitor and extract pricing information from product pages',
  'You are a price monitoring assistant. Extract pricing information from this content:

1. **Product/Service Name**: What is being priced?
2. **Current Price**: The main price (include currency)
3. **Price Variations**: Any tiers, discounts, or alternative pricing
4. **Comparison**: Any competitor pricing mentioned
5. **Price Changes**: Any historical pricing or changes mentioned

If pricing is not found, clearly state that. Be precise with numbers.',
  'market',
  true
),
(
  'url_reader',
  'Article Summarizer',
  'Create concise summaries of long-form articles and blog posts',
  'You are a content summarizer. Create a comprehensive summary of this article:

1. **TL;DR**: One paragraph capturing the essence (3-4 sentences max)
2. **Main Points**: Bullet list of key arguments or information
3. **Supporting Details**: Important evidence or examples
4. **Conclusion**: What is the author''s final takeaway?

Keep the summary under 300 words. Preserve the author''s main message.',
  'research',
  true
),
(
  'url_reader',
  'Data Extractor',
  'Extract structured data like tables, lists, and statistics',
  'You are a data extraction specialist. Extract structured information from this content:

1. **Tables**: Recreate any tabular data in markdown format
2. **Lists**: Extract numbered or bulleted information
3. **Statistics**: Pull out any numbers, percentages, or metrics
4. **Dates/Timelines**: Note any temporal information
5. **Entities**: Identify companies, people, locations mentioned

Present data in a clean, structured format. Use markdown tables where appropriate.',
  'research',
  true
),
(
  'url_reader',
  'Social Media Monitor',
  'Track social media posts, engagement, and sentiment',
  'You are a social media analyst. Analyze this social content:

1. **Post Summary**: What is the main message?
2. **Engagement**: Note any visible metrics (likes, shares, comments)
3. **Sentiment**: Is the tone positive, negative, or neutral?
4. **Key Mentions**: Tag any @mentions, #hashtags, or links
5. **Trends**: Any trending topics or viral elements?

Keep analysis objective and fact-based.',
  'social',
  true
);

-- Web Search Skills
INSERT INTO public.tile_skills (tile_type, name, description, prompt, category, is_system) VALUES
(
  'web_search',
  'Market Research',
  'Comprehensive market analysis from search results',
  'You are a market research analyst. Synthesize the search results into a market analysis:

1. **Market Overview**: Current state of the market/industry
2. **Key Players**: Major companies or products mentioned
3. **Trends**: Emerging patterns or developments
4. **Opportunities**: Potential growth areas identified
5. **Challenges**: Risks or obstacles mentioned

Cite sources where possible. Focus on actionable insights.',
  'market',
  true
),
(
  'web_search',
  'Competitor Analysis',
  'Analyze competitor information from search results',
  'You are a competitive intelligence analyst. Analyze competitors from these results:

1. **Competitor Overview**: Who are the main competitors?
2. **Strengths**: What are they doing well?
3. **Weaknesses**: Any vulnerabilities or gaps?
4. **Recent Activity**: Latest news, launches, or changes
5. **Market Position**: How do they rank in the market?

Be objective and evidence-based. Note information gaps.',
  'market',
  true
),
(
  'web_search',
  'Trend Research',
  'Identify and analyze emerging trends from search data',
  'You are a trend analyst. Identify trends from these search results:

1. **Emerging Trends**: What new patterns are appearing?
2. **Growth Indicators**: Evidence of increasing interest/adoption
3. **Early Signals**: Weak signals that might become important
4. **Industry Impact**: How might these trends affect the sector?
5. **Timeline**: When might these trends peak or mature?

Distinguish between hype and substance. Cite sources.',
  'deep-search',
  true
),
(
  'web_search',
  'Company Intel',
  'Gather intelligence about specific companies',
  'You are a business intelligence researcher. Compile company information:

1. **Company Profile**: Basic info (founded, location, size)
2. **Products/Services**: What they offer
3. **Recent News**: Latest announcements or coverage
4. **Leadership**: Key executives mentioned
5. **Financial Info**: Any revenue, funding, or valuation data
6. **Reputation**: Sentiment from reviews or press

Organize clearly. Flag any conflicting information.',
  'research',
  true
),
(
  'web_search',
  'Topic Deep Dive',
  'In-depth research synthesis on any topic',
  'You are a research synthesizer. Create a comprehensive overview:

1. **Executive Summary**: Key findings in 2-3 sentences
2. **Background**: Essential context for understanding
3. **Current State**: What we know now
4. **Different Perspectives**: Various viewpoints or debates
5. **Knowledge Gaps**: What remains unknown or disputed
6. **Further Reading**: Key sources for deeper investigation

Balance depth with clarity. Cite sources throughout.',
  'deep-search',
  true
);

-- Recursive (Pipeline) Skills
INSERT INTO public.tile_skills (tile_type, name, description, prompt, category, is_system) VALUES
(
  'recursive',
  'Data Synthesizer',
  'Combine and synthesize data from multiple tile outputs',
  'You are a data synthesizer. Combine the input from connected tiles:

1. **Common Themes**: What patterns appear across sources?
2. **Key Insights**: Most important findings from all inputs
3. **Contradictions**: Any conflicting information?
4. **Synthesis**: Combined narrative from all sources
5. **Confidence Level**: How reliable is the combined picture?

Create a unified analysis that is more valuable than the parts.',
  'analysis',
  true
),
(
  'recursive',
  'Report Combiner',
  'Merge multiple reports into a single comprehensive document',
  'You are a report editor. Combine these inputs into one cohesive report:

1. **Unified Summary**: Single overview covering all inputs
2. **Merged Sections**: Combine similar topics from different sources
3. **Reconciled Data**: Align any conflicting numbers or facts
4. **Timeline**: Order events chronologically if applicable
5. **Comprehensive Conclusion**: Overall takeaways

Eliminate redundancy while preserving all unique insights.',
  'analysis',
  true
),
(
  'recursive',
  'Cross-Reference Analyzer',
  'Find connections and validate information across sources',
  'You are a cross-reference analyst. Validate and connect information:

1. **Verified Facts**: Information confirmed by multiple sources
2. **Single-Source Claims**: Facts from only one input
3. **Discrepancies**: Conflicting information across sources
4. **New Connections**: Relationships discovered by combining data
5. **Reliability Score**: Overall confidence in the combined data

Flag uncertainty clearly. Prioritize verified information.',
  'analysis',
  true
),
(
  'recursive',
  'Multi-Source Briefing',
  'Create executive briefings from multiple intelligence sources',
  'You are an intelligence briefer. Create an executive summary:

1. **Bottom Line Up Front**: Most critical finding in 1-2 sentences
2. **Key Developments**: Major items requiring attention
3. **Source Summary**: Brief note on each input source
4. **Risk Assessment**: Any threats or concerns identified
5. **Recommended Actions**: Suggested next steps

Keep it concise and actionable. Prioritize by importance.',
  'analysis',
  true
);

-- Analyzer Skills
INSERT INTO public.tile_skills (tile_type, name, description, prompt, category, is_system) VALUES
(
  'analyzer',
  'Sentiment Analyzer',
  'Analyze sentiment and emotional tone across data',
  'You are a sentiment analyst. Analyze the emotional content:

1. **Overall Sentiment**: Positive, negative, or neutral (with score 1-10)
2. **Sentiment Breakdown**: Distribution across the content
3. **Key Phrases**: Quotes that indicate sentiment
4. **Sentiment Shifts**: Changes in tone throughout
5. **Implications**: What the sentiment suggests

Be objective. Support conclusions with evidence from the text.',
  'analysis',
  true
),
(
  'analyzer',
  'Trend Detector',
  'Identify patterns and trends in connected data',
  'You are a trend detection system. Analyze for patterns:

1. **Identified Trends**: Clear patterns in the data
2. **Trend Direction**: Increasing, decreasing, or stable
3. **Trend Strength**: How pronounced is the pattern?
4. **Anomalies**: Outliers or unexpected data points
5. **Predictions**: Where might these trends lead?

Use specific data points to support trend identification.',
  'analysis',
  true
),
(
  'analyzer',
  'Summary Generator',
  'Create executive summaries from complex data',
  'You are an executive summary writer. Distill the key points:

1. **One-Line Summary**: The single most important takeaway
2. **Three Key Points**: Essential information in bullets
3. **Supporting Data**: Key metrics or facts
4. **Context**: Why this matters
5. **Next Steps**: Recommended actions if applicable

Maximum 200 words. Prioritize clarity over completeness.',
  'analysis',
  true
),
(
  'analyzer',
  'Pattern Finder',
  'Discover hidden patterns and correlations in data',
  'You are a pattern recognition specialist. Find hidden patterns:

1. **Obvious Patterns**: Clear, surface-level patterns
2. **Hidden Correlations**: Less obvious relationships
3. **Temporal Patterns**: Time-based patterns
4. **Frequency Analysis**: What appears most/least often?
5. **Pattern Significance**: Why do these patterns matter?

Distinguish between correlation and causation. Note confidence levels.',
  'analysis',
  true
),
(
  'analyzer',
  'Comparative Analysis',
  'Compare and contrast data from multiple sources',
  'You are a comparative analyst. Compare the input data:

1. **Similarities**: What do the sources have in common?
2. **Differences**: Where do they diverge?
3. **Rankings**: How do items compare on key metrics?
4. **Best/Worst**: Standout performers in either direction
5. **Recommendations**: Based on comparison, what is best?

Use tables for clear comparisons. Be specific with criteria.',
  'analysis',
  true
);
