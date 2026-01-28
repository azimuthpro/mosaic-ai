export type SkillCategory =
  | "news"
  | "market"
  | "research"
  | "social"
  | "deep-search"
  | "custom";

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  prompt: string;
}

export const SKILL_CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: "news", label: "News & Media" },
  { value: "market", label: "Market & Pricing" },
  { value: "research", label: "Research & Analysis" },
  { value: "social", label: "Social & Brand" },
  { value: "deep-search", label: "Deep Search" },
  { value: "custom", label: "Custom" },
];

export const BUILTIN_SKILLS: Skill[] = [
  // News & Media
  {
    id: "news-monitor",
    name: "News Monitor",
    category: "news",
    description: "Track headlines and breaking news from sources",
    prompt: `Monitor the provided sources for news and updates. For each piece of news found:

1. Extract the headline and main story
2. Identify the publication date/time
3. Summarize the key points in 2-3 sentences
4. Note any significant quotes or statements
5. Flag any breaking or urgent news

Focus on factual reporting and avoid opinion pieces unless specifically relevant.`,
  },
  {
    id: "article-summarizer",
    name: "Article Summarizer",
    category: "news",
    description: "Extract key points and summaries from articles",
    prompt: `Analyze the provided articles and create concise summaries. For each article:

1. Identify the main topic and thesis
2. Extract the 3-5 most important points
3. Note any data, statistics, or evidence cited
4. Summarize conclusions or recommendations
5. Identify the target audience and tone

Keep summaries concise but comprehensive.`,
  },
  {
    id: "press-release-tracker",
    name: "Press Release Tracker",
    category: "news",
    description: "Monitor press releases and announcements",
    prompt: `Track and analyze press releases and official announcements. For each release:

1. Identify the issuing organization
2. Extract the main announcement or news
3. Note any key dates, figures, or commitments
4. Identify quoted executives or spokespersons
5. Assess the potential impact or significance

Prioritize recent releases and significant announcements.`,
  },

  // Market & Pricing
  {
    id: "price-tracker",
    name: "Price Tracker",
    category: "market",
    description: "Monitor product prices and changes",
    prompt: `Monitor and track pricing information from the provided sources. For each product or service:

1. Extract the current price
2. Note any discounts, promotions, or special offers
3. Identify price tiers or variations (if applicable)
4. Track any price changes from previous observations
5. Note availability or stock status

Organize data in a structured format for easy comparison.`,
  },
  {
    id: "competitor-watch",
    name: "Competitor Watch",
    category: "market",
    description: "Track competitor updates and activities",
    prompt: `Monitor competitor activity and updates. Look for:

1. New product or service announcements
2. Pricing changes or promotions
3. Marketing campaigns or messaging changes
4. Leadership or organizational updates
5. Strategic moves or partnerships

Provide actionable insights and highlight significant changes.`,
  },
  {
    id: "market-trends",
    name: "Market Trends",
    category: "market",
    description: "Identify market trends and patterns",
    prompt: `Analyze the provided sources for market trends and patterns. Identify:

1. Emerging trends or shifts in the market
2. Consumer behavior changes
3. Industry developments and innovations
4. Regulatory or policy changes affecting the market
5. Growth opportunities or threats

Provide analysis with supporting evidence from the sources.`,
  },

  // Research & Analysis
  {
    id: "content-aggregator",
    name: "Content Aggregator",
    category: "research",
    description: "Summarize and organize content from sources",
    prompt: `Aggregate and organize content from the provided sources. Tasks:

1. Group content by topic or theme
2. Identify common threads and connections
3. Highlight unique or contrasting perspectives
4. Create a structured overview of all content
5. Note gaps or areas needing more coverage

Present information in a logical, easy-to-navigate format.`,
  },
  {
    id: "data-extractor",
    name: "Data Extractor",
    category: "research",
    description: "Extract structured data from web pages",
    prompt: `Extract structured data from the provided web pages. Focus on:

1. Tables, lists, and structured information
2. Key metrics, statistics, and numbers
3. Dates, names, and specific entities
4. Categorize data by type and relevance
5. Note data quality and completeness

Output data in a clean, structured format suitable for analysis.`,
  },
  {
    id: "report-generator",
    name: "Report Generator",
    category: "research",
    description: "Generate analysis reports from sources",
    prompt: `Generate a comprehensive analysis report from the provided sources. Include:

1. Executive summary of key findings
2. Detailed analysis of main topics
3. Supporting data and evidence
4. Trends and patterns identified
5. Recommendations or next steps

Structure the report professionally with clear sections and conclusions.`,
  },

  // Social & Brand
  {
    id: "brand-mentions",
    name: "Brand Mentions",
    category: "social",
    description: "Track brand/keyword mentions",
    prompt: `Monitor the provided sources for brand and keyword mentions. Track:

1. Direct brand/product mentions
2. Context and sentiment of mentions
3. Who is talking (influencers, media, users)
4. Reach and potential impact
5. Competitor mentions for comparison

Categorize mentions by type and prioritize by significance.`,
  },
  {
    id: "sentiment-analyzer",
    name: "Sentiment Analyzer",
    category: "social",
    description: "Analyze sentiment and reactions",
    prompt: `Analyze sentiment and reactions from the provided sources. Assess:

1. Overall sentiment (positive, negative, neutral)
2. Emotional tone and intensity
3. Common themes in feedback
4. Areas of praise or criticism
5. Changes in sentiment over time

Provide quantitative sentiment scores where possible.`,
  },
  {
    id: "social-trends",
    name: "Social Trends",
    category: "social",
    description: "Monitor trending topics and discussions",
    prompt: `Monitor social trends and discussions. Identify:

1. Trending topics and hashtags
2. Viral content and its themes
3. Emerging conversations and debates
4. Influencer activity and opinions
5. Community sentiment and reactions

Focus on relevance to your industry or interests.`,
  },

  // Deep Search
  {
    id: "person-profiler",
    name: "Person Profiler",
    category: "deep-search",
    description: "Research and compile information about individuals",
    prompt: `Research and compile a professional profile from the provided sources. Include:

1. Professional background and current role
2. Career history and achievements
3. Public statements and positions
4. Media appearances and interviews
5. Professional affiliations and networks

Focus on publicly available, professional information only.`,
  },
  {
    id: "company-intelligence",
    name: "Company Intelligence",
    category: "deep-search",
    description: "Gather company information and updates",
    prompt: `Gather comprehensive company intelligence from the provided sources. Research:

1. Company overview and structure
2. Products, services, and offerings
3. Recent news and announcements
4. Financial information (if public)
5. Key personnel and leadership

Compile into a structured company profile.`,
  },
  {
    id: "contact-finder",
    name: "Contact Finder",
    category: "deep-search",
    description: "Find contact information and social profiles",
    prompt: `Find publicly available contact information from the provided sources. Look for:

1. Official contact pages and forms
2. Public social media profiles
3. Professional networking profiles
4. Published email addresses or phone numbers
5. Office locations and addresses

Only include information that is publicly shared and intended for contact purposes.`,
  },
];

export function getSkillsByCategory(category: SkillCategory | "all"): Skill[] {
  if (category === "all") {
    return BUILTIN_SKILLS;
  }
  return BUILTIN_SKILLS.filter((skill) => skill.category === category);
}

export function getSkillById(id: string): Skill | undefined {
  return BUILTIN_SKILLS.find((skill) => skill.id === id);
}
