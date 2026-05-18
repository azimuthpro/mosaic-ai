import type { TileSkillCategory, TileType } from "@/types/database";

export interface DefaultTileSkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: TileSkillCategory;
  tileType: TileType;
}

export const TILE_SKILL_CATEGORIES: {
  value: TileSkillCategory;
  label: string;
}[] = [
  { value: "news", label: "News & Media" },
  { value: "market", label: "Market & Pricing" },
  { value: "research", label: "Research & Analysis" },
  { value: "social", label: "Social & Brand" },
  { value: "deep-search", label: "Deep Search" },
  { value: "analysis", label: "Analysis" },
  { value: "custom", label: "Custom" },
];

// URL Reader Skills
const URL_READER_SKILLS: DefaultTileSkill[] = [
  {
    id: "url-news-monitor",
    name: "News Monitor",
    description:
      "Extract and summarize news articles with key facts and developments",
    category: "news",
    tileType: "url_reader",
    prompt: `You are a news analyst. Extract and summarize the key information from this content:

1. **Headline Summary**: What is the main story in 1-2 sentences?
2. **Key Facts**: List the most important facts (who, what, when, where)
3. **Impact**: What are the implications or consequences?
4. **Related Context**: Any relevant background information mentioned

Format your response clearly with headers. Focus on facts, avoid speculation.`,
  },
  {
    id: "url-price-tracker",
    name: "Price Tracker",
    description: "Monitor and extract pricing information from product pages",
    category: "market",
    tileType: "url_reader",
    prompt: `You are a price monitoring assistant. Extract pricing information from this content:

1. **Product/Service Name**: What is being priced?
2. **Current Price**: The main price (include currency)
3. **Price Variations**: Any tiers, discounts, or alternative pricing
4. **Comparison**: Any competitor pricing mentioned
5. **Price Changes**: Any historical pricing or changes mentioned

If pricing is not found, clearly state that. Be precise with numbers.`,
  },
  {
    id: "url-article-summarizer",
    name: "Article Summarizer",
    description:
      "Create concise summaries of long-form articles and blog posts",
    category: "research",
    tileType: "url_reader",
    prompt: `You are a content summarizer. Create a comprehensive summary of this article:

1. **TL;DR**: One paragraph capturing the essence (3-4 sentences max)
2. **Main Points**: Bullet list of key arguments or information
3. **Supporting Details**: Important evidence or examples
4. **Conclusion**: What is the author's final takeaway?

Keep the summary under 300 words. Preserve the author's main message.`,
  },
  {
    id: "url-data-extractor",
    name: "Data Extractor",
    description: "Extract structured data like tables, lists, and statistics",
    category: "research",
    tileType: "url_reader",
    prompt: `You are a data extraction specialist. Extract structured information from this content:

1. **Tables**: Recreate any tabular data in markdown format
2. **Lists**: Extract numbered or bulleted information
3. **Statistics**: Pull out any numbers, percentages, or metrics
4. **Dates/Timelines**: Note any temporal information
5. **Entities**: Identify companies, people, locations mentioned

Present data in a clean, structured format. Use markdown tables where appropriate.`,
  },
  {
    id: "url-social-monitor",
    name: "Social Media Monitor",
    description: "Track social media posts, engagement, and sentiment",
    category: "social",
    tileType: "url_reader",
    prompt: `You are a social media analyst. Analyze this social content:

1. **Post Summary**: What is the main message?
2. **Engagement**: Note any visible metrics (likes, shares, comments)
3. **Sentiment**: Is the tone positive, negative, or neutral?
4. **Key Mentions**: Tag any @mentions, #hashtags, or links
5. **Trends**: Any trending topics or viral elements?

Keep analysis objective and fact-based.`,
  },
];

// Web Search Skills
const WEB_SEARCH_SKILLS: DefaultTileSkill[] = [
  {
    id: "search-market-research",
    name: "Market Research",
    description: "Comprehensive market analysis from search results",
    category: "market",
    tileType: "web_search",
    prompt: `You are a market research analyst. Synthesize the search results into a market analysis:

1. **Market Overview**: Current state of the market/industry
2. **Key Players**: Major companies or products mentioned
3. **Trends**: Emerging patterns or developments
4. **Opportunities**: Potential growth areas identified
5. **Challenges**: Risks or obstacles mentioned

Cite sources where possible. Focus on actionable insights.`,
  },
  {
    id: "search-competitor-analysis",
    name: "Competitor Analysis",
    description: "Analyze competitor information from search results",
    category: "market",
    tileType: "web_search",
    prompt: `You are a competitive intelligence analyst. Analyze competitors from these results:

1. **Competitor Overview**: Who are the main competitors?
2. **Strengths**: What are they doing well?
3. **Weaknesses**: Any vulnerabilities or gaps?
4. **Recent Activity**: Latest news, launches, or changes
5. **Market Position**: How do they rank in the market?

Be objective and evidence-based. Note information gaps.`,
  },
  {
    id: "search-trend-research",
    name: "Trend Research",
    description: "Identify and analyze emerging trends from search data",
    category: "deep-search",
    tileType: "web_search",
    prompt: `You are a trend analyst. Identify trends from these search results:

1. **Emerging Trends**: What new patterns are appearing?
2. **Growth Indicators**: Evidence of increasing interest/adoption
3. **Early Signals**: Weak signals that might become important
4. **Industry Impact**: How might these trends affect the sector?
5. **Timeline**: When might these trends peak or mature?

Distinguish between hype and substance. Cite sources.`,
  },
  {
    id: "search-company-intel",
    name: "Company Intel",
    description: "Gather intelligence about specific companies",
    category: "research",
    tileType: "web_search",
    prompt: `You are a business intelligence researcher. Compile company information:

1. **Company Profile**: Basic info (founded, location, size)
2. **Products/Services**: What they offer
3. **Recent News**: Latest announcements or coverage
4. **Leadership**: Key executives mentioned
5. **Financial Info**: Any revenue, funding, or valuation data
6. **Reputation**: Sentiment from reviews or press

Organize clearly. Flag any conflicting information.`,
  },
  {
    id: "search-topic-deep-dive",
    name: "Topic Deep Dive",
    description: "In-depth research synthesis on any topic",
    category: "deep-search",
    tileType: "web_search",
    prompt: `You are a research synthesizer. Create a comprehensive overview:

1. **Executive Summary**: Key findings in 2-3 sentences
2. **Background**: Essential context for understanding
3. **Current State**: What we know now
4. **Different Perspectives**: Various viewpoints or debates
5. **Knowledge Gaps**: What remains unknown or disputed
6. **Further Reading**: Key sources for deeper investigation

Balance depth with clarity. Cite sources throughout.`,
  },
];

// Analyzer Skills
const ANALYZER_SKILLS: DefaultTileSkill[] = [
  {
    id: "analyzer-data-synthesizer",
    name: "Data Synthesizer",
    description: "Combine and synthesize data from multiple tile outputs",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are a data synthesizer. Combine the input from connected tiles:

1. **Common Themes**: What patterns appear across sources?
2. **Key Insights**: Most important findings from all inputs
3. **Contradictions**: Any conflicting information?
4. **Synthesis**: Combined narrative from all sources
5. **Confidence Level**: How reliable is the combined picture?

Create a unified analysis that is more valuable than the parts.`,
  },
  {
    id: "analyzer-report-combiner",
    name: "Report Combiner",
    description: "Merge multiple reports into a single comprehensive document",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are a report editor. Combine these inputs into one cohesive report:

1. **Unified Summary**: Single overview covering all inputs
2. **Merged Sections**: Combine similar topics from different sources
3. **Reconciled Data**: Align any conflicting numbers or facts
4. **Timeline**: Order events chronologically if applicable
5. **Comprehensive Conclusion**: Overall takeaways

Eliminate redundancy while preserving all unique insights.`,
  },
  {
    id: "analyzer-cross-reference",
    name: "Cross-Reference Analyzer",
    description: "Find connections and validate information across sources",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are a cross-reference analyst. Validate and connect information:

1. **Verified Facts**: Information confirmed by multiple sources
2. **Single-Source Claims**: Facts from only one input
3. **Discrepancies**: Conflicting information across sources
4. **New Connections**: Relationships discovered by combining data
5. **Reliability Score**: Overall confidence in the combined data

Flag uncertainty clearly. Prioritize verified information.`,
  },
  {
    id: "analyzer-multi-source-briefing",
    name: "Multi-Source Briefing",
    description:
      "Create executive briefings from multiple intelligence sources",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are an intelligence briefer. Create an executive summary:

1. **Bottom Line Up Front**: Most critical finding in 1-2 sentences
2. **Key Developments**: Major items requiring attention
3. **Source Summary**: Brief note on each input source
4. **Risk Assessment**: Any threats or concerns identified
5. **Recommended Actions**: Suggested next steps

Keep it concise and actionable. Prioritize by importance.`,
  },
  {
    id: "analyzer-sentiment",
    name: "Sentiment Analyzer",
    description: "Analyze sentiment and emotional tone across data",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are a sentiment analyst. Analyze the emotional content:

1. **Overall Sentiment**: Positive, negative, or neutral (with score 1-10)
2. **Sentiment Breakdown**: Distribution across the content
3. **Key Phrases**: Quotes that indicate sentiment
4. **Sentiment Shifts**: Changes in tone throughout
5. **Implications**: What the sentiment suggests

Be objective. Support conclusions with evidence from the text.`,
  },
  {
    id: "analyzer-trend-detector",
    name: "Trend Detector",
    description: "Identify patterns and trends in connected data",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are a trend detection system. Analyze for patterns:

1. **Identified Trends**: Clear patterns in the data
2. **Trend Direction**: Increasing, decreasing, or stable
3. **Trend Strength**: How pronounced is the pattern?
4. **Anomalies**: Outliers or unexpected data points
5. **Predictions**: Where might these trends lead?

Use specific data points to support trend identification.`,
  },
  {
    id: "analyzer-summary-generator",
    name: "Summary Generator",
    description: "Create executive summaries from complex data",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are an executive summary writer. Distill the key points:

1. **One-Line Summary**: The single most important takeaway
2. **Three Key Points**: Essential information in bullets
3. **Supporting Data**: Key metrics or facts
4. **Context**: Why this matters
5. **Next Steps**: Recommended actions if applicable

Maximum 200 words. Prioritize clarity over completeness.`,
  },
  {
    id: "analyzer-pattern-finder",
    name: "Pattern Finder",
    description: "Discover hidden patterns and correlations in data",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are a pattern recognition specialist. Find hidden patterns:

1. **Obvious Patterns**: Clear, surface-level patterns
2. **Hidden Correlations**: Less obvious relationships
3. **Temporal Patterns**: Time-based patterns
4. **Frequency Analysis**: What appears most/least often?
5. **Pattern Significance**: Why do these patterns matter?

Distinguish between correlation and causation. Note confidence levels.`,
  },
  {
    id: "analyzer-comparative",
    name: "Comparative Analysis",
    description: "Compare and contrast data from multiple sources",
    category: "analysis",
    tileType: "analyzer",
    prompt: `You are a comparative analyst. Compare the input data:

1. **Similarities**: What do the sources have in common?
2. **Differences**: Where do they diverge?
3. **Rankings**: How do items compare on key metrics?
4. **Best/Worst**: Standout performers in either direction
5. **Recommendations**: Based on comparison, what is best?

Use tables for clear comparisons. Be specific with criteria.`,
  },
];

// Catalog Skills
const CATALOG_SKILLS: DefaultTileSkill[] = [
  {
    id: "catalog-entity-tracker",
    name: "Entity Catalog",
    description:
      "Build a catalog of organizations with key people, events, and relationships",
    category: "research",
    tileType: "catalog",
    prompt: `Extract organizations and companies as primary entities. For each entity, capture:

1. **Key People**: Founders, executives, spokespersons, and other notable individuals associated with the entity
2. **Events**: Funding rounds, acquisitions, product launches, partnerships, expansions, leadership changes, and other significant developments
3. **Relationships**: Connections between entities — partnerships, investments, competitive dynamics, supply chain links

Link people to the entities they belong to and the events they are mentioned in. Emphasize the relationships between entities and persons to build a connected intelligence map.`,
  },
];

// GitHub Issue Skills
const GITHUB_ISSUE_SKILLS: DefaultTileSkill[] = [
  {
    id: "github-issue-blog-post",
    name: "Blog Post Issue",
    description: "Create an issue to write a blog post based on input data",
    category: "custom",
    tileType: "github_issue",
    prompt: `Based on the provided content, create a GitHub issue for writing a blog post.

Return JSON with:
- **title**: "Blog: [descriptive title]"
- **body**: Markdown with sections: Topic Overview, Key Points to Cover, Target Audience, Suggested Outline, Reference Material
- **labels**: ["blog", "content"]

Make the issue actionable for a content writer.`,
  },
  {
    id: "github-issue-bugfix",
    name: "Bugfix Issue",
    description: "Create a bug report issue from analysis findings",
    category: "custom",
    tileType: "github_issue",
    prompt: `Based on the provided content, create a GitHub bug report issue.

Return JSON with:
- **title**: "Bug: [clear description of the bug]"
- **body**: Markdown with sections: Description, Steps to Reproduce, Expected Behavior, Actual Behavior, Possible Root Cause, Suggested Fix
- **labels**: ["bug"]

Be specific and technical. Include code references if available in the input.`,
  },
  {
    id: "github-issue-feature",
    name: "Feature Request Issue",
    description: "Create a feature request issue from ideas or analysis",
    category: "custom",
    tileType: "github_issue",
    prompt: `Based on the provided content, create a GitHub feature request issue.

Return JSON with:
- **title**: "Feature: [clear feature name]"
- **body**: Markdown with sections: Summary, Motivation, Proposed Solution, Alternatives Considered, Acceptance Criteria
- **labels**: ["enhancement"]

Make it clear, scoped, and actionable for a developer.`,
  },
];

// Slack Reader Skills (analyzer skills + slack-specific skills)
const SLACK_READER_SKILLS: DefaultTileSkill[] = [
  ...ANALYZER_SKILLS,
  {
    id: "slack-reader-backlog",
    name: "Backlog",
    description:
      "Surface ideas and future work mentioned in Slack that lack planned next steps",
    category: "analysis",
    tileType: "slack_reader",
    prompt: `You are a backlog discovery assistant. Scan Slack messages for ideas, suggestions, and future work that have no concrete next steps or planning attached.

1. **Ideas & Suggestions**: Messages where someone proposes an idea, improvement, or feature without a follow-up plan
2. **Wishlist Items**: "It would be nice if…", "We should eventually…", "Someday we could…" type mentions
3. **Unresolved Questions**: Open questions about future direction with no answer or action item
4. **Stalled Initiatives**: Topics mentioned once and never followed up on

For each item found:
- **Quote**: The relevant message excerpt
- **Author**: Who mentioned it
- **Date**: When it was mentioned
- **Topic**: Brief categorization

Exclude anything that already has planned next steps, assigned owners, tickets, or scheduled dates. Focus only on untracked ideas floating in conversation.`,
  },
];

// Organized by tile type for easy access
export const DEFAULT_TILE_SKILLS: Record<TileType, DefaultTileSkill[]> = {
  url_reader: URL_READER_SKILLS,
  web_search: WEB_SEARCH_SKILLS,
  analyzer: ANALYZER_SKILLS,
  slack_reader: SLACK_READER_SKILLS,
  catalog: CATALOG_SKILLS,
  github_issue: GITHUB_ISSUE_SKILLS,
  knowledge_base: [],
  offer_sender: [],
};

// All unique skills derived from the tile type record (deduplicates shared arrays like slack_reader → ANALYZER_SKILLS)
export const ALL_DEFAULT_TILE_SKILLS: DefaultTileSkill[] = [
  ...new Set(Object.values(DEFAULT_TILE_SKILLS).flat()),
];

/**
 * Get skills for a specific tile type
 */
export function getDefaultSkillsForTileType(
  tileType: TileType,
): DefaultTileSkill[] {
  return DEFAULT_TILE_SKILLS[tileType] || [];
}

/**
 * Get a default skill by ID
 */
export function getDefaultSkillById(id: string): DefaultTileSkill | undefined {
  return ALL_DEFAULT_TILE_SKILLS.find((skill) => skill.id === id);
}

/**
 * Get skills by category for a specific tile type
 */
export function getSkillsByCategory(
  tileType: TileType,
  category: TileSkillCategory | "all",
): DefaultTileSkill[] {
  const skills = DEFAULT_TILE_SKILLS[tileType] || [];
  if (category === "all") {
    return skills;
  }
  return skills.filter((skill) => skill.category === category);
}

/**
 * Get available categories for a tile type
 */
export function getCategoriesForTileType(
  tileType: TileType,
): TileSkillCategory[] {
  const skills = DEFAULT_TILE_SKILLS[tileType] || [];
  const categories = new Set(skills.map((s) => s.category));
  return Array.from(categories);
}
