# Webhook Events Reference

## Event Types

| Event | Trigger | Payload includes |
|-------|---------|-----------------|
| `email.received` | New email synced | Full email object |
| `email.sent` | Email sent via API | Sent email object with `smtp_message_id` |
| `email.ai_processed` | AI analysis complete | Email with `ai` field populated |
| `mailbox.synced` | Mailbox sync finished | Mailbox ID, sync stats |
| `mailbox.error` | Sync error occurred | Mailbox ID, error details |

## Delivery

- Webhooks are delivered via HTTP POST with JSON body
- HMAC signing available (`auth_type: "hmac"`)
- Auto-disabled after repeated failures
- Failed deliveries are retried automatically
- Check delivery history via `GET /webhooks/:id/deliveries`

## Payload Structure

```json
{
  "event": "email.received",
  "timestamp": "2026-03-29T12:00:00Z",
  "data": { ... }
}
```
