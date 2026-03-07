# Mosaic AI

Automated intelligence gathering and analysis platform. Create visual workspaces with tiles that scrape web pages, perform AI-powered searches, read Slack channels, and process data through configurable pipelines.

## Features

- **5 Tile Types**: URL Reader (web scraping), Web Search, Analyzer (AI processing), Slack Reader, and Catalog (persistent entity tracking with diffs and events)
- **Visual Canvas**: Drag-and-drop tiles on a spatial workspace with colors and patterns
- **Tile Connections**: Build data pipelines by linking tiles — downstream tiles auto-trigger on updates (cascading execution)
- **Scheduling**: Manual, hourly, or custom cron (specific hours/days), timezone-aware per mosaic
- **Slack Integration**: OAuth-based channel reading, result delivery, and Events API (bot mentions with reactions). Multi-workspace support
- **Webhooks**: Event-driven notifications (started/completed/failed) with retry logic and delivery history
- **REST API**: Per-mosaic API keys for programmatic tile execution with SSE streaming
- **Team Sharing**: Role-based access (owner/admin/member) with email invitations
- **Skills Library**: Built-in skill templates per tile type, plus user-created custom skills
- **AI Prompt Editor**: Describe what you want in plain language — AI generates a production-ready prompt for your tiles
- **AI Processing**: Google Gemini Flash — text or structured JSON output with optional Zod schema
- **Multi-Language Output**: English, Polish, Spanish, Italian, German
- **Memory Mode**: Source-level historical context from the last 30 days
- **Rate Limiting**: Per-user hourly and concurrent execution limits

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Auth & Database**: Supabase (PostgreSQL with RLS, Magic Link auth)
- **AI**: Vercel AI SDK with Google Gemini Flash
- **Web Scraping**: Firecrawl
- **Web Search**: Tavily API
- **Email**: SendGrid
- **Scheduling**: Vercel Cron Jobs
- **Deployment**: Vercel

## Getting Started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Documentation

- [CLAUDE.md](CLAUDE.md) - Architecture and codebase guide
- [CHANGELOG.md](CHANGELOG.md) - Version history
