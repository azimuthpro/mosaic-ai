#!/bin/bash
# Create a webhook for new emails (requires admin key)
API_KEY="${INBOXPARSE_API_KEY:?Set INBOXPARSE_API_KEY}"
WEBHOOK_URL="${1:?Usage: setup-webhook.sh <url>}"
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$WEBHOOK_URL\", \"events\": [\"email.received\", \"email.ai_processed\"]}" \
  "https://inboxparse.com/api/v1/webhooks" | jq .
