# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mosaic AI is an automated intelligence gathering and analysis platform. Users create **Mosaics** (workspaces) containing visual **Tiles** that periodically scrape web pages using Firecrawl, perform web searches via Tavily, and process data with AI (Google Gemini). Results are stored in a database with optional Google Sheets integration.

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
- **Styling**: Tailwind CSS v4
- **Auth & Database**: Supabase (PostgreSQL with RLS, Magic Link auth)
- **AI**: Vercel AI SDK with Google Gemini 3 Flash
- **Web Scraping**: Firecrawl
- **Web Search**: Tavily API
- **Scheduling**: Vercel Cron Jobs
- **Deployment**: Vercel

## Architecture

### Core Concepts

- **Mosaics**: Workspace containers for organizing tiles. Users can have multiple mosaics and share them with team members.
- **Tiles**: Visual intelligence gathering units with types:
  - `url_reader`: Web pages scraped via Firecrawl
  - `web_search`: AI-powered web search via Tavily API
  - `recursive`: Pipeline tiles that chain outputs from connected tiles
  - `analyzer`: Specialized analysis of connected tile data
- **Tile Connections**: Data flow links between tiles within a mosaic
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
8. Data optionally appended to user's Google Sheet

### Database Schema (Supabase)

**Core Tables:**
- `mosaics` - Workspace containers (name, owner_id, settings)
- `mosaic_members` - Sharing permissions at mosaic level
- `tiles` - Tile configurations (mosaic_id, tile_type, color, pattern, grid position, prompt)
- `tile_connections` - Data flow between tiles (source_tile_id, target_tile_id)
- `tile_sources` - Data inputs for tiles (url, type, source_reference_id)
- `tile_jobs` - Execution history for tiles
- `tile_job_results` - Analysis results from tile job executions

**Other Tables:**
- `users` - Managed by Supabase Auth
- `allowlist` - Email-based access control (invite-only)
- `execution_logs` - Logging for tile execution events

### Key Utilities

- `lib/sources/tile-content-fetcher.ts` - Content fetching for tile sources
- `lib/sources/content-fetcher.ts` - Legacy content fetcher for agents
- `lib/actions/mosaics.ts` - Server actions for mosaic CRUD
- `lib/actions/tiles.ts` - Server actions for tile CRUD and connections
- `lib/email/sendgrid.ts` - Email sending with Mosaic AI branding

### Key API Routes

- `/api/cron/trigger` - Protected endpoint for scheduled job execution
- `/api/tiles/run` - Manual tile execution endpoint
- `/api/agents/run` - Legacy agent execution endpoint
- `/api/auth/check-allowlist` - Email allowlist verification for signup

### Route Groups

- `(auth)` - Authentication pages (login, signup with magic link, callback)
- `(app)` - Protected app pages:
  - `/mosaics` - Mosaic list and management
  - `/mosaics/[id]` - Mosaic canvas with tiles
  - `/mosaics/[id]/settings` - Mosaic settings
  - `/agents` - Legacy agent pages
  - `/reports` - Report viewing

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
