# Getting Started

Set up a local Mosaic AI development environment.

## Prerequisites

- [Bun](https://bun.sh) 1.2+ (package manager and script runner)
- A Supabase project (free tier is fine)
- API keys for the services you want to enable (see [Environment Variables](#environment-variables))

## 1. Clone and install

```bash
git clone <repo-url>
cd mosaic-ai
bun install
```

## 2. Configure environment

Copy the example file and fill in the values:

```bash
cp env.local.example .env.local
```

### Required

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings → API (server-only) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | https://aistudio.google.com/apikey |
| `CRON_SECRET` | `openssl rand -hex 32` |

### Optional (per feature)

| Variable | Used for |
|----------|----------|
| `FIRECRAWL_API_KEY` | `url_reader` scraping and URL validation |
| `TAVILY_API_KEY` | `web_search` tiles, bot web search |
| `SENDGRID_API_KEY` | Magic-link emails, invitations, `offer_sender` delivery |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET` | Slack OAuth, bot, signature verification |

GitHub and Google OAuth credentials are configured per [Integrations](integrations.md).

## 3. Apply database migrations

The schema lives in `supabase/migrations/` as numbered SQL files.

```bash
bunx supabase link --project-ref <your-project-ref>
bunx supabase db push
```

Migrations include the schema, RLS policies, RPC functions for atomic rate limiting, and pgvector extension for the tile router.

## 4. Allowlist your email

Signup is invite-only via the `allowlist` table. Insert your email manually in the Supabase SQL editor:

```sql
insert into allowlist (email) values ('you@example.com');
```

## 5. Run the dev server

```bash
bun run dev
```

Open http://localhost:3000 and sign in via magic link.

## Scripts

```bash
bun run dev      # Next dev server on :3000
bun run build    # Production build
bun run start    # Production server (after build)
bun run lint     # ESLint
```

## Cron

Vercel runs `/api/cron/trigger` hourly (`vercel.json`). Locally, you can hit it manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/trigger
```

The endpoint walks active tiles, respects the mosaic's timezone, and triggers ones whose schedule matches the current hour.

## Next steps

- Create a mosaic and add a tile — see [Tile Types](tiles.md) for what each does
- Connect Slack, GitHub, or Google — see [Integrations](integrations.md)
- Hit tiles programmatically — see [REST API](api.md)
