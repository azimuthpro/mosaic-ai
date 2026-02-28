/**
 * Maximum number of URLs a url_reader tile can process per execution.
 * Applies to direct URL sources, connection-extracted URLs, and runtime URLs.
 */
export const MAX_URLS_PER_TILE = 40;

/**
 * Batch size for Tavily Extract API calls.
 * URLs are sent in batches of this size to avoid overwhelming the API.
 */
export const URL_BATCH_SIZE = 10;

/**
 * Maximum number of Slack channels a slack_reader tile can monitor.
 */
export const MAX_SLACK_CHANNELS_PER_TILE = 20;
