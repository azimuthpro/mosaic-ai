# Error Codes Reference

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `unauthorized` | 401 | Missing or invalid API key | Check `Authorization` header, verify key is not revoked |
| `forbidden` | 403 | Insufficient permissions | Use an admin key for write operations |
| `not_found` | 404 | Resource doesn't exist | Verify the ID, check it belongs to your workspace |
| `validation_error` | 400 | Invalid request body | Check required fields, data types, and limits |
| `duplicate` | 409 | Unique constraint violated | E.g. label name already exists in workspace |
| `rate_limit_exceeded` | 429 | Quota exceeded | Check `GET /usage`, upgrade tier, or wait for reset |
| `invalid_cursor` | 400 | Bad pagination cursor | Use cursor values exactly as returned by the API |
| `query_error` | 500 | Database error | Retry; if persistent, contact support |
| `internal_error` | 500 | Server error | Retry with backoff; contact support if persistent |
