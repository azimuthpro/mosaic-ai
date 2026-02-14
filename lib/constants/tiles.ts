/**
 * Maximum number of URLs a url_reader tile can process per execution.
 * Applies to direct URL sources, connection-extracted URLs, and runtime URLs.
 */
export const MAX_URLS_PER_TILE = 20;

/**
 * Batch size for Tavily Extract API calls.
 * URLs are sent in batches of this size to avoid overwhelming the API.
 */
export const URL_BATCH_SIZE = 10;
