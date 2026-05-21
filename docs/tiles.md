# Tile Types

A **tile** is one processing unit on a mosaic. Tiles have a type, sources, an instruction prompt, a schedule, and optional outputs (Slack, webhooks, Sheets). Any tile can receive **connections** from other tiles; type-specific logic decides how that upstream data is consumed.

| Type | Purpose | Requires |
|------|---------|----------|
| [`url_reader`](#url_reader) | Scrape web pages | Firecrawl |
| [`web_search`](#web_search) | Run web searches | Tavily |
| [`analyzer`](#analyzer) | AI-process upstream tile data | Connections |
| [`slack_reader`](#slack_reader) | Read channel messages | Slack OAuth |
| [`catalog`](#catalog) | Track entities across runs | — (optional Sheets) |
| [`github_issue`](#github_issue) | Create GitHub issues | GitHub OAuth |
| [`knowledge_base`](#knowledge_base) | Static text for connections | — |
| [`offer_sender`](#offer_sender) | Personalize and send HTML email offers | SendGrid + Slack |

All tiles share these knobs: schedule (manual / hourly / custom cron), language (en/pl/es/it/de), output format (text or JSON), memory mode (30-day source history), Slack output, webhooks, and downstream cascade (`trigger_on_source_update`).

---

## `url_reader`

Scrapes one or more URLs via Firecrawl, then runs the result through Gemini using the tile's instructions.

**Sources:** static URLs, or — with connections — URLs extracted from upstream tile output (`lib/tiles/extract-urls-from-job.ts`).

**Use for:** monitoring article pages, product listings, docs.

## `web_search`

Runs a Tavily search and analyzes the results.

**Sources:** static queries, or — with connections — keywords extracted from upstream tile output (`lib/tiles/extract-keywords-from-job.ts`).

**Use for:** topic monitoring, market scans, named-entity tracking.

## `analyzer`

Receives the full report content from connected tiles and re-processes it. No sources of its own.

**Use for:** summarizing across multiple feeds, cross-referencing reports, second-pass classification.

## `slack_reader`

Reads recent messages from connected Slack channels.

**Config:** `channel_id`, `max_messages`, `include_threads`, `hours_back`. The **Backlog** skill ships as a starter prompt.

**Use for:** standup digests, channel summaries, incident timelines.

## `catalog`

Maintains a persistent entity database across executions. On each run Gemini detects (or refines) a schema, extracts entities, deduplicates by `match_key`, and writes a diff of added/updated entries plus new events.

**Tables:** `catalog_schemas`, `catalog_entries`, `catalog_entry_events`, `catalog_diffs`.

**Optional output:** per-user Google Sheets sync of entries and events (`lib/outputs/sheets-output.ts`).

**Use for:** competitive intel rosters, asset tracking, regulatory watch lists.

## `github_issue`

Generates a GitHub issue from connected tile data (or instruction text) and creates it via Octokit.

**Config:** `owner`, `repo`, `default_labels`. Multi-repo tiles accept a runtime `target_repo` from the bot or manual-run dialog.

**Skills:** Blog Post, Bugfix, Feature Request.

**Requires:** GitHub OAuth (see [Integrations](integrations.md)).

## `knowledge_base`

Static text content. Never executes. Other tiles reach it via connections and receive its body as context.

**Use for:** company style guides, glossaries, prompt fragments shared across tiles.

## `offer_sender`

AI personalizes an HTML email template using connected data, posts a draft to Slack with Block Kit Approve/Cancel buttons, and — on approval — sends via SendGrid.

**System skill:** Professional Business Offer.

**Flow:**
1. Tile executes; Gemini produces a personalized HTML body.
2. `lib/email/post-offer-draft-slack.ts` posts a draft to the configured channel.
3. Slack user clicks Approve → `/api/slack/interactivity` → `lib/email/send-offer-draft.ts` sends the email.
4. Cancel discards the draft.

---

## Connections

A connection (`tile_connections`) flows data from `source_tile_id` to `target_tile_id`. Each target type decides what to do with that data:

- `url_reader` extracts URLs from the upstream report
- `web_search` extracts keywords
- `analyzer`, `github_issue`, `offer_sender` receive the full report content
- `knowledge_base` is a source-only tile (never a target)

If the target has `trigger_on_source_update` enabled, the source tile's completion automatically schedules the target. The cascade engine (`lib/tiles/trigger-downstream.ts`) propagates an `ExecutionContext` that enforces cycle detection (visited set), depth limit (default 5), and timeout budget.

## Execution paths

Tiles can be executed three ways — all three apply the same rate limiter, content fetcher, and cascade:

| Endpoint | Trigger | Auth |
|----------|---------|------|
| `POST /api/tiles/run` | Manual UI run | Supabase session |
| `POST /api/cron/trigger` | Scheduled (hourly walk, timezone-aware) | `CRON_SECRET` |
| `POST /api/v1/tiles/:tileId/run` | API consumer | API key, SSE response |

See [REST API](api.md) for V1 details.
