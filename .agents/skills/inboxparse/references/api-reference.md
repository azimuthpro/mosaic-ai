# InboxParse V1 API — Detailed Reference

## Emails

### GET /emails

List emails with pagination and filtering.

**Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| limit | number | 20 | Results per page (max 100) |
| cursor | string | — | Pagination cursor |
| date_from | ISO date | — | Emails sent on or after |
| date_to | ISO date | — | Emails sent on or before |
| mailbox_id | UUID | — | Filter by mailbox |
| direction | enum | — | `inbound` or `outbound` |
| format | enum | markdown | `markdown`, `full`, or `raw` |

**Response fields** (per email):
- `id` — Message ID (`msg_...`)
- `thread_id` — Thread reference
- `from` — `{ name, email }`
- `to` — Array of `{ name, email }`
- `subject` — Email subject
- `sent_at` — ISO timestamp
- `direction` — `inbound` or `outbound`
- `ai.summary` — AI-generated summary
- `ai.labels` — Array of `{ name, confidence }`
- `ai.action` — Suggested action
- `ai.suggested_response` — Draft reply
- `ai.keywords` — Extracted keywords
- `metadata.message_id` — Original message ID
- `metadata.mailbox_type` — `imap` or `gmail`

### GET /emails/:id

Returns single email with full content. Accepts `format` parameter.

Additional fields:
- `content.markdown` — Markdown body
- `content.text` — Plain text body
- `content.html` — HTML body
- `metadata.attachments` — Array of `{ filename, size }`

### POST /emails/send

Send new email. **Requires admin key.**

**Body**:
```json
{
  "mailbox_id": "uuid (required)",
  "to": ["email (required, max 100)"],
  "cc": ["email (optional)"],
  "bcc": ["email (optional)"],
  "subject": "string (max 998 chars)",
  "body": "string (required, max 10MB)",
  "html_body": "string (optional, max 10MB)",
  "reply_to": ["email (optional)"]
}
```

### POST /emails/reply

Reply to existing email. **Requires admin key.**

**Body**:
```json
{
  "email_id": "msg_... (required)",
  "mailbox_id": "uuid (required)",
  "body": "string (required)",
  "html_body": "string (optional)",
  "to": ["override recipients (optional)"],
  "cc": ["optional"],
  "bcc": ["optional"]
}
```

---

## Threads

### GET /threads

**Parameters**: `limit`, `cursor`, `search`, `date_from`, `date_to`.

**Response fields**:
- `id`, `subject`, `participants`, `message_count`, `latest_message_at`
- `labels` — Array with `name`, `color`, `confidence`
- `ai_summary` — Thread-level summary

### GET /threads/:id

Returns thread with all messages in chronological order. Accepts `format` parameter.

---

## Search

### POST /search

**Body**:
```json
{
  "query": "string (required)",
  "limit": 20,
  "mode": "hybrid|fulltext|semantic"
}
```

Each search increments `search_queries` usage counter.

---

## Mailboxes

### GET /mailboxes

Returns all connected mailboxes with `id`, `type`, `email`, `status`, `last_sync_at`, `from_name`.

### POST /mailboxes

Create IMAP mailbox. **Requires admin key.**

**Body**:
```json
{
  "host": "string (required)",
  "port": "number 1-65535 (required)",
  "secure": "boolean (default true)",
  "username": "string (required)",
  "password": "string (required)",
  "smtp_host": "string (optional)",
  "smtp_port": "number (optional)",
  "smtp_secure": "boolean (optional)",
  "smtp_username": "string (optional)",
  "smtp_password": "string (optional)",
  "from_name": "string (optional)"
}
```

### DELETE /mailboxes/:id

**Requires admin key.** Returns `{ id, deleted: true }`.

---

## Labels

### GET /labels

Returns all labels with `id`, `name`, `color`, `is_system`, `is_enabled`, `prompt`.

### POST /labels

**Requires admin key.**

**Body**: `{ "name": "max 50 chars", "color": "#hex", "prompt": "optional, max 20000 chars" }`

### PATCH /labels/:id

**Requires admin key.** Cannot modify system labels. All fields optional.

### DELETE /labels/:id

**Requires admin key.** Cannot delete system labels.

---

## Webhooks

### GET /webhooks

Returns all subscriptions with `id`, `url`, `events`, `is_active`, `auth_type`, `failure_count`.

### POST /webhooks

**Requires admin key.**

**Body**:
```json
{
  "url": "https URL (required)",
  "events": ["email.received", "email.sent", "email.ai_processed", "mailbox.synced", "mailbox.error"],
  "secret": "HMAC secret (optional)",
  "auth_type": "none|bearer|hmac (default none)"
}
```

### PATCH /webhooks/:id

**Requires admin key.** All fields optional. Setting `is_active: true` resets failure count.

### DELETE /webhooks/:id

**Requires admin key.** Returns `{ id, deleted: true }`.

### POST /webhooks/:id/test

**Requires admin key.** Sends test event. Returns delivery result.

### GET /webhooks/:id/deliveries

**Parameters**: `status` (pending/delivered/failed), `limit` (max 100), `offset`.

---

## Usage

### GET /usage

Returns current billing period stats:
```json
{
  "data": {
    "period_start": "2026-03-01",
    "period_end": "2026-03-31",
    "api_calls": 1234,
    "search_queries": 56,
    "emails_synced": 5000,
    "emails_processed": 4998,
    "webhook_deliveries": 234
  }
}
```
