import Firecrawl from "@mendable/firecrawl-js";

let firecrawlClient: Firecrawl | null = null;

export function getFirecrawlClient(): Firecrawl {
  if (!firecrawlClient) {
    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey) {
      throw new Error("FIRECRAWL_API_KEY is not set");
    }

    firecrawlClient = new Firecrawl({ apiKey });
  }

  return firecrawlClient;
}

export interface ScrapeResult {
  url: string;
  success: boolean;
  content?: string;
  markdown?: string;
  title?: string;
  error?: string;
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  try {
    const client = getFirecrawlClient();

    const result = await client.scrape(url, {
      formats: ["markdown"],
    });

    return {
      url,
      success: true,
      content: result.markdown || "",
      markdown: result.markdown || "",
      title: result.metadata?.title || "",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      url,
      success: false,
      error: message,
    };
  }
}

export async function scrapeUrls(urls: string[]): Promise<ScrapeResult[]> {
  // Scrape URLs in parallel with concurrency limit
  const results: ScrapeResult[] = [];
  const concurrencyLimit = 3;

  for (let i = 0; i < urls.length; i += concurrencyLimit) {
    const batch = urls.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(batch.map(scrapeUrl));
    results.push(...batchResults);
  }

  return results;
}
