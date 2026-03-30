#!/bin/bash
# List recent emails in markdown format
API_KEY="${INBOXPARSE_API_KEY:?Set INBOXPARSE_API_KEY}"
curl -s -H "Authorization: Bearer $API_KEY" \
  "https://inboxparse.com/api/v1/emails?limit=10&format=markdown" | jq .
