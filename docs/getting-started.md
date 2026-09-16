# Getting Started

Set up a local Mosaic AI development environment.

## Prerequisites

- Node.js 24 LTS (`.nvmrc` pins the version — `nvm use` picks it up)
- [Bun](https://bun.sh) 1.2+ (package manager and script runner)
- Docker (for the local Supabase stack), or a hosted Supabase project
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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project settings → API Keys (`sb_publishable_…`; falls back to legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SECRET_KEY` | Supabase project settings → API Keys (`sb_secret_…`, server-only; falls back to legacy `SUPABASE_SERVICE_ROLE_KEY`) |
| `CRON_SECRET` | `openssl rand -hex 32` |

### Optional (per feature)

| Variable | Used for |
|----------|----------|
| `AI_GATEWAY_API_KEY` | Model calls, when not running on Vercel — see below |
| `FIRECRAWL_API_KEY` | `url_reader` scraping and URL validation |
| `TAVILY_API_KEY` | `web_search` tiles, bot web search |
| `SENDGRID_API_KEY` | Magic-link emails, invitations, `offer_sender` delivery |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `SLACK_SIGNING_SECRET` | Slack OAuth, bot, signature verification |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | `github_issue` tiles |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Sheets sync from `catalog` tiles |
| `NEXT_PUBLIC_APP_URL` | Base URL for Slack/GitHub/Google OAuth redirect URIs |
| `NEXT_PUBLIC_SITE_URL` | Base URL used in magic-link and invitation emails |

All model calls (text generation and embeddings) go through the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway); no provider API key is needed. On Vercel, and locally after `vercel env pull .env.local`, auth uses the provisioned `VERCEL_OIDC_TOKEN` (valid ~24h locally — re-pull when it expires). Elsewhere, set `AI_GATEWAY_API_KEY` instead.

GitHub and Google OAuth credentials are configured per [Integrations](integrations.md).

## 3. Start the database

### Local Supabase (recommended)

Run Supabase in Docker. `supabase start` applies every migration in
`supabase/migrations/` to a fresh database:

```bash
bunx supabase start
bunx supabase status -o env   # URLs and keys for .env.local
```

Point `.env.local` at the local stack. These keys are the Supabase CLI's fixed
local-development keys:

```bash
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<PUBLISHABLE_KEY from status>"
SUPABASE_SECRET_KEY="<SECRET_KEY from status>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Studio runs at http://127.0.0.1:54323. Apply new migrations with
`bunx supabase migration up --local`, or rebuild from scratch with
`bunx supabase db reset`. Stop the stack with `bunx supabase stop`.

Do not use `vercel env pull` for the Supabase variables: they are marked
sensitive on Vercel and pull as empty strings. The pull also writes
production-only `VERCEL_*` system variables.

### Hosted project

```bash
bunx supabase link --project-ref <your-project-ref>
bunx supabase db push
```

Migrations include the schema, RLS policies, RPC functions for atomic rate
limiting, and the pgvector extension for the tile router. New tables and
functions must grant their own privileges to `anon`, `authenticated` and
`service_role` (see `00021_explicit_api_role_grants.sql`); current Supabase
versions no longer grant them by default.

## 4. Allowlist your email

Signup is invite-only via the `allowlist` table. Insert your email in Studio's
SQL editor:

```sql
insert into allowlist (email, is_active) values ('you@example.com', true);
```

## 5. Run the dev server

```bash
bun run dev
```

Open http://localhost:3000 and sign in via magic link. In development without
`SENDGRID_API_KEY`, emails are not sent; the dev server console prints them,
including the magic link.

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
