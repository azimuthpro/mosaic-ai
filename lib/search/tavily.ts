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

// ============================================================================
// Tavily Extract API
// ============================================================================

export interface TavilyExtractOptions {
  extractDepth?: "basic" | "advanced";
}

export interface TavilyExtractResult {
  url: string;
  raw_content: string;
}

interface TavilyExtractApiResponse {
  results: TavilyExtractResult[];
  failed_urls?: string[];
}

/**
 * Extracts content from a URL using Tavily Extract API.
 * Returns markdown content.
 */
export async function extractUrl(
  url: string,
  options: TavilyExtractOptions = {},
): Promise<{ success: boolean; content?: string; error?: string }> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "TAVILY_API_KEY environment variable is not set",
    };
  }

  const { extractDepth = "basic" } = options;

  try {
    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        urls: [url],
        extract_depth: extractDepth,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Tavily Extract API error: ${response.status} - ${errorText}`,
      };
    }

    const data: TavilyExtractApiResponse = await response.json();

    if (data.failed_urls && data.failed_urls.includes(url)) {
      return {
        success: false,
        error: `Failed to extract content from URL: ${url}`,
      };
    }

    const result = data.results.find((r) => r.url === url);
    if (!result || !result.raw_content) {
      return { success: false, error: "No content extracted from URL" };
    }

    return { success: true, content: result.raw_content };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during extraction",
    };
  }
}

/**
 * Extracts content from multiple URLs using Tavily Extract API.
 * Returns combined markdown content.
 */
export async function extractMultipleUrls(
  urls: string[],
  options: TavilyExtractOptions & { maxUrls?: number } = {},
): Promise<{
  success: boolean;
  content?: string;
  extractedCount: number;
  failedUrls: string[];
}> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      extractedCount: 0,
      failedUrls: urls,
      content: undefined,
    };
  }

  const { extractDepth = "basic", maxUrls = 10 } = options;
  const urlsToExtract = urls.slice(0, maxUrls);

  if (urlsToExtract.length === 0) {
    return { success: true, content: "", extractedCount: 0, failedUrls: [] };
  }

  try {
    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        urls: urlsToExtract,
        extract_depth: extractDepth,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        extractedCount: 0,
        failedUrls: urlsToExtract,
        content: `Tavily Extract API error: ${response.status} - ${errorText}`,
      };
    }

    const data: TavilyExtractApiResponse = await response.json();
    const failedUrls = data.failed_urls || [];
    const successfulResults = data.results.filter((r) => r.raw_content);

    if (successfulResults.length === 0) {
      return {
        success: false,
        extractedCount: 0,
        failedUrls: urlsToExtract,
        content: "No content extracted from any URLs",
      };
    }

    // Format as markdown with URL headers
    const content = successfulResults
      .map((result) => `## ${result.url}\n\n${result.raw_content}`)
      .join("\n\n---\n\n");

    return {
      success: true,
      content,
      extractedCount: successfulResults.length,
      failedUrls,
    };
  } catch (error) {
    return {
      success: false,
      extractedCount: 0,
      failedUrls: urlsToExtract,
      content:
        error instanceof Error
          ? error.message
          : "Unknown error during extraction",
    };
  }
}

/**
 * Extracts content from multiple URLs using Tavily Extract API,
 * returning individual per-URL results (unlike extractMultipleUrls which combines them).
 */
export async function extractMultipleUrlsIndividual(
  urls: string[],
  options: TavilyExtractOptions = {},
): Promise<
  { url: string; success: boolean; content?: string; error?: string }[]
> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return urls.map((url) => ({
      url,
      success: false,
      error: "TAVILY_API_KEY environment variable is not set",
    }));
  }

  if (urls.length === 0) {
    return [];
  }

  const { extractDepth = "basic" } = options;

  try {
    const response = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        urls,
        extract_depth: extractDepth,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return urls.map((url) => ({
        url,
        success: false,
        error: `Tavily Extract API error: ${response.status} - ${errorText}`,
      }));
    }

    const data: TavilyExtractApiResponse = await response.json();
    const failedUrlSet = new Set(data.failed_urls || []);

    // Build a map of successful results by URL
    const resultMap = new Map<string, string>();
    for (const r of data.results) {
      if (r.raw_content) {
        resultMap.set(r.url, r.raw_content);
      }
    }

    return urls.map((url) => {
      if (failedUrlSet.has(url)) {
        return {
          url,
          success: false,
          error: `Failed to extract content from URL: ${url}`,
        };
      }
      const content = resultMap.get(url);
      if (!content) {
        return { url, success: false, error: "No content extracted from URL" };
      }
      return { url, success: true, content };
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during extraction";
    return urls.map((url) => ({
      url,
      success: false,
      error: errorMessage,
    }));
  }
}

/**
 * Extract domain name from URL to use as fallback title
 */
function extractDomainName(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // Remove www. prefix if present
    return hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Validates a URL and extracts metadata using Tavily Extract API.
 * Used for real-time validation in the URL source dialog.
 */
export async function validateUrlWithMetadata(url: string): Promise<{
  isValid: boolean;
  isAccessible: boolean;
  pageTitle?: string;
  error?: string;
}> {
  const result = await extractUrl(url, { extractDepth: "basic" });

  if (!result.success) {
    return {
      isValid: true, // URL format is valid (SSRF check passed)
      isAccessible: false,
      pageTitle: extractDomainName(url), // Use domain name when inaccessible
      error: result.error,
    };
  }

  // Extract title from markdown content (first # heading)
  const titleMatch = result.content?.match(/^#\s+(.+)$/m);
  const extractedTitle = titleMatch?.[1];

  // Fallback to domain name if no title found
  const pageTitle = extractedTitle || extractDomainName(url);

  return {
    isValid: true,
    isAccessible: true,
    pageTitle,
  };
}

// ============================================================================
// Search Result Formatting
// ============================================================================

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
