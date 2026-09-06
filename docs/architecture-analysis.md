# Mosaic AI — Architectural Ecosystem Analysis

---

# 1. Thesis of the Whole

Mosaic AI is a serverless intelligence automation platform that treats heterogeneous data sources — web pages, search engines, Slack channels, GitHub repositories, and upstream analysis outputs — as uniform inputs to composable, AI-driven processing units called Tiles. These Tiles are arranged on visual canvases (Mosaics), connected into directed acyclic execution graphs with cascade triggering, and scheduled or invoked on demand. The system solves the operational problem of continuous, structured intelligence gathering from fragmented digital sources by abstracting away the mechanics of fetching, transforming, analyzing, and delivering information — reducing what would otherwise be a manual, repetitive, multi-tool workflow into a configurable, self-executing pipeline with built-in safety guards, rate limiting, multi-workspace collaboration, and output delivery to Slack, webhooks, and Google Sheets. The codebase encodes a developer who thinks in terms of data flow orchestration, execution safety, and product-grade abstraction over raw infrastructure.

---

# 2. Main System Object

**The Tile.**

The Tile is the atomic unit of computation, configuration, and composition. Every meaningful operation in the system — fetching, searching, analyzing, cataloging, creating issues, reading channels — is expressed as a Tile with a type, a set of sources, a prompt, a schedule, and output configuration. Tiles are polymorphic: `url_reader`, `web_search`, `analyzer`, `slack_reader`, `catalog`, `github_issue`, `knowledge_base`. They are composable: Tiles connect to other Tiles via `tile_connections`, forming execution chains with cycle detection, depth limits, and cascading triggers. They are observable: every execution produces a `tile_job` with metadata, results, logs, and webhook deliveries. The entire system — its database schema, its API routes, its UI components, its bot tools, its cron scheduler — orbits the Tile as the central abstraction.

---

# 3. Ecosystem Map

## Domains

| Domain | Scope |
|--------|-------|
| **Content Acquisition** | Web scraping (Tavily/Firecrawl), web search (Tavily), Slack channel reading, tile report fetching |
| **AI Analysis** | LLM-driven content analysis, entity/event extraction, keyword extraction, prompt composition |
| **Execution Orchestration** | Job lifecycle, cascading triggers, execution context propagation, timeout/depth/cycle guards |
| **Integration Management** | OAuth flows (Slack, GitHub), token resolution, multi-workspace support |
| **Output Delivery** | Slack messaging, webhook dispatch with retry, Google Sheets append |
| **Collaboration** | Mosaic sharing, role-based access (owner/admin/member), invitation system |
| **Catalog Management** | Persistent entity tracking, schema detection, event chronology, diff computation |
| **Bot Interface** | Conversational access to tiles via Slack bot (Chat SDK), tool-calling with Gemini |
| **Tile Routing** | Semantic search over tile embeddings, LLM-based tile selection for natural language queries |
| **Platform Operations** | Rate limiting, data retention, API key management, cron scheduling, SSE streaming |

## Contexts

- **Canvas Context**: Visual workspace where users arrange tiles on a grid, draw connections, and observe execution state
- **Drawer Context**: Plugin-based configuration panel for individual tile settings (sources, prompts, outputs, webhooks)
- **Execution Context**: Runtime state object tracking chain depth, visited tiles, timeout budget, and execution lineage
- **Bot Context**: Conversational interface where Slack users query and trigger tiles via natural language
- **API Context**: Programmatic access with API keys, SSE streaming, and webhook callbacks

## Actors

| Actor | Role |
|-------|------|
| **Mosaic Owner** | Creates workspaces, manages members, configures tiles |
| **Mosaic Member** | Views and operates tiles within shared workspaces |
| **Cron Scheduler** | Vercel Cron triggers tile execution at configured intervals |
| **Slack Bot** | Conversational agent responding to mentions and DMs |
| **API Consumer** | External system triggering tiles and receiving results via API |
| **Downstream Tile** | Auto-triggered tile consuming upstream output |

## External Systems

| System | Integration Point | Protocol |
|--------|-------------------|----------|
| **Supabase** | Database, Auth, RLS, RPC functions | PostgreSQL, REST |
| **Vercel AI Gateway** (Gemini Flash) | Content analysis, entity extraction, prompt improvement | Vercel AI SDK |
| **Tavily** | Web search, URL extraction, content scraping | REST API |
| **Firecrawl** | Legacy web scraping | REST API |
| **Slack** | Channel reading, message posting, OAuth, Events API, bot | REST + WebSocket |
| **GitHub** | Issue creation, repo listing, OAuth | Octokit REST |
| **SendGrid** | Invitation and magic link emails | REST API |
| **Vercel** | Hosting, cron jobs, serverless functions | Platform |
| **Google Sheets** | Data append (optional output) | API |

---

# 4. Architecture Map

## Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│  Next.js App Router │ React 19 │ Tailwind v4 │ Radix UI        │
│  Route Groups: (marketing) │ (auth) │ (app)                    │
│  Canvas │ Tile Drawer (plugin system) │ Mosaic Management       │
├─────────────────────────────────────────────────────────────────┤
│                     API / GATEWAY LAYER                         │
│  REST Routes │ Server Actions │ SSE Streaming │ Cron Endpoint   │
│  API Key Auth │ Supabase Session Auth │ Slack Signature Verify  │
├─────────────────────────────────────────────────────────────────┤
│                     ORCHESTRATION LAYER                         │
│  ExecutionContext │ Rate Limiter │ Timeout Guard │ Cascade       │
│  Cycle Detection │ Depth Limiting │ Content Size Management     │
├─────────────────────────────────────────────────────────────────┤
│                     PROCESSING LAYER                            │
│  Gemini Analysis │ Catalog Execution │ GitHub Issue Execution   │
│  Prompt Composition │ Output Format Parsing │ Schema Validation  │
├─────────────────────────────────────────────────────────────────┤
│                     DATA ACQUISITION LAYER                      │
│  Tile Content Fetcher │ Tavily Search/Extract │ Slack Client     │
│  URL Extraction │ Keyword Extraction │ Connection Resolution    │
├─────────────────────────────────────────────────────────────────┤
│                     INTEGRATION LAYER                           │
│  Slack OAuth + Bot │ GitHub OAuth │ SendGrid │ Webhook Delivery  │
│  Token Resolution Chain │ Multi-workspace Support               │
├─────────────────────────────────────────────────────────────────┤
│                     PERSISTENCE LAYER                           │
│  Supabase PostgreSQL │ RLS │ RPC Functions │ pgvector           │
│  Three-tier client (Browser / Server / Admin)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Flow of Control (Tile Execution)

```
Trigger (Cron / Manual / API / Bot / Cascade)
  │
  ├─► Rate Limit Check (atomic RPC)
  ├─► Create ExecutionContext (timeout, depth, visited set)
  ├─► Create TileJob (status: pending → processing)
  │
  ├─► Content Fetching (parallel, 3 concurrent)
  │   ├─ URL sources → Tavily Extract
  │   ├─ Search sources → Tavily Search
  │   ├─ Slack sources → Slack API
  │   └─ Connection sources → upstream TileJobResult
  │
  ├─► AI Processing (type-dependent)
  │   ├─ Standard → Gemini analyzeContent()
  │   ├─ Catalog → executeCatalogUpdate() (schema + entities + events)
  │   └─ GitHub Issue → executeGitHubIssue() (LLM → Octokit)
  │
  ├─► Persist Result (TileJobResult + job metadata)
  ├─► Output Delivery (fire-and-forget)
  │   ├─ Slack output → channel post
  │   └─ Webhooks → HTTP with retry
  │
  ├─► Cascade Trigger (fire-and-forget)
  │   └─ Downstream tiles with trigger_on_source_update
  │
  └─► Cleanup (decrement concurrent count, log events)
```

## Dependency Direction

- Presentation → API → Orchestration → Processing → Acquisition → Integration → Persistence
- No upward dependencies. Server actions bridge Presentation ↔ Persistence directly for CRUD.
- Integration layer is laterally accessed by Acquisition (token resolution) and Output (delivery).

## State Boundaries

| Boundary | State Type | Mechanism |
|----------|-----------|-----------|
| Client-side | UI state, form state, polling | React hooks, localStorage |
| Server actions | Stateless request-response | Supabase session, revalidatePath |
| Execution runtime | ExecutionContext (in-memory, per-chain) | Object propagation |
| Database | Persistent state, audit trail | Supabase PostgreSQL + RLS |
| External services | OAuth tokens, API keys | user_integrations table |

---

# 5. ASCII System Structure

```
                           ┌──────────────────────┐
                           │     SLACK BOT         │
                           │  Chat SDK + Adapter   │
                           │  Tools: list, run,    │
                           │  search, web_search   │
                           └──────────┬───────────┘
                                      │ mentions/DMs
┌──────────────┐  ┌──────────────┐    │    ┌──────────────────┐
│  MARKETING   │  │   AUTH       │    │    │   MOSAIC CANVAS   │
│  Landing     │  │   Magic Link │    │    │   Grid Layout     │
│  Page        │  │   Allowlist  │    │    │   Tile Cards      │
│              │  │   OAuth      │    │    │   Connections      │
└──────────────┘  └──────────────┘    │    │   Drag & Drop     │
                                      │    └────────┬─────────┘
                                      │             │
                    ┌─────────────────┴─────────────┴──────────┐
                    │              API GATEWAY                   │
                    │                                           │
                    │  /api/tiles/run      (manual, session)    │
                    │  /api/cron/trigger   (scheduled, secret)  │
                    │  /api/v1/tiles/run   (API key, SSE)       │
                    │  /api/slack/events   (bot, signature)     │
                    │  /api/v1/router      (semantic query)     │
                    └─────────────────┬────────────────────────┘
                                      │
                    ┌─────────────────┴────────────────────────┐
                    │         EXECUTION ORCHESTRATOR            │
                    │                                           │
                    │  ┌──────────┐ ┌─────────┐ ┌───────────┐ │
                    │  │ Rate     │ │Execution│ │ Timeout   │ │
                    │  │ Limiter  │ │ Context │ │ Guard     │ │
                    │  │ 100/hr   │ │ depth=5 │ │ 5min def  │ │
                    │  │ 3 conc.  │ │ cycles  │ │ 10min max │ │
                    │  └──────────┘ └─────────┘ └───────────┘ │
                    └─────────────────┬────────────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
┌─────────┴────────┐  ┌──────────────┴──────────┐  ┌────────────┴───────┐
│  CONTENT FETCHER │  │   AI PROCESSING          │  │  OUTPUT DELIVERY   │
│                  │  │                           │  │                    │
│  URL → Tavily    │  │  Standard → Gemini       │  │  Slack → mrkdwn    │
│  Search → Tavily │  │  Catalog → Entity/Event  │  │  Webhook → Retry   │
│  Slack → API     │  │  GitHub → Issue Create   │  │  Sheets → Append   │
│  Connection →    │  │  Router → Embed+Reason   │  │                    │
│    upstream tile  │  │                           │  │                    │
│                  │  │  Prompt Composition:      │  │  Cascade Trigger:  │
│  500KB/source    │  │  system + format + lang   │  │  downstream tiles  │
│  2MB total       │  │  + content                │  │  depth ≤ 5         │
│  3 concurrent    │  │                           │  │  cycle detection   │
└──────────────────┘  └──────────────────────────┘  └────────────────────┘
          │                           │                           │
          └───────────────────────────┼───────────────────────────┘
                                      │
                    ┌─────────────────┴────────────────────────┐
                    │           INTEGRATION LAYER               │
                    │                                           │
                    │  Slack OAuth ──► user_integrations        │
                    │  GitHub OAuth ──► user_integrations       │
                    │  Token Resolution: tile→mosaic→owner→DB  │
                    │  SendGrid: invitations + magic links     │
                    │  API Keys: msk_<hash> + expiry           │
                    └─────────────────┬────────────────────────┘
                                      │
                    ┌─────────────────┴────────────────────────┐
                    │           SUPABASE (POSTGRESQL)           │
                    │                                           │
                    │  mosaics ─┬─ tiles ─┬─ tile_sources      │
                    │           │         ├─ tile_connections   │
                    │           │         ├─ tile_jobs          │
                    │           │         │  └─ tile_job_results│
                    │           │         ├─ tile_webhooks      │
                    │           │         ├─ tile_skills        │
                    │           │         └─ catalog_*          │
                    │           ├─ mosaic_members               │
                    │           └─ mosaic_api_keys              │
                    │                                           │
                    │  user_integrations │ user_rate_limits     │
                    │  allowlist │ tile_embeddings (pgvector)   │
                    │                                           │
                    │  RLS on all tables │ RPC for atomics      │
                    └──────────────────────────────────────────┘
```

---

# 6. Module Inventory by Functional Semantics

## 6.1 Tile Content Fetcher

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/sources/tile-content-fetcher.ts` |
| **Verb** | Fetches, aggregates, truncates |
| **Noun** | Web content, search results, Slack messages, upstream tile reports |
| **Adjective** | Resilient, size-bounded, concurrent, type-polymorphic |
| **Tech** | Tavily API, Slack API, Supabase queries, Promise concurrency |
| **Input** | TileSource[], TileConnection[], ExecutionContext |
| **Output** | TileSourceContent[] (unified content envelope) |
| **Dependencies** | Tavily client, Slack client, integration resolver, execution context |
| **Context** | Called by all three execution entry points before AI analysis |
| **Problem** | Heterogeneous data sources must be normalized into a uniform content stream for LLM consumption without exceeding memory/token budgets |
| **Reuse** | Any system needing multi-source content aggregation with size and concurrency control |

## 6.2 Execution Context

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/execution/context.ts`, `lib/execution/timeout.ts` |
| **Verb** | Tracks, guards, propagates |
| **Noun** | Execution chains, timeouts, cycles, depth |
| **Adjective** | Safe, deterministic, composable |
| **Tech** | TypeScript class, Set-based cycle detection, Promise.race |
| **Input** | Root tile ID, user ID, config (max depth, timeout) |
| **Output** | ExecutionContext object with assertion methods |
| **Dependencies** | None (pure logic) |
| **Context** | Created at execution start, propagated through cascade chain |
| **Problem** | Recursive tile execution can loop, hang, or exhaust resources without explicit guards |
| **Reuse** | Any DAG execution engine, workflow orchestrator, or recursive task runner |

## 6.3 Rate Limiter

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/rate-limit/limiter.ts` |
| **Verb** | Limits, counts, gates |
| **Noun** | User executions (hourly count + concurrent slots) |
| **Adjective** | Atomic, race-free, auditable |
| **Tech** | Supabase RPC (PostgreSQL functions), atomic check-and-increment |
| **Input** | User ID |
| **Output** | RateLimitResult { allowed, currentCount, resetsAt, reason } |
| **Dependencies** | Supabase admin client |
| **Context** | Gate before every tile execution across all entry points |
| **Problem** | Multi-tenant serverless system needs per-user resource protection without distributed locks |
| **Reuse** | Any multi-tenant SaaS with per-user quotas on expensive operations |

## 6.4 AI Analysis Engine

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/ai/gemini.ts` |
| **Verb** | Analyzes, classifies, structures |
| **Noun** | Fetched content → structured intelligence reports |
| **Adjective** | Configurable, multilingual, format-aware |
| **Tech** | Vercel AI SDK via AI Gateway, Gemini Flash, Zod schema validation |
| **Input** | Content array, system prompt, output format, language, optional schema |
| **Output** | AnalysisResult { content (JSON/text), debug info, token usage } |
| **Dependencies** | Vercel AI SDK, AI Gateway model config |
| **Context** | Core processing step for standard tiles (url_reader, web_search, analyzer) |
| **Problem** | Raw fetched content must be transformed into actionable, structured intelligence per user instructions |
| **Reuse** | Any LLM-powered content analysis pipeline with configurable output formats |

## 6.5 Catalog Execution Engine

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/catalog/execute-catalog.ts` |
| **Verb** | Detects schema, extracts entities, tracks events, computes diffs |
| **Noun** | Entities, events, schemas, catalog entries |
| **Adjective** | Stateful, incremental, deduplicating |
| **Tech** | Gemini LLM, Supabase CRUD, match_key normalization |
| **Input** | Fetched content, existing catalog state |
| **Output** | CatalogDiff { added, updated, new_events } |
| **Dependencies** | Gemini, Supabase admin, catalog schema/entries/events tables |
| **Context** | Specialized execution path for catalog-type tiles |
| **Problem** | Continuous monitoring must produce structured, deduplicated entity databases — not just reports |
| **Reuse** | Any system needing AI-driven entity extraction with persistent tracking (CRM enrichment, competitive intelligence, asset tracking) |

## 6.6 GitHub Issue Execution

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/github/execute-github-issue.ts`, `lib/github/create-issue.ts` |
| **Verb** | Generates, creates, labels |
| **Noun** | GitHub issues from analyzed content |
| **Adjective** | Multi-repo, OAuth-secured, skill-templated |
| **Tech** | Octokit, Gemini LLM, OAuth token resolution |
| **Input** | Fetched content, system prompt, GitHub config, target repo |
| **Output** | GitHubIssueExecutionResult { created issues with numbers/URLs } |
| **Dependencies** | GitHub OAuth integration, Gemini, Octokit |
| **Context** | Specialized execution path for github_issue-type tiles |
| **Problem** | Intelligence findings must be converted into actionable engineering artifacts without manual transcription |
| **Reuse** | Any AI-to-ticketing pipeline (Jira, Linear, Asana) |

## 6.7 Downstream Cascade Trigger

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/tiles/trigger-downstream.ts` |
| **Verb** | Cascades, triggers, propagates |
| **Noun** | Downstream tiles connected via tile_connections |
| **Adjective** | Safe (cycle-aware, depth-limited, rate-checked), non-blocking |
| **Tech** | Promise.allSettled, ExecutionContext propagation, Supabase queries |
| **Input** | Source tile ID, execution context, admin client |
| **Output** | Triggered job IDs (fire-and-forget) |
| **Dependencies** | Execution context, rate limiter, tile-content-fetcher (recursive) |
| **Context** | Post-execution step enabling data pipeline behavior |
| **Problem** | Tiles must compose into multi-stage pipelines without manual re-triggering |
| **Reuse** | Any event-driven pipeline with dependency-ordered execution |

## 6.8 Slack Integration Suite

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/slack/client.ts`, `lib/slack/integration.ts`, `lib/slack/oauth.ts`, `lib/slack/verify-signature.ts` |
| **Verb** | Authenticates, reads, posts, verifies |
| **Noun** | Slack workspaces, channels, messages, threads, tokens |
| **Adjective** | Multi-workspace, OAuth-secured, thread-aware, replay-protected |
| **Tech** | Slack Web API, HMAC-SHA256, OAuth 2.0, Supabase token storage |
| **Input** | User/workspace context |
| **Output** | Messages, channel metadata, formatted content |
| **Dependencies** | user_integrations table, Supabase admin client |
| **Context** | Both input (slack_reader tiles) and output (slack_output delivery) |
| **Problem** | Enterprise messaging must be both a data source and a delivery channel with proper auth |
| **Reuse** | Any Slack-integrated SaaS (bidirectional messaging, channel monitoring, bot framework) |

## 6.9 Chat Bot (Slack)

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/bot/index.ts`, `lib/bot/handlers.ts`, `lib/bot/tools.ts`, `lib/bot/data.ts` |
| **Verb** | Listens, reasons, executes, responds |
| **Noun** | Slack mentions and DMs → tile operations |
| **Adjective** | Tool-calling, context-aware, user-resolved |
| **Tech** | Chat SDK, @chat-adapter/slack, Gemini (tool use), Supabase |
| **Input** | Slack events (mentions, DMs) |
| **Output** | Conversational responses with tile data, execution results |
| **Dependencies** | Full execution pipeline, tile routing, Slack integration |
| **Context** | Alternative interface — users operate the system via natural language in Slack |
| **Problem** | Not all users want to open a web UI; intelligence should be accessible conversationally |
| **Reuse** | Any SaaS adding a conversational interface over existing capabilities |

## 6.10 Tile Router

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/router/index.ts`, `lib/router/embed.ts`, `lib/router/search.ts`, `lib/router/reason.ts`, `lib/router/enrich.ts` |
| **Verb** | Embeds, searches, reasons, selects |
| **Noun** | Natural language queries → best-matching tiles |
| **Adjective** | Semantic, LLM-augmented, vector-indexed |
| **Tech** | Gemini embeddings via AI Gateway, pgvector, Gemini reasoning |
| **Input** | User query, mosaic context |
| **Output** | RouterResult { selected_tiles with justification and confidence } |
| **Dependencies** | tile_embeddings table, Gemini, Supabase |
| **Context** | Used by bot and API to resolve "what tile should handle this query?" |
| **Problem** | Users may not know which tile to run — the system must infer intent from natural language |
| **Reuse** | Any multi-agent or multi-tool system needing intent-based routing |

## 6.11 Webhook Delivery System

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/actions/webhooks.ts` |
| **Verb** | Delivers, retries, tracks |
| **Noun** | HTTP webhook payloads to external endpoints |
| **Adjective** | Retry-capable, auth-flexible, auditable |
| **Tech** | fetch, exponential backoff, Supabase delivery tracking |
| **Input** | Tile job result, webhook config (URL, auth type, events) |
| **Output** | Delivery record (status, response body, attempt count) |
| **Dependencies** | Supabase admin client |
| **Context** | Post-execution output channel for external system integration |
| **Problem** | External systems need reliable notification of tile execution results |
| **Reuse** | Any event-driven system needing outbound webhook delivery with retry |

## 6.12 SSE Streaming Writer

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/api/sse.ts` |
| **Verb** | Streams, serializes, delivers |
| **Noun** | Execution progress events to API consumers |
| **Adjective** | Real-time, typed, progressive |
| **Tech** | Server-Sent Events, ReadableStream, JSON serialization |
| **Input** | Execution events (started, progress, connection, result, done, error) |
| **Output** | SSE text/event-stream response |
| **Dependencies** | None (pure streaming utility) |
| **Context** | V1 API endpoint for real-time execution monitoring |
| **Problem** | Long-running tile executions need progressive status updates, not polling |
| **Reuse** | Any API needing real-time progress streaming |

## 6.13 Email Delivery (SendGrid)

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/email/sendgrid.ts` |
| **Verb** | Renders, sends |
| **Noun** | Invitation emails, magic link emails |
| **Adjective** | Branded, template-cached, dual-format (HTML + plaintext) |
| **Tech** | SendGrid API, HTML template rendering, file caching |
| **Input** | Recipient, token/link, template data |
| **Output** | Email delivery (fire-and-forget) |
| **Dependencies** | SendGrid API key, HTML templates |
| **Context** | Auth flow (magic links) and collaboration (invitations) |
| **Problem** | Passwordless auth and team invitations require branded, reliable email delivery |
| **Reuse** | Any SaaS needing transactional email with template support |

## 6.14 API Key Authentication

| Attribute | Value |
|-----------|-------|
| **Module** | `lib/api/auth.ts` |
| **Verb** | Validates, resolves, tracks |
| **Noun** | API keys (msk_ prefix, SHA-256 hashed) |
| **Adjective** | Hashed-at-rest, expiry-aware, usage-tracked |
| **Tech** | SHA-256, Supabase lookup, header/query extraction |
| **Input** | Authorization header or query parameter |
| **Output** | Validated key with mosaic context |
| **Dependencies** | Supabase admin client, mosaic_api_keys table |
| **Context** | V1 API authentication for programmatic tile access |
| **Problem** | External systems need secure, revocable, scoped access to tile APIs |
| **Reuse** | Any SaaS with programmatic API access |

## 6.15 Plugin-Based Tile Drawer UI

| Attribute | Value |
|-----------|-------|
| **Module** | `components/tiles/tile-drawer/` |
| **Verb** | Configures, visualizes, operates |
| **Noun** | Tile configuration (sources, prompts, outputs, webhooks, logs) |
| **Adjective** | Modular, section-colored, collapsible, plugin-extensible |
| **Tech** | React, Radix UI Collapsible, localStorage, dnd-kit |
| **Input** | TileWithSources, mosaic context |
| **Output** | Server action mutations (tile updates, source CRUD, webhook CRUD) |
| **Dependencies** | Server actions, Supabase client, useTileDrawerState hook |
| **Context** | Primary UI for tile configuration — opened from canvas |
| **Problem** | Complex multi-faceted tile configuration must be navigable without overwhelming the user |
| **Reuse** | Any product needing a modular, extensible configuration panel (plugin architecture pattern) |

---

# 7. Hidden Developer Experience Encoded in the Repository

## 7.1 Solved Problem Classes

| Problem Class | Evidence |
|---------------|----------|
| **Multi-source data aggregation** | Unified TileSourceContent envelope normalizing URLs, search, Slack, upstream tiles |
| **Recursive execution safety** | ExecutionContext with cycle detection, depth limits, timeout guards — not afterthoughts but first-class design |
| **Multi-tenant resource protection** | Atomic RPC-based rate limiting with both hourly and concurrent dimensions |
| **OAuth multi-workspace management** | provider_team_id pattern allowing multiple Slack workspaces per user |
| **LLM output structure enforcement** | JSON parsing with fallback, format instructions, schema validation, code fence stripping |
| **Real-time progress streaming** | Typed SSE protocol with per-source granularity |
| **Cascading event propagation** | DAG-based trigger system with visited-set cycle prevention |
| **Entity deduplication at scale** | match_key normalization in catalog, batch dedup for events |

## 7.2 Operational Environments

- **Serverless**: Architecture designed for Vercel's serverless model — no persistent processes, cron-as-HTTP, execution timeout awareness
- **Multi-tenant SaaS**: Per-user rate limiting, workspace-scoped API keys, role-based access, email allowlist
- **Enterprise messaging**: Deep Slack integration (OAuth, events, channels, threads, reactions, bot)
- **AI-native operations**: LLM as core processing engine, not bolted on — prompt composition, output parsing, schema detection all handled systematically

## 7.3 Architecture Maturity

| Signal | Evidence |
|--------|----------|
| **Layered separation** | Clear lib/ domain separation: actions, ai, execution, sources, outputs, integrations |
| **Guard-first design** | Assertions (`assertNotTimedOut`, `assertNoCycle`, `assertCanIncreaseDepth`) precede operations |
| **Fire-and-forget pattern** | Non-critical operations (Slack output, webhooks, logging, cascade) don't block the critical path |
| **Three-tier Supabase clients** | Browser/Server/Admin separation with appropriate RLS behavior |
| **Content budget management** | 500KB per source, 2MB total — explicit constraints, not implicit OOMs |
| **Metadata enrichment** | Every job carries provenance: trigger type, cascade depth, source breakdown, execution timing |

## 7.4 Product Thinking

| Signal | Evidence |
|--------|----------|
| **Vocabulary abstraction** | Internal terms (cron, prompt, Firecrawl) hidden from users behind friendly labels |
| **Visual identity system** | Tiles have colors and patterns — the product thinks in visual metaphors, not database rows |
| **DAW-inspired aesthetic** | MPC-pad grid, LED indicators, glow-pulse animations — deliberate design language |
| **Multi-channel access** | Same capabilities via canvas UI, API, Slack bot — product-level thinking about user contexts |
| **Skill templates** | Pre-built prompt templates (Blog Post, Bugfix, Feature Request) reduce time-to-value |
| **Invitation and allowlist** | Controlled access indicates deliberate go-to-market strategy |

## 7.5 Automation Maturity

- Cron scheduling with timezone awareness per mosaic
- Cascading tile execution with configurable `trigger_on_source_update`
- Webhook delivery with retry and audit trail
- Data retention automation (90-day logs, 30-day webhooks)
- Bot-triggered execution from conversational context

## 7.6 Integration Maturity

- OAuth flow implemented for Slack and GitHub with proper token storage and multi-workspace support
- Token resolution chain pattern (tile → mosaic → owner → integration) reused across providers
- Webhook system with auth types (none, bearer, basic, header) and delivery tracking
- SSE protocol for real-time API consumers

## 7.7 Maintainability Discipline

- TypeScript strict mode throughout
- Auto-generated database types from Supabase schema
- Server actions with `"use server"` directive — clear boundary between client and server
- Structured error classes (RateLimitError, TimeoutError, ExecutionGuardError) with metadata
- Supabase error extraction utilities for debugging

## 7.8 Business-Awareness Traces

- **Intelligence gathering** as a product category — the developer understands that organizations need continuous, automated monitoring of digital sources
- **Collaboration features** (sharing, roles, invitations) indicate B2B orientation
- **API + webhooks** indicate platform positioning — the system is designed to be embedded in larger workflows
- **Catalog tiles** (entity tracking with diffs) indicate awareness of the gap between "reports" and "structured knowledge bases"

---

# 8. Transferable Mechanisms and Dual-Use Opportunities

## 8.1 Execution Context with Safety Guards

**What**: A composable execution context that tracks chain state (depth, visited nodes, timeout budget) and provides assertion-based guards against cycles, timeouts, and depth overflow.

**Why portable**: The pattern is pure logic — no framework dependency. Any system with recursive or cascading execution needs these exact guards.

**Where applicable**: Workflow engines, CI/CD pipeline runners, recursive data processors, microservice orchestrators, game AI behavior trees, supply chain event propagation.

## 8.2 Multi-Source Content Aggregation Pipeline

**What**: A unified fetcher that normalizes heterogeneous sources (HTTP, search APIs, messaging APIs, upstream results) into a standard content envelope with size budgets and concurrency control.

**Why portable**: The envelope pattern (`{ sourceType, content, success, metadata, contentTruncated }`) decouples source specifics from downstream processing.

**Where applicable**: RAG pipelines, ETL systems, content aggregation platforms, news monitoring, competitive intelligence tools, research automation.

## 8.3 Atomic Rate Limiter via Database RPC

**What**: PostgreSQL function performing check-and-increment atomically, with both hourly and concurrent dimensions, returning structured results with reset times.

**Why portable**: Database-level atomicity eliminates distributed coordination. Pattern works anywhere with a relational database.

**Where applicable**: Any multi-tenant SaaS with metered API access, serverless function rate limiting, build queue management.

## 8.4 OAuth Token Resolution Chain

**What**: A tile → mosaic → owner → user_integrations lookup pattern that resolves OAuth tokens for any integration provider, supporting multi-workspace scenarios via provider_team_id.

**Why portable**: The chain pattern (resource → workspace → owner → credentials) is universal for multi-tenant OAuth.

**Where applicable**: Any SaaS integrating with third-party OAuth providers (CRM integrations, payment gateways, cloud service connections).

## 8.5 Plugin-Based Configuration UI

**What**: Section-colored, collapsible plugin cards with enable/disable toggles, localStorage persistence, and lazy data loading per section.

**Why portable**: The pattern (sections → plugins → collapse state → lazy load) is framework-agnostic in concept.

**Where applicable**: Any product with complex entity configuration (CI/CD pipeline editors, monitoring dashboards, API gateway management, form builders).

## 8.6 Typed SSE Streaming Protocol

**What**: A typed event protocol (`started`, `progress`, `connection`, `result`, `done`, `error`) over Server-Sent Events with JSON payloads and per-source granularity.

**Why portable**: SSE is widely supported and the typed event pattern is reusable with any event vocabulary.

**Where applicable**: Long-running API operations, build systems, deployment dashboards, file processing pipelines, AI inference endpoints.

## 8.7 AI Prompt Composition Pipeline

**What**: A modular prompt builder that composes system instructions + format directives + language settings + content, then parses output with format detection, code fence stripping, and JSON validation.

**Why portable**: Prompt composition and output parsing are universal LLM integration challenges.

**Where applicable**: Any LLM-powered application needing structured output, multilingual support, and robust output parsing.

## 8.8 Markdown-to-Slack-mrkdwn Converter

**What**: A converter protecting code blocks, transforming headers/bullets/links/tables from standard Markdown to Slack mrkdwn format, with chunking for Slack's block size limits.

**Why portable**: Slack's format is idiosyncratic — this converter encapsulates the translation.

**Where applicable**: Any system posting rich-text content to Slack (CI notifications, monitoring alerts, report delivery).

## 8.9 Cascading DAG Trigger Engine

**What**: A fire-and-forget downstream trigger system with cycle detection (visited set), depth limiting, duplicate prevention (check for existing processing jobs), and rate limit awareness.

**Why portable**: DAG execution with safety guards is a general pattern.

**Where applicable**: Data pipeline orchestration, build dependency resolution, event-driven microservice chains, approval workflows.

## 8.10 Catalog Entity Tracking with AI Schema Detection

**What**: A system that detects entity schemas from content, extracts and deduplicates entities by match_key, tracks chronological events per entity, and computes execution diffs.

**Why portable**: The schema-detect → extract → merge → diff pipeline is applicable to any domain needing AI-powered entity management.

**Where applicable**: CRM data enrichment, competitive intelligence databases, asset inventory management, regulatory entity tracking, knowledge graph construction.

---

# 9. Table of Contents That Orders the Developer's Experience

## I. Systems Architecture

### I.1 Serverless-Native Application Design
- Stateless execution model with in-memory context propagation
- Cron-as-HTTP-endpoint pattern for scheduled work
- Timeout-aware operations with hard abort capability
- Fire-and-forget patterns for non-critical side effects

### I.2 Multi-Tenant SaaS Platform Engineering
- Workspace-scoped resource isolation (Mosaics)
- Per-user rate limiting with atomic database operations
- Role-based access control (owner/admin/member)
- API key management with hashing, expiry, and usage tracking
- Email-based allowlist for controlled access

### I.3 Event-Driven Pipeline Orchestration
- Composable processing units (Tiles) connected via DAG
- Cascade triggering with safety guards (cycles, depth, timeout)
- Execution context propagation through recursive chains
- Multiple trigger sources (cron, manual, API, bot, cascade)

## II. AI & LLM Engineering

### II.1 LLM-Powered Content Analysis
- Prompt composition pipeline (system + format + language + content)
- Multi-format output handling (text, JSON, schema-validated)
- Code fence stripping, JSON parse recovery, array wrapping
- Multilingual instruction support (en, pl, es, it, de)

### II.2 AI-Driven Entity Extraction & Tracking
- Schema detection from unstructured content
- Entity deduplication via normalized match keys
- Chronological event tracking per entity
- Execution diff computation (added/updated/events)

### II.3 Semantic Routing & Intent Resolution
- Vector embedding generation and storage (pgvector)
- Semantic search with LLM-augmented query enrichment
- LLM reasoning for tile selection with confidence scoring

## III. Integration Engineering

### III.1 OAuth-Based Multi-Provider Integration
- OAuth 2.0 flows for Slack and GitHub
- Token storage with provider + team scoping
- Resolution chain pattern (resource → workspace → owner → token)
- Multi-workspace support (multiple Slack teams per user)

### III.2 Bidirectional Slack Integration
- Input: channel reading with thread support, time windowing, user resolution
- Output: markdown-to-mrkdwn conversion, block chunking, channel delivery
- Bot: Chat SDK with tool-calling, mention/DM handling, reaction-based UX
- Security: HMAC-SHA256 signature verification with replay protection

### III.3 Webhook & Event Delivery
- Outbound webhook delivery with configurable auth (none/bearer/basic/header)
- Exponential backoff retry strategy
- Delivery tracking with response capture and status history
- Per-tile webhook configuration with event filtering

### III.4 GitHub Integration
- OAuth token management with multi-repo support
- AI-to-issue pipeline (content → LLM → structured issues → Octokit)
- Skill templates for issue generation (Bugfix, Feature, Blog Post)

## IV. Data Engineering

### IV.1 Multi-Source Content Aggregation
- Unified source envelope normalizing URLs, search, Slack, upstream tiles
- Per-source and total size budgets (500KB/2MB)
- Concurrency-limited parallel fetching
- Content truncation with metadata preservation

### IV.2 Database Architecture
- PostgreSQL with Row-Level Security on all tables
- Three-tier client pattern (browser/server/admin)
- Atomic RPC functions for rate limiting
- Schema evolution via numbered migrations (12+)
- pgvector for semantic search embeddings

### IV.3 Real-Time Data Streaming
- Server-Sent Events with typed event protocol
- Per-source progress granularity
- Connection lifecycle management (started → progress → result → done)

## V. Frontend & Product Engineering

### V.1 Visual Workspace Design
- Grid-based canvas with drag-and-drop tile placement
- Connection visualization between tiles
- DAW-inspired aesthetic (MPC pads, LED indicators, glow animations)
- Color and pattern system for tile identification

### V.2 Plugin-Based Configuration Architecture
- Section-colored plugins (Input/Processing/Output/Status)
- Collapsible cards with localStorage state persistence
- Lazy data loading per active section
- Type-specific plugin rendering (tile type → available plugins)

### V.3 Product Abstraction Layer
- Technical terms hidden behind user-friendly vocabulary
- Skill templates reducing time-to-value
- Multi-channel access (canvas, API, Slack bot)
- Invitation-based collaboration model

## VI. Operational Engineering

### VI.1 Execution Safety
- Guard-first design with assertion functions
- Cycle detection via visited-set propagation
- Depth limiting with configurable max (default 5, hard max 10)
- Timeout enforcement via Promise.race + AbortController

### VI.2 Resource Protection
- Atomic rate limiting (100/hour, 3 concurrent per user)
- Content size budgets preventing memory exhaustion
- Data retention automation (90-day/30-day cleanup)
- Structured error classes with operational metadata

### VI.3 Observability
- Execution logging with event types (started, completed, failed, depth_exceeded, cycle_detected, rate_limited)
- Job metadata capturing trigger type, cascade depth, source breakdown
- Webhook delivery tracking with response capture
- Debug mode with full prompt and token usage in analysis results

## VII. Reusable Asset Inventory

### VII.1 Transferable Patterns
- Execution context with safety guards
- Multi-source content aggregation pipeline
- Atomic rate limiter via database RPC
- OAuth token resolution chain
- Plugin-based configuration UI
- Typed SSE streaming protocol
- AI prompt composition pipeline
- Cascading DAG trigger engine
- Catalog entity tracking with AI schema detection
- Markdown-to-Slack-mrkdwn converter

### VII.2 Strategic Technical Strengths
- End-to-end AI pipeline construction (fetch → analyze → deliver)
- Safety-first recursive execution
- Multi-provider OAuth with workspace isolation
- Product-grade UX over infrastructure complexity
- Conversational interface over existing programmatic capabilities

---

# 10. Strategic Compression

**This repository is evidence of a developer who has built a production-grade, multi-tenant AI orchestration platform that treats heterogeneous data sources as composable intelligence pipelines — encoding deep experience in serverless execution safety, multi-provider OAuth integration, LLM output structuring, DAG-based cascade orchestration, and the product discipline to abstract infrastructure complexity behind a visual, conversational, and API-driven interface.**
