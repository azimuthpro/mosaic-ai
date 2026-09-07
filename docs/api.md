# REST API

The V1 API lets external systems execute tiles, read results, and manage webhooks. All V1 routes live under `/api/v1`.

## Authentication

API keys are scoped to a mosaic. Issue one in the mosaic settings UI or via the keys endpoint below. Keys are prefixed `msk_` and stored as SHA-256 hashes (`lib/api/auth.ts`).

Pass the key either as a header or query parameter:

```
Authorization: Bearer msk_<key>
# or
?api_key=msk_<key>
```

Keys may have an expiry; usage is tracked on `mosaic_api_keys`.

## Mosaic keys

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/mosaics/[mosaicId]/keys` | `GET`, `POST`, `DELETE` | Manage API keys for a mosaic |

Requires a Supabase session (UI) — not callable with an API key.

## Tile execution

### `POST /api/v1/tiles/[tileId]/run`

Triggers a tile execution. Response is a **Server-Sent Events** stream (`lib/api/sse.ts`) with typed events:

| Event | Payload |
|-------|---------|
| `started` | `{ jobId, tileId }` |
| `connection` | `{ sourceTileId, sourceName }` per upstream connection resolved |
| `progress` | `{ phase, message }` (fetching, analyzing, etc.) |
| `result` | `{ content, format, debug? }` |
| `done` | `{ jobId, status: "completed" }` |
| `error` | `{ message, code }` |

Optional request body:

```json
{
  "input": "Custom text to inject as source content",
  "target_repo": "owner/repo"
}
```

`target_repo` only applies to multi-repo `github_issue` tiles.

### `GET /api/v1/tiles/[tileId]/status`

Returns the latest job status: `status`, `started_at`, `completed_at`, `error`, plus the last 5 jobs.

### `GET /api/v1/tiles/[tileId]/data`

Returns the most recent successful result content for the tile.

## Webhooks

Webhooks deliver tile job events to external URLs with retries and a delivery audit trail (`tile_webhooks`, `tile_webhook_deliveries`).

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/tiles/[tileId]/webhooks` | `GET`, `POST` | List, create |
| `/api/v1/tiles/[tileId]/webhooks/[webhookId]` | `GET`, `PATCH`, `DELETE` | Read, update, delete |
| `/api/v1/tiles/[tileId]/webhooks/[webhookId]/test` | `POST` | Send a test delivery |
| `/api/v1/tiles/[tileId]/webhooks/[webhookId]/deliveries` | `GET` | Delivery history |

### Webhook config

```json
{
  "url": "https://example.com/hook",
  "events": ["started", "completed", "failed"],
  "auth_type": "bearer",
  "auth_value": "secret-token"
}
```

`auth_type` is `none`, `bearer`, `basic`, or `header`. Failed deliveries are retried with exponential backoff; every attempt lands in `tile_webhook_deliveries`.

## Tile Router

### `POST /api/v1/router`

Routes a natural-language query to the best-matching tile using vector search (`tile_embeddings`) plus LLM reasoning.

```json
{
  "query": "show me the latest competitor pricing",
  "mosaic_id": "uuid"
}
```

Returns ranked tile candidates with similarity scores and an LLM-selected winner with justification.

## Sources

### `POST /api/v1/sources/validate-url`

Validates and fetches metadata for a URL (used by the URL source picker UI). Performs SSRF protection and a Firecrawl scrape to confirm reachability and pull a title.

## Auth-protected internal routes

Not part of the V1 API contract, but useful to know:

| Route | Trigger |
|-------|---------|
| `/api/cron/trigger` | Vercel cron, hourly. Requires `Authorization: Bearer $CRON_SECRET`. |
| `/api/tiles/run` | Manual run from the UI. Supabase session. |
| `/api/slack/events` | Slack Events API. HMAC-verified. |
| `/api/slack/interactivity` | Slack Block Kit actions (offer Approve/Cancel). HMAC-verified. |
| `/api/ai/improve-prompt` | AI-powered prompt improvement (UI). |
| `/api/tiles/[tileId]/jobs/[jobId]/send-offer` | Send or cancel an `offer_sender` draft from the UI. Supabase session. |

## Rate limits

Per-user limits apply across all execution paths (`lib/rate-limit/limiter.ts`):

- **Hourly**: 100 executions
- **Concurrent**: 3 simultaneous

Exceeded limits return `429` with `currentCount`, `resetsAt`, and `reason`.

## Errors

Errors are returned as JSON with a stable `code`:

```json
{ "error": { "code": "rate_limited", "message": "Hourly limit reached", "resetsAt": "..." } }
```

Common codes: `unauthorized`, `not_found`, `rate_limited`, `timeout`, `cycle_detected`, `depth_exceeded`, `validation_error`.
