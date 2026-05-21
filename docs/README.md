# Mosaic AI Documentation

Automated intelligence gathering and analysis platform. Users assemble **Tiles** on a visual **Mosaic** canvas; tiles fetch from the web, search engines, Slack, GitHub, or upstream tiles, process the content with Gemini, and deliver results to Slack, webhooks, Google Sheets, or downstream tiles.

## Start here

- [Getting Started](getting-started.md) — clone, configure environment, run locally
- [Tile Types](tiles.md) — what each tile does and how to configure it
- [Integrations](integrations.md) — Slack, GitHub, and Google OAuth setup
- [REST API](api.md) — API key auth, tile execution, SSE streaming, webhooks
- [Slack Bot](bot.md) — bot commands and AI tools
- [Architecture](architecture-analysis.md) — deep dive into system design

## Project layout

```
app/                Next.js App Router (routes, API, pages)
  (app)/            Authenticated app pages (mosaics, tiles)
  (auth)/           Magic-link sign in/up
  (marketing)/      Public landing
  api/              REST endpoints (cron, tiles, OAuth, v1)
components/         React components (UI, mosaic, tiles, slack, github)
lib/                Domain logic
  actions/          Server actions (CRUD)
  ai/               Gemini configuration and analysis
  bot/              Slack bot (Chat SDK)
  catalog/          Catalog tile execution
  email/            SendGrid + offer_sender flow
  execution/        ExecutionContext, timeout guards
  github/           OAuth, issue creation
  google/           OAuth, Sheets client
  outputs/          Slack and Sheets output delivery
  rate-limit/       Per-user limits
  router/           Vector search + LLM reasoning for tile routing
  slack/            OAuth, client, signature verification
  sources/          Tile content fetcher
  tiles/            Connection extraction, cascade triggers
supabase/migrations Numbered SQL migrations
```

## Related files at the repo root

- [README.md](../README.md) — short product overview
- [CLAUDE.md](../CLAUDE.md) — codebase guide for Claude Code
- [CHANGELOG.md](../CHANGELOG.md) — version history
