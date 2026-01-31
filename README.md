This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Documentation

For a detailed technical overview, please refer to the [Project Specification](docs/specification.md).

## Version History

### 1.0.0 (2026-01-31)

**BREAKING CHANGES:**
- Complete architecture refactor from Agent system to Mosaic/Tile model
- Legacy agent tables and APIs removed
- New V1 API structure (`/api/v1/tiles/[tileId]/*`)

**New Features:**
- Mosaic workspaces with visual tile canvas
- Magic link authentication (passwordless email-based login)
- Tile connections for data pipelines between tiles
- Member invitation and ownership transfer
- Runtime URL sources for url_reader tiles
- Advanced scheduler with hourly resolution and day-of-week selection
- Per-mosaic timezone configuration
- Security guards and rate limiting (per-user hourly and concurrent limits)
- Tile drawer with API curl examples and request/response schemas

**Improvements:**
- Auto-generated mosaic names
- Pending invitations UI
- Database schema cleanup (tile_reports → tile_job_results)

### 0.5.0 (2026-01-31)

- Advanced scheduler: Custom cron schedules with hourly resolution and day-of-week selection
- Timezone support: Per-mosaic timezone settings, cron respects configured timezone
- Tile drawer improvements: API curl examples, request/response schemas, scrollable tabs
- Database cleanup: Renamed tile_reports to tile_job_results, removed legacy agent tables
- UI improvements: Client-side navigation for mosaic creation, auto-close dialogs

### 0.4.0 (2026-01-28)

- Source types system: agents can now use URL sources or other agents' reports as input
- Agent-as-source feature enables chaining agents for multi-stage analysis pipelines
- Circular dependency detection prevents invalid agent reference loops
- Unified content fetcher handles both web scraping and agent report retrieval
- Updated wizard and source list UI with type selection (Web URL / Agent Report)
- Database migration adds source_type enum, reference columns, and RLS policies
- Skills system integration for agent customization

### 0.3.0 (2026-01-27)

- Agent toggle switch for enabling/disabling agents directly from cards
- Invite request form and workflow for marketing page
- Vercel Analytics integration
- Removed description field from agent creation wizard
- Fixed Supabase security linter warnings
- Updated OpenAPI specification with missing schemas and security specs

### 0.2.0 (2026-01-25)

- Core application scaffold with full authentication flow (login, signup, OAuth callback)
- Dashboard with agent management: create, edit, view, and run agents
- Reports system for viewing and filtering analysis results
- Marketing landing page
- API routes for agent execution, cron triggers, and allowlist verification
- UI component library with shadcn/ui and Radix primitives
- Supabase database migrations and TypeScript type definitions
- Proxy middleware and Vercel deployment configuration

### 0.1.1 (2026-01-25)

- Added CLAUDE.md for Claude Code guidance
- Added technical specification document (docs/specification.md)
- Updated README with documentation link

### 0.1.0 (Initial)

- Initial Next.js 16 project setup with App Router
- TypeScript, Tailwind CSS v4, ESLint configuration
