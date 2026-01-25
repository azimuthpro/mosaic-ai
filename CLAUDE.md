# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mosaic AI is an automated intelligence gathering and analysis platform. Users define "Agents" that periodically scrape web pages using Firecrawl, process data with AI (Google Gemini), and store results in a database with Google Sheets integration.

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
- **Auth & Database**: Supabase (PostgreSQL with RLS)
- **AI**: Vercel AI SDK with Google Gemini 3 Flash
- **Web Scraping**: Firecrawl
- **Scheduling**: Vercel Cron Jobs
- **Deployment**: Vercel

## Architecture

### Core Concepts

- **Agents**: User-configured intelligence gathering tasks with source URLs, prompts, and schedules
- **Sources**: URLs associated with agents to be scraped
- **Jobs**: Execution records for agent runs
- **Reports**: Analyzed data extracted from scraped content

### Data Flow

1. User configures Agent via dashboard (URLs, prompt, schedule)
2. Vercel Cron triggers serverless function at scheduled interval
3. Function calls Firecrawl to scrape target URLs
4. Scraped content sent to LLM with user's system prompt
5. Structured result stored in Supabase
6. Data appended to user's Google Sheet

### Database Schema (Supabase)

- `users` - Managed by Supabase Auth
- `allowlist` - Email-based access control (invite-only)
- `agents` - Agent configurations (name, prompt, schedule, output format)
- `sources` - URLs linked to agents
- `jobs` - Execution history with status tracking
- `reports` - Extracted analysis results (JSONB)

### Key API Routes

- `/api/cron/trigger` - Protected endpoint for scheduled job execution

## Path Alias

Use `@/*` for imports from project root (configured in tsconfig.json).

## UX Guidelines

The UI abstracts technical details from users:
- "Firecrawl" → "Web Reader" or "Source"
- "Prompt" → "Instructions"
- "Cron" → "Schedule" (Daily, Weekly)

## Security Notes

- Row Level Security (RLS) enabled on all Supabase tables
- API keys (Firecrawl, Google AI) stored in Vercel environment variables (server-side only)
- OAuth tokens stored securely in Supabase
