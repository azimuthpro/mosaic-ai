#!/bin/bash
# Send an email (requires admin key)
API_KEY="${INBOXPARSE_API_KEY:?Set INBOXPARSE_API_KEY}"
MAILBOX_ID="${1:?Usage: send-email.sh <mailbox_id> <to> <subject> <body>}"
TO="${2:?}"
SUBJECT="${3:?}"
BODY="${4:?}"
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"mailbox_id\": \"$MAILBOX_ID\", \"to\": [\"$TO\"], \"subject\": \"$SUBJECT\", \"body\": \"$BODY\"}" \
  "https://inboxparse.com/api/v1/emails/send" | jq .
