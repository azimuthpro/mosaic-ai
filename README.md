# Mosaic AI

Automated intelligence gathering and analysis platform. Create visual workspaces with tiles that scrape web pages, perform AI-powered searches, read Slack channels, and process data through configurable pipelines.

## Features

- **8 Tile Types**: URL Reader (web scraping), Web Search, Analyzer (AI processing), Slack Reader, Catalog (persistent entity tracking with diffs and events), GitHub Issue (creates issues via OAuth with predefined skills), Knowledge Base (static text content), and Offer Sender (AI-personalized HTML email offers with Slack approval flow)
- **Visual Canvas**: Drag-and-drop tiles on a spatial workspace with colors and patterns
- **Tile Connections**: Build data pipelines by linking tiles — downstream tiles auto-trigger on updates (cascading execution)
- **Scheduling**: Manual, hourly, or custom cron (specific hours/days), timezone-aware per mosaic
- **Slack Bot**: Chat SDK-powered conversational bot with AI tools (run tiles, create GitHub issues, semantic search, web search grounding) over mentions and DMs
- **Slack Integration**: OAuth-based channel reading, result delivery (with AI thread summaries), and Events API. Multi-workspace support
- **Google Sheets Sync**: OAuth-based catalog entry and event export to Google Sheets
- **GitHub Integration**: OAuth-based issue creation with multi-repo support and runtime repo selection
- **Tile Router**: Vector search and LLM reasoning to route requests to the right tile
- **Webhooks**: Event-driven notifications (started/completed/failed) with retry logic and delivery history
- **REST API**: Per-mosaic API keys for programmatic tile execution with SSE streaming
- **Team Sharing**: Role-based access (owner/admin/member) with email invitations
- **Skills Library**: Built-in skill templates per tile type, plus user-created custom skills
- **AI Prompt Editor**: Describe what you want in plain language — AI generates a production-ready prompt for your tiles
- **AI Processing**: Google Gemini (Flash and Pro) — text or structured JSON output with optional Zod schema, grounded in current date/time
- **Multi-Language Output**: English, Polish, Spanish, Italian, German
- **Memory Mode**: Source-level historical context from the last 30 days
- **Rate Limiting**: Per-user hourly and concurrent execution limits
- **Debug Mode**: Per-execution structured logs viewer for troubleshooting

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Auth & Database**: Supabase (PostgreSQL with RLS, Magic Link auth)
- **AI**: Vercel AI SDK v6 with Google Gemini (Flash and Pro)
- **Chat Bot**: Chat SDK (`chat` package) with `@chat-adapter/slack`
- **Web Scraping**: Firecrawl v4
- **Web Search**: Tavily API
- **GitHub**: Octokit
- **Google**: Google Sheets API
- **Email**: SendGrid
- **Scheduling**: Vercel Cron Jobs
- **Deployment**: Vercel

## Getting Started

```bash
bun install
bun run dev      # http://localhost:3000
```

## Scripts

```bash
bun run dev      # Start development server
bun run build    # Production build
bun run start    # Start production server
bun run lint     # Run ESLint
```

## Documentation

- [docs/](docs/README.md) - Getting started, tile reference, integrations, API, bot, architecture
- [CLAUDE.md](CLAUDE.md) - Architecture and codebase guide for Claude Code
- [CHANGELOG.md](CHANGELOG.md) - Version history
