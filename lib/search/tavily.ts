export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score: number;
}

export interface TavilySearchOptions {
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeRawContent?: boolean;
}

interface TavilyApiResponse {
  results: TavilySearchResult[];
  query: string;
  response_time: number;
}

export async function searchWeb(
  query: string,
  options: TavilySearchOptions = {},
): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw new Error("TAVILY_API_KEY environment variable is not set");
  }

  const {
    searchDepth = "basic",
    maxResults = 5,
    includeRawContent = false,
  } = options;

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_raw_content: includeRawContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
  }

  const data: TavilyApiResponse = await response.json();
  return data.results;
}

export function formatSearchResultsAsMarkdown(
  query: string,
  results: TavilySearchResult[],
): string {
  if (results.length === 0) {
    return `## Search Results for: ${query}\n\nNo results found.`;
  }

  const formattedResults = results
    .map((result, index) => {
      const content = result.raw_content || result.content;
      return `### ${index + 1}. ${result.title}\nURL: ${result.url}\n\n${content}`;
    })
    .join("\n\n---\n\n");

  return `## Search Results for: ${query}\n\n${formattedResults}`;
}
