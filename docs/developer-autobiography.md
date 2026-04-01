# The Compressed Professional Autobiography of a Codebase

**Reading Mosaic AI as encoded career, decision history, and operational memory**

---

## Prologue: What This Document Is

Every codebase is a fossil record. The strata are not geological — they are architectural. Each layer encodes not what the developer *knew* in theory, but what they *learned through consequence*. A 15-second Supabase timeout is not a design choice; it is a scar. A cycle detection guard is not defensive programming; it is a confession that cycles happened. A fire-and-forget `.catch()` is not a pattern — it is a policy that emerged from watching silent failures swallow debugging hours.

This document reads the Mosaic AI repository not as software, but as compressed autobiography.

---

## I. The Career Arc Encoded in the Migration Timeline

The database migration history (`supabase/migrations/00001_` through `00014_`) is the closest thing to a chronological memoir in the repository. Read in sequence, it reveals a product mind that iterates through concept refinement, not just feature addition.

### Phase 1: The Agent Concept (Migration 00001)

The system began with **agents** — autonomous intelligence-gathering tasks. The initial schema carries the DNA of someone who has built CRUD SaaS before: `mosaics` (workspaces), `tiles` (originally agents), `tile_sources` (inputs), `tile_jobs` (execution records), `tile_job_results` (outputs). The schema is normalized, RLS-enabled from day one, and includes an `allowlist` table for controlled access.

**What this tells us:** The developer did not start with a prototype and add security later. RLS on all tables from migration 00001 means they have shipped multi-tenant systems before and know that retrofitting row-level security is painful. The allowlist is a go-to-market decision embedded in schema — this is an invite-only product, not an open platform.

### Phase 2: The Recursive Problem (Migration 00002)

Migration 00002 removes the `recursive` tile type and converts existing rows to `analyzer`. This is the most revealing single migration in the entire history.

**What happened:** The developer created a tile type that could invoke other tiles recursively. It worked. Then it didn't — because recursion without guards creates infinite loops, timeout cascades, and resource exhaustion. Rather than patching the recursive type, they eliminated it entirely and made `analyzer` tiles handle the same use case with explicit connections instead of implicit recursion.

**What this tells us:** The developer learned — likely through a production incident — that implicit recursion in a distributed system is a trap. The fix was not a guard on recursion; it was a conceptual redesign. Recursion became *composition* (tile connections with explicit `trigger_on_source_update`). This is a pivotal architectural decision that separates naive agent systems from production-grade orchestration.

### Phase 3: The Cascade Invention (Migration 00003)

Migration 00003 adds `trigger_on_source_update` to `tile_connections`. This is the controlled replacement for recursion: explicit, opt-in, guard-protected cascade triggering.

**What this tells us:** The developer understood that the value of recursion was *data flow*, not *self-invocation*. They extracted the valuable behavior (downstream execution) from the dangerous mechanism (recursion) and reimplemented it as a DAG property. This is a pattern that separates systems thinkers from feature builders.

### Phase 4: The Slack Expansion (Migrations 00005–00007)

Three migrations for Slack integration: initial OAuth + channel reading (00005), the `slack_reader` tile type (00006), and multi-workspace support (00007). The third migration changes the unique constraint on `user_integrations` from `(user_id, provider)` to `(user_id, provider, provider_team_id)`.

**What this tells us:** The developer shipped single-workspace Slack support and then encountered a real customer (or their own) use case requiring multiple Slack workspaces. The constraint change is small but operationally significant — it means the developer has operated in environments where a single user belongs to multiple Slack organizations. This is enterprise-adjacent experience, not hobbyist.

### Phase 5: The Catalog Ambition (Migration 00008)

Migration 00008 introduces four new tables: `catalog_schemas`, `catalog_entries`, `catalog_entry_events`, `catalog_diffs`. This is the most complex single migration and represents a conceptual leap: tiles are no longer just *report generators* — they can maintain *persistent structured databases* that evolve over time.

**What this tells us:** The developer recognized that periodic reports are useful but insufficient. Real intelligence work requires tracking *entities* across time — who appeared, what changed, what events occurred. The catalog tile type transforms the system from a reporting tool into a knowledge management platform. This is product vision encoded in schema.

### Phase 6: The Embedding Layer (Migration 00012)

Adding pgvector embeddings for semantic tile routing. The embedding dimension is 768, explicitly reduced from Gemini's native 3072.

**What this tells us:** The developer made a deliberate storage/speed vs. precision tradeoff. They know that vector search at 768 dimensions with a liberal match threshold (0.3) plus LLM reasoning over candidates produces good-enough results at lower cost. This is the decision of someone who has worked with embeddings before and knows that brute-force dimensionality is not always the answer.

---

## II. The Scars: What the Guards Protect Against

Every defensive mechanism in a codebase is an autobiography of failure. The developer did not imagine these failure modes — they experienced them.

### The 15-Second Supabase Timeout

```typescript
const SUPABASE_FETCH_TIMEOUT_MS = 15_000;
```

In `lib/supabase/admin.ts`, every Supabase call is wrapped with a custom `fetchWithTimeout` that merges AbortController signals and clears timers in `finally()`. This is not defensive programming by textbook — it is a specific response to a specific incident.

**The scar:** Supabase queries hung. Maybe a connection pool exhausted. Maybe a slow query on a growing table. Maybe a network partition between Vercel and Supabase. The developer watched a tile execution hang indefinitely because a database call never returned. The fix was surgical: 15 seconds, not 10 (too aggressive for legitimate queries), not 30 (too long when the system has a 5-minute execution budget). The value 15 was *tuned*, not guessed.

### The Execution Context Guards

```typescript
assertNotTimedOut(context);
assertCanIncreaseDepth(context);
assertNoCycle(context, agentId);
```

Three assertions, three failure modes the developer has witnessed:

1. **Timeout:** A tile chain ran beyond its budget. Downstream tiles started after the root tile had already been processing for 4 minutes, leaving 60 seconds for a multi-source fetch + LLM analysis. The fix: check remaining budget *before* starting each operation, not just at the boundary.

2. **Depth overflow:** A tile connected to another, which connected to another, which connected to another... five levels deep, each fetching content and calling Gemini. The 5-minute timeout wasn't enough, and the LLM token costs compounded. The fix: hard depth limit at 5 (configurable up to 10, but 5 by default).

3. **Cycles:** Tile A triggers Tile B, which triggers Tile A. Without a visited-set, this creates an infinite loop bounded only by timeout. The fix: propagate a `Set<string>` of visited tile IDs through the execution chain. Simple, effective, zero-overhead.

**What these guards reveal:** The developer has built systems where *composition* is the primary value — and learned that composition without constraint is self-destruction. This is the central lesson of any pipeline or workflow system, and this developer has internalized it.

### The Content Size Budget

```typescript
const MAX_CONTENT_SIZE_PER_SOURCE = 500 * 1024;  // 500KB
const MAX_TOTAL_CONTENT_SIZE = 2 * 1024 * 1024;   // 2MB
```

Content is measured in UTF-8 byte length (not string `.length`), truncated with metadata preservation, and enforced both per-source and in aggregate.

**The scar:** A URL source returned a 12MB HTML page (perhaps a forum thread, a Wikipedia dump, or a government report). It passed through to the LLM, which either hit token limits, timed out, or produced garbage from context overflow. The fix: explicit budgets at two levels, with truncation indicators so downstream consumers know data was lost.

### The Rate Limiter's Fail-Closed Default

```typescript
if (error) {
  console.error("Rate limit check failed:", error);
  return { allowed: false, ... };
}
```

When the rate-limit RPC function fails (database down, network error), the system *rejects* the execution rather than allowing it through.

**What this tells us:** The developer understands the difference between fail-open (convenient, dangerous) and fail-closed (inconvenient, safe). They have operated systems where a failing gate allowed unbounded execution, leading to resource exhaustion or cost overruns. The choice is deliberate and reveals risk-management maturity.

---

## III. The Vocabulary Transition: Agent → Tile

The single most revealing naming decision in the codebase is the rename from "Agent" to "Tile."

### What "Agent" Meant

The original concept was an autonomous AI agent: it had sources, a prompt, and a schedule. It ran independently. The word "agent" implies autonomy, intelligence, and self-direction.

### What "Tile" Means

A tile is a visual, compositional unit. It sits on a canvas. It connects to other tiles. It has a color and a pattern. The word "tile" implies *composition*, *arrangement*, and *visual identity*.

### Why the Rename Matters

The rename is not cosmetic. It reflects a fundamental shift in product philosophy:

- **From autonomy to composition:** Agents act alone. Tiles compose together.
- **From AI-first to workflow-first:** "Agent" foregrounds the AI. "Tile" foregrounds the structure.
- **From technical to visual:** Users don't think in "agents." They think in "putting things together on a board."

The backward-compatibility artifacts are telling:
- `ExecutionContext` still uses `rootAgentId` and `visitedAgents` — the rename was product-facing, not infrastructure-deep
- `AgentReportSourceConfig` interface preserved with a comment: *"legacy 'Agent' naming preserved for compatibility"*
- Type aliases: `getTileReports = getTileJobResults` — bridging old and new vocabulary

**What this tells us:** The developer prioritizes user mental models over internal consistency. The cost of renaming every internal variable was higher than the cost of living with mixed terminology — and the benefit of the user-facing rename was worth the internal debt. This is a product decision, not an engineering one.

---

## IV. The Fire-and-Forget Doctrine

A recurring pattern across the codebase reveals a deliberate operational philosophy:

```typescript
// Slack output — fire and forget
deliverSlackOutput(adminClient, tile, result).catch((err) =>
  console.error("Failed to deliver Slack output:", err)
);

// Downstream triggers — fire and forget
triggerDownstreamTiles(adminClient, { ... }).catch((err) =>
  console.error("Failed to trigger downstream:", err)
);

// Webhook delivery — fire and forget
triggerTileWebhooks(tileId, "job.completed", { ... }).catch((err) =>
  console.error("Failed to trigger webhooks:", err)
);

// Execution logging — fire and forget
logTileJobExecutionEvent(adminClient, { ... }).catch((err) =>
  console.error("Failed to log event:", err)
);
```

The developer has established a clear boundary: **the critical path is content fetch → AI analysis → result persistence.** Everything else — Slack delivery, webhook dispatch, cascade triggering, event logging — is a side effect that must not block or fail the critical path.

Every fire-and-forget operation has a `.catch()` handler. This is not optional. The developer learned that unhandled promise rejections either crash Node processes or silently swallow errors — both unacceptable. The `.catch()` with `console.error` ensures that failures are *visible* but not *blocking*.

**What this tells us:** The developer has operated event-driven systems and learned the taxonomy of operations:
1. **Must succeed:** Job creation, result storage — synchronous, error-throwing
2. **Should succeed:** Slack output, webhooks — fire-and-forget with logging
3. **Nice to succeed:** Execution logs — fire-and-forget with minimal error context

This three-tier reliability model is not taught in tutorials. It is learned through operating systems where a failing webhook delivery blocked a tile execution and caused a user-visible outage.

---

## V. The SSRF Scar

```typescript
// lib/validation/url-validator.ts
const BLOCKED_IP_RANGES = [
  "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16",  // Private
  "127.0.0.1", "::1",                                  // Loopback
  "169.254.169.254",                                    // AWS metadata
  "metadata.google.internal",                           // GCP metadata
];
const BLOCKED_PORTS = [21, 22, 25, 3306, 5432, 6379, 27017];
```

The URL validator blocks private IPs, cloud metadata endpoints, dangerous ports, and performs DNS resolution checks against rebinding attacks.

**What this tells us:** The developer has either:
- Experienced an SSRF attempt on a previous system
- Read about SSRF attacks and proactively defended against them
- Operated in an environment where security review flagged URL-based input as a risk

The specificity of the blocklist — AWS *and* GCP *and* Azure metadata endpoints — suggests multi-cloud experience or at least multi-cloud awareness. The DNS rebinding check (`validateUrlWithDnsCheck`) is above-average security maturity; most developers stop at static pattern matching.

---

## VI. The Product Instinct

Several decisions reveal that this developer thinks in products, not just features:

### The Visual Metaphor

Tiles have colors and patterns (`solid`, `stripes`, `dots`, `gradient`). They sit on a grid canvas. They glow when executing. They have LED-style active indicators. The aesthetic is deliberate: DAW-inspired (Digital Audio Workstation), with MPC-pad grid layout and neon accents.

**What this tells us:** The developer understands that *how a tool feels* determines whether it gets used. The DAW metaphor is not random — it implies a user who is a *creator*, arranging modular units into compositions. The neon-on-dark aesthetic signals technical sophistication without sterility. This is visual branding embedded in component code.

### The Vocabulary Abstraction Layer

| Internal Term | User-Facing Term |
|---------------|-----------------|
| Firecrawl | Web Reader |
| System Prompt | Instructions |
| Cron Expression | Schedule |
| LLM | AI Analysis |
| tile_sources | Sources |
| tile_connections | Connections |

The developer knows that exposing technical vocabulary creates cognitive barriers. "Write a system prompt" is intimidating. "Add instructions" is approachable. This translation layer is consistent across the UI and suggests experience with non-technical users.

### The Skill Library as Onboarding

The `tile-skills.ts` file contains 25+ pre-built prompt templates organized by tile type and category: News Monitor, Competitor Analysis, Sentiment Analysis, Backlog Extractor, Blog Post Issue.

**What this tells us:** The developer has watched users stare at an empty prompt field and not know what to write. Skills are not a feature — they are an onboarding mechanism that reduces time-to-first-value. Each skill encodes a use case the developer has validated through personal use or user feedback.

### Multi-Channel Access as Product Strategy

The same tile capabilities are accessible via:
1. **Canvas UI** — visual composition for creators
2. **REST API with SSE** — programmatic integration for developers
3. **Slack Bot** — conversational access for operators
4. **Cron** — automated execution for scheduled intelligence

**What this tells us:** The developer understands that different users need different interfaces to the same system. This is platform thinking, not application thinking. The Slack bot in particular reveals experience with teams where the primary workspace is Slack, not a browser.

---

## VII. The Architectural Decisions That Reveal Operational History

### Three Execution Entry Points, Same Pipeline

Manual trigger (`/api/tiles/run`), cron trigger (`/api/cron/trigger`), and API trigger (`/api/v1/tiles/[tileId]/run`) all share the same execution pipeline but with different authentication mechanisms, response formats, and metadata tags.

**What this tells us:** The developer started with one entry point (manual) and added two more as the product matured. The shared pipeline with differentiated entry points is the mark of someone who has been burned by code duplication in execution paths — fix a bug in one trigger, forget the other two.

### Promise.allSettled Over Promise.all

Downstream tile triggering uses `Promise.allSettled()`, not `Promise.all()`.

**What this tells us:** The developer has experienced a cascade where one failing tile killed the entire downstream chain. `allSettled` ensures that every downstream tile gets its chance, regardless of sibling failures. This is resilience through API choice — a small decision that prevents large outages.

### Token Resolution Chain

```
tile → mosaic → owner → user_integrations (provider + team_id)
```

OAuth tokens are resolved through a four-step chain: from the tile being executed, to its parent mosaic, to the mosaic owner, to the owner's stored integration tokens. The chain supports filtering by `provider_team_id` for multi-workspace scenarios.

**What this tells us:** The developer has built systems where the "whose credentials do we use?" question has a non-trivial answer. In a shared workspace, Tile A might be executed by User B, but the Slack token belongs to User C (the workspace owner). The chain encodes this organizational reality.

---

## VIII. The Type System as Contract Philosophy

### String Literals Over Enums

```typescript
type TileType = "url_reader" | "web_search" | "analyzer" | "slack_reader" | "catalog" | "github_issue" | "knowledge_base";
type JobStatus = "pending" | "processing" | "completed" | "failed";
type MemberRole = "owner" | "admin" | "member";
```

**What this tells us:** The developer prefers types that survive serialization. String literals compile to plain strings in JSON and database columns — no enum mapping layer, no deserialization surprises. This is the preference of someone who has worked across serialization boundaries (database ↔ server ↔ client) and learned that enums create friction at each boundary.

### Insert/Update/Row Type Separation

Every table has three type variants: `Row` (full record), `Insert` (creation payload with optional defaults), `Update` (partial mutation). This is auto-generated by Supabase, but the developer *uses* this distinction consistently — `createTile` accepts `TileInsert`, `updateTile` accepts `TileUpdate`.

**What this tells us:** The developer has internalized the principle that creation and mutation are different operations with different contracts. This prevents the common bug of accidentally nulling a field during an update because the update type requires all fields.

### Enriched Read Types

```typescript
interface TileWithSources extends Tile { sources: TileSource[] }
interface TileWithConnections extends TileWithSources { incoming_connections: TileConnection[] }
interface MosaicWithTiles extends Mosaic { tiles: TileWithSources[] }
```

**What this tells us:** The developer composes types by *read context* — what does the UI need? A tile with its sources. What does the execution pipeline need? A tile with its sources and connections. This is pragmatic DDD without the ceremony of aggregates and value objects.

---

## IX. What Is Absent

What a developer *does not* build is as revealing as what they build.

### No Test Suite

There are no test files, no testing framework in dependencies, no CI/CD configuration for test runs.

**What this tells us:** This is a solo developer or small team shipping fast, relying on type safety, RLS, and runtime guards instead of automated tests. The absence is not ignorance — the execution guards, error handling, and type system are too sophisticated for someone who doesn't understand testing. It is a velocity tradeoff: ship features now, add tests when the product stabilizes or the team grows.

### No ORM

Supabase is called directly — no Prisma, no Drizzle, no TypeORM. Queries are written as chained Supabase client calls.

**What this tells us:** The developer values directness over abstraction in the data layer. They know the Supabase query builder well enough that an ORM would add complexity without proportional benefit. This is the choice of someone who has used ORMs and decided they are not worth the overhead for this scale and team size.

### No Monorepo

Everything is in one Next.js project — API, UI, bot, cron, integrations. No packages directory, no workspace configuration.

**What this tells us:** The developer optimizes for deployment simplicity over code organization. One `vercel deploy` ships everything. This is appropriate for a single-developer product and would be the first thing to change with a growing team.

### No Feature Flags

No LaunchDarkly, no custom feature flag system, no environment-based feature toggling.

**What this tells us:** The developer ships directly to production without gradual rollouts. This is consistent with a small, controlled user base (enforced by the allowlist). Feature flags would be premature infrastructure.

---

## X. The Strategic Compression

### What Kind of Developer Built This

Reading the codebase as autobiography, this is a developer who has:

1. **Built multi-tenant SaaS before** — RLS from migration 00001, role-based access, workspace isolation
2. **Operated AI pipelines in production** — content budgets, timeout tuning, output parsing with fallbacks
3. **Integrated with enterprise messaging** — multi-workspace Slack, OAuth token chains, signature verification, mrkdwn conversion
4. **Experienced cascade failures** — execution guards, cycle detection, depth limits, fire-and-forget reliability tiers
5. **Shipped products, not just features** — vocabulary abstraction, visual identity system, skill templates as onboarding, multi-channel access
6. **Worked across serialization boundaries** — string literals over enums, typed configs as JSON, three-tier Supabase clients
7. **Valued safety over speed in critical paths** — fail-closed rate limiting, SSRF protection, replay-attack prevention
8. **Learned from production incidents** — the 15-second timeout, the recursive-to-cascade redesign, the content truncation system

### The Sentence

**This codebase is the compressed autobiography of a developer who has learned — through building, shipping, and operating — that the hardest problems in AI-powered automation are not the AI, but the composition, the safety, the reliability, and the human interface around it.**

---

## Appendix: The Decision Fossil Record

| Decision | What Was Tried | What Was Learned | What Replaced It |
|----------|---------------|-----------------|-----------------|
| Recursive tiles | Tiles could self-invoke | Infinite loops, resource exhaustion | Explicit connections + cascade triggers |
| Single Slack workspace | One token per user | Users belong to multiple workspaces | `provider_team_id` multi-workspace |
| Direct LLM output | Raw text from Gemini | JSON parsing fails, code fences in output | Format instructions + fence stripping + fallback |
| Unbounded content | Fetch everything, send to LLM | Memory exhaustion, token overflow | 500KB/source, 2MB total budgets |
| Optimistic rate limiting | Check and proceed | Race conditions under concurrent load | Atomic database RPC (check-and-increment) |
| Promise.all for cascades | All downstream tiles at once | One failure kills the chain | Promise.allSettled |
| Implicit timeouts | Rely on platform limits | Hanging Supabase calls, silent failures | 15-second fetch timeout, 5-minute execution timeout |
| "Agent" terminology | AI agent framing | Users confused by "agent" | "Tile" — visual, compositional metaphor |
| Report-only output | Generate text reports | No entity persistence across runs | Catalog tiles with schema + entities + events |
| Single execution path | One trigger mechanism | Different contexts need different auth/format | Three entry points, shared pipeline |
