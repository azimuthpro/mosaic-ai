# Mosaic AI

Automated intelligence gathering and analysis platform. Create visual workspaces with tiles that scrape web pages, perform AI-powered searches, and process data through configurable pipelines.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Auth & Database**: Supabase (PostgreSQL with RLS, Magic Link auth)
- **AI**: Vercel AI SDK with Google Gemini 3 Flash
- **Web Scraping**: Firecrawl
- **Web Search**: Tavily API
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

- [Project Specification](docs/specification.md) - Detailed technical overview
- [CLAUDE.md](CLAUDE.md) - Architecture and codebase guide
- [CHANGELOG.md](CHANGELOG.md) - Version history
