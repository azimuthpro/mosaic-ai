# Mosaic AI Bot

Mosaic AI includes a Slack bot powered by Gemini Flash via the Vercel AI Gateway. The bot helps users interact with their mosaics and tiles directly from Slack — listing workspaces, checking execution results, running tiles on demand, and searching the web.

## Capabilities

- **Mentions** — mention the bot in any channel to ask a question
- **Direct messages** — DM the bot for a private conversation
- **Thread follow-ups** — the bot subscribes to threads it participates in and responds to follow-up messages
- **Agentic reasoning** — the bot can chain up to 6 tool-calling steps to answer complex questions
- **Extended thinking** — internal reasoning (4096 token budget) for better responses
- **Streaming** — responses are streamed to Slack in real time (800ms update intervals)
- **Multi-workspace** — supports multiple Slack workspaces, each with its own bot token
- **Web search** — can search the web via Tavily for external information

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

## How It Works

1. A user mentions the bot in a channel, sends a DM, or replies in a thread the bot is following
2. Messages from the bot itself and from other bots are ignored
3. The user's Slack email is matched to their Mosaic account
4. The bot adds reaction emojis (👀 and ⏳) to acknowledge the message
5. The bot generates a response using Gemini Flash with access to all tools above
6. The response is streamed back to the Slack thread in real time
7. The bot subscribes to the thread for follow-up messages, and ⏳ is removed

If a step fails the bot says so in the thread rather than going quiet.

## Authentication

The bot maps Slack users to Mosaic accounts by matching email addresses. When a user interacts with the bot, their Slack profile email is looked up against Supabase auth users (`find_user_id_by_email`). Only users with a matching Mosaic account can access their mosaics and tiles through the bot, and **every tool scopes its queries to that account** — a tile ID alone grants nothing.

Matches are cached for 10 minutes per `(workspace, Slack user)`. Failures are reported differently depending on the cause: a missing `users:read.email` scope needs an admin to reconnect Slack, whereas an unknown email needs the user to sign up with their Slack address. In a followed thread the bot stays silent for people it cannot identify, so team conversations are not interrupted.

Each Slack workspace has its own bot token stored in the `user_integrations` table, resolved by team ID, enabling multi-workspace support.

## Deployment requirements

| Requirement | Why |
|-------------|-----|
| `POSTGRES_URL` (or `DATABASE_URL`) | Thread subscriptions, message dedupe and thread locks are stored via `@chat-adapter/state-pg`. Without it the bot falls back to in-memory state: on serverless, thread follow-ups are dropped when a reply lands on another instance, and retried Slack events are answered twice |
| Both webhook routes reachable unauthenticated | `/api/slack/events` and `/api/slack/interactivity` authenticate by Slack signature. An auth redirect in front of them makes Slack report "your URL didn't respond" |
