# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mosaic AI is an automated intelligence gathering and analysis platform. Users create **Mosaics** (workspaces) containing visual **Tiles** that periodically scrape web pages using Firecrawl, perform web searches via Tavily, read Slack channels, and process data with AI (Google Gemini). Results are stored in a database with optional Slack output and Google Sheets integration.

## Development Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/postcss`, no tailwind.config file)
- **Auth & Database**: Supabase (PostgreSQL with RLS, Magic Link auth)
- **AI**: Vercel AI SDK with Google Gemini Flash
- **Chat Bot**: Chat SDK (`chat` package) with `@chat-adapter/slack` for Slack bot
- **Web Scraping**: Firecrawl
- **Web Search**: Tavily API
- **Scheduling**: Vercel Cron Jobs
- **Deployment**: Vercel

## Architecture

### Core Concepts

- **Mosaics**: Workspace containers for organizing tiles. Users can have multiple mosaics and share them with team members.
- **Tiles**: Visual intelligence gathering units with types:
  - `url_reader`: Web pages scraped via Firecrawl. With connections: extracts URLs from connected tile data and scrapes them.
  - `web_search`: AI-powered web search via Tavily API. With connections: extracts keywords from connected tile data and uses them as search queries.
  - `analyzer`: Process and analyze connected tile data. Receives full report content from connections.
  - `slack_reader`: Reads messages from connected Slack channels. Config: channel_id, max_messages, include_threads, hours_back.
  - `catalog`: Persistent entity catalog with AI-detected schema. Tracks entities across executions with diffs and events.
- **Tile Connections**: Universal data flow links between tiles. Any tile type can receive connections, with type-specific extraction of data from connected tiles.
- **Tile Sources**: Data inputs for tiles (URLs, search queries, or referenced tiles)
- **Mosaic Sharing**: Role-based access control (owner/admin/member) at mosaic level

### Legacy Concepts (Deprecated)

- **Agents**: Previous term for intelligence gathering tasks (use Tiles instead)
- **Agent Members**: Previous sharing model (use Mosaic Members instead)

### Data Flow

1. User creates a Mosaic and adds Tiles via the canvas UI
2. User configures each Tile with sources, instructions, and schedule
3. Tiles can be connected to create data pipelines
4. Vercel Cron triggers serverless function at scheduled interval
5. Content fetcher processes sources by type:
   - URL sources: Firecrawl scrapes web pages
   - Tile report sources: Fetches latest report from connected tile
   - Web search sources: Tavily API performs search
6. Combined content sent to LLM with tile's system prompt
7. Structured result stored in Supabase
8. Webhooks triggered on job events (started, completed, failed)
9. If downstream tiles have `trigger_on_source_update` enabled, they automatically execute (cascading)
10. Slack output delivered if enabled on the tile
11. Data optionally appended to user's Google Sheet

### Database Schema (Supabase)

**Core Tables:**
- `mosaics` - Workspace containers (name, owner_id, settings)
- `mosaic_members` - Sharing permissions at mosaic level
- `tiles` - Tile configurations (mosaic_id, tile_type, color, pattern, grid position, prompt)
- `tile_connections` - Data flow between tiles (source_tile_id, target_tile_id)
- `tile_sources` - Data inputs for tiles (url, type, source_reference_id)
- `tile_jobs` - Execution history for tiles
- `tile_job_results` - Analysis results from tile job executions

**Sharing & Auth Tables:**
- `users` - Managed by Supabase Auth
- `allowlist` - Email-based access control (invite-only)
- `mosaic_invitations` - Pending share invitations
- `mosaic_api_keys` - API key management for mosaics

**Execution & Logging Tables:**
- `tile_job_execution_logs` - Detailed execution event logging
- `user_rate_limits` - Per-user rate limit tracking

**Webhook Tables:**
- `tile_webhooks` - Webhook destinations per tile (URL, auth, events)
- `tile_webhook_deliveries` - Delivery history with retry tracking

**Skills Tables:**
- `tile_skills` - Reusable skill/prompt templates for tiles

**Integration Tables:**
- `user_integrations` - OAuth tokens for external services (e.g., Slack); keyed by (user_id, provider, provider_team_id)

**Catalog Tables:**
- `catalog_schemas` - AI-detected entity schema per catalog tile
- `catalog_entries` - Persistent entities tracked across executions
- `catalog_entry_events` - Chronological events per entity
- `catalog_diffs` - Change summary per execution (added/updated entries, new events)

### Key Utilities

- `lib/sources/tile-content-fetcher.ts` - Content fetching for tile sources
- `lib/actions/mosaics.ts` - Server actions for mosaic CRUD
- `lib/actions/tiles.ts` - Server actions for tile CRUD and connections
- `lib/actions/tile-execution.ts` - Tile job status and result fetching
- `lib/actions/webhooks.ts` - Webhook CRUD and delivery management
- `lib/actions/tile-skills.ts` - Tile skills management
- `lib/rate-limit/limiter.ts` - Rate limiting and execution logging
- `lib/email/sendgrid.ts` - Email sending with Mosaic AI branding
- `lib/tiles/extract-urls-from-job.ts` - URL extraction from connected tile job results
- `lib/tiles/extract-keywords-from-job.ts` - Keyword extraction from connected tile job results
- `lib/tiles/trigger-downstream.ts` - Cascading tile execution
- `lib/slack/client.ts` - Slack API client
- `lib/slack/integration.ts` - Slack integration helpers
- `lib/slack/oauth.ts` - Slack OAuth flow
- `lib/outputs/slack-output.ts` - Slack message delivery after tile execution
- `lib/catalog/execute-catalog.ts` - Catalog tile execution logic
- `lib/execution/context.ts` - Execution context management
- `lib/execution/timeout.ts` - Execution timeout handling
- `lib/ai/gemini.ts` - Gemini model configuration and content analysis
- `lib/search/tavily.ts` - Tavily web search client
- `lib/slack/verify-signature.ts` - Slack request signature verification
- `lib/actions/catalog.ts` - Server actions for catalog CRUD
- `lib/actions/integrations.ts` - Server actions for user integrations (OAuth tokens)
- `lib/actions/invite.ts` - Mosaic invitation handling
- `lib/bot/index.ts` - Chat SDK Slack bot setup and entry point
- `lib/bot/handlers.ts` - Bot message and event handlers
- `lib/bot/tools.ts` - AI tools available to the bot
- `lib/bot/data.ts` - Bot data access layer
- `lib/slack/events/monitor-check.ts` - Slack event monitoring

### Key API Routes

- `/api/ai/improve-prompt` - AI-powered prompt improvement suggestions
- `/api/cron/trigger` - Protected endpoint for scheduled job execution (hourly, respects mosaic timezone)
- `/api/tiles/run` - Manual tile execution endpoint
- `/api/slack/channels` - List Slack channels for connected workspaces
- `/api/auth/slack/connect` - Initiate Slack OAuth flow
- `/api/auth/slack/callback` - Handle Slack OAuth callback
- `/api/v1/sources/validate-url` - URL validation endpoint
- `/api/v1/tiles/[tileId]/run` - V1 API tile execution with SSE streaming
- `/api/v1/tiles/[tileId]/status` - V1 API tile status endpoint
- `/api/v1/tiles/[tileId]/data` - V1 API tile data endpoint
- `/api/v1/tiles/[tileId]/webhooks` - Webhook list and creation
- `/api/v1/tiles/[tileId]/webhooks/[webhookId]` - Webhook get/update
- `/api/v1/tiles/[tileId]/webhooks/[webhookId]/test` - Webhook test delivery
- `/api/v1/tiles/[tileId]/webhooks/[webhookId]/deliveries` - Webhook delivery history
- `/api/v1/mosaics/[mosaicId]/keys` - API key management
- `/api/slack/events` - Slack Events API handler (bot mentions, signature verification)
- `/api/auth/check-allowlist` - Email allowlist verification for signup
- `/api/auth/invitation` - Mosaic invitation handling

### Route Groups

- `(auth)` - Authentication pages (signin, signup with magic link, callback)
- `(app)` - Protected app pages:
  - `/mosaics` - Mosaic list and management
  - `/mosaics/[id]` - Mosaic canvas with tiles
  - `/mosaics/[id]/settings` - Mosaic settings (timezone configuration)
  - `/mosaics/[id]/tiles/[tileId]/settings` - Tile-specific settings
- `(marketing)` - Public marketing landing page

## Path Alias

Use `@/*` for imports from project root (configured in tsconfig.json).

## UX Guidelines

The UI abstracts technical details from users:
- "Firecrawl" → "Web Reader" or "Source"
- "Prompt" → "Instructions"
- "Cron" → "Schedule" (Daily, Weekly)
- Tiles have visual colors and patterns for easy identification
- Connected tiles "glow" when selected

## Authentication

Uses Supabase Magic Link authentication:
- No passwords required
- Email-based OTP flow
- Signup restricted to allowlist emails

## Security Notes

- Row Level Security (RLS) enabled on all Supabase tables
- API keys (Firecrawl, Google AI, Tavily) stored in Vercel environment variables (server-side only)
- OAuth tokens stored securely in Supabase
- Tile connections checked for circular dependencies
- Rate limiting on execution (per-user hourly and concurrent limits)
