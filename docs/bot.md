# Mosaic AI Bot

Mosaic AI includes a Slack bot powered by Google Gemini Pro. The bot helps users interact with their mosaics and tiles directly from Slack — listing workspaces, checking execution results, running tiles on demand, and searching the web.

## Capabilities

- **Mentions** — mention the bot in any channel to ask a question
- **Direct messages** — DM the bot for a private conversation
- **Thread follow-ups** — the bot subscribes to threads it participates in and responds to follow-up messages
- **Agentic reasoning** — the bot can chain up to 15 tool-calling steps to answer complex questions
- **Extended thinking** — internal reasoning (4096 token budget) for better responses
- **Streaming** — responses are streamed to Slack in real time (800ms update intervals)
- **Multi-workspace** — supports multiple Slack workspaces, each with its own bot token
- **Web search** — can search the web via both Google Search and Tavily for external information

## Tools

The bot has access to the following tools. It selects and combines them automatically based on the user's request.

### list_mosaics

List all mosaics (workspaces) the user has access to, with tile counts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| — | — | — | No parameters |

**Returns:** Array of mosaics with `id`, `name`, `created_at`, `role` (owner/member), and `tileCount`.

---

### get_mosaic_details

Get the tiles in a specific mosaic.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mosaic_id` | string | Yes | The mosaic ID (UUID). Use `search` to find by name. |

**Returns:** Mosaic metadata and an array of tiles with `id`, `name`, `type`, `schedule`, and `active` status.

---

### get_tile_status

Get execution status and recent job history for a tile. For `github_issue` tiles, also returns configured repositories.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tile_id` | string | Yes | The tile ID (UUID) |

**Returns:** Tile info (name, type, schedule, active, repos) and the last 5 jobs with status, timestamps, and errors.

---

### get_tile_result

Get the latest execution result content from a tile.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tile_id` | string | Yes | The tile ID (UUID) |

**Returns:** The result `content` (truncated to 8000 characters) and `createdAt` timestamp.

---

### find_tile

Find the most relevant tile for a question using semantic (vector) search. The bot uses this tool first when users ask about their data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language question or topic to search for |

**Returns:** Top 5 matching tiles with `tile_id`, `tile_name`, `tile_type`, `mosaic_name`, `description`, and `similarity` score. Also includes the latest result from the top match.

---

### search

Search mosaics and tiles by name (pattern matching).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query to match against names |

**Returns:** Matching mosaics and tiles with their IDs, names, and types.

---

### run_tile

Execute a tile on demand. Supports custom input text and repository targeting for `github_issue` tiles.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tile_id` | string | Yes | The tile ID (UUID). Use `search` or `find_tile` to find it. |
| `input` | string | No | Custom input text to replace the tile's normal source content. Useful for creating issues or running analyses on specific text. |
| `target_repo` | string | No | Target repository in `owner/repo` format for `github_issue` tiles with multiple repos configured. |

**Returns:** `success` boolean, `message`, and optionally the result `content` (truncated to 4000 characters).

---

### get_channel_info

Get info about the current Slack channel (name, topic, purpose). The bot calls this before `run_tile` for `github_issue` tiles to determine the right repository from channel context.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| — | — | — | No parameters |

**Returns:** Channel `name`, `topic`, and `purpose`.

---

### web_search

Search the web using Tavily for detailed, structured results. Supports advanced depth for thorough research on complex topics.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | The search query |
| `depth` | `"basic"` \| `"advanced"` | No | Search depth. Use `advanced` for thorough research. |

**Returns:** Array of results with `title`, `url`, `content`, and `score`.

---

### google_search

Built-in Google Search grounding via Gemini. Used alongside `web_search` for comprehensive web research.

---

## How It Works

1. A user mentions the bot in a channel, sends a DM, or replies in a thread the bot is following
2. The bot adds reaction emojis to acknowledge the message
3. The user's Slack email is matched to their Mosaic account
4. The bot generates a response using Gemini Pro with access to all tools above
5. The response is streamed back to the Slack thread in real time
6. The bot subscribes to the thread for follow-up messages

## Authentication

The bot maps Slack users to Mosaic accounts by matching email addresses. When a user interacts with the bot, their Slack profile email is looked up against Supabase auth users. Only users with a matching Mosaic account can access their mosaics and tiles through the bot.

Each Slack workspace has its own bot token stored in the `user_integrations` table, enabling multi-workspace support.
