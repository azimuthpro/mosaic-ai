#!/bin/bash
# Search emails with hybrid mode
API_KEY="${INBOXPARSE_API_KEY:?Set INBOXPARSE_API_KEY}"
QUERY="${1:?Usage: search-emails.sh <query>}"
curl -s -X POST -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"$QUERY\", \"mode\": \"hybrid\"}" \
  "https://inboxparse.com/api/v1/search" | jq .
