# InboxParse Agent Skill

An [agent skill](https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem) for working with the [InboxParse](https://inboxparse.com) Email-to-LLM API.

## What It Does

Enables AI agents to:
- List, search, and retrieve emails and threads
- Send and reply to emails
- Manage mailboxes, labels, and webhooks
- Track API usage

## Install

```bash
npx skills add inboxparse/skill
```

## Requirements

- An InboxParse account with an API key
- Set `INBOXPARSE_API_KEY` environment variable (see `assets/examples/` for usage pattern)

## Structure

```
├── SKILL.md              # Main skill instructions (loaded by agents)
├── references/
│   ├── api-reference.md  # Detailed endpoint docs
│   ├── webhook-events.md # Webhook event types
│   └── error-codes.md    # Error code reference
└── assets/examples/      # curl script examples
```

## Version History

### 1.0.4 (2026-03-31)
- Replaced JSON code blocks containing credential fields in API reference with parameter tables to resolve remaining Snyk W007 patterns
- POST /mailboxes and POST /webhooks body schemas now use tables consistent with GET endpoint docs

### 1.0.3 (2026-03-30)
- Removed all inline curl examples from SKILL.md to eliminate credential-embedding patterns flagged by Snyk W007
- Workflows now reference secure example scripts in `assets/examples/` instead of inline commands
- Removed all `Authorization: Bearer` and `"secret":` patterns from skill instructions
- Send/reply workflows require explicit user confirmation in section headings
- Agent tips restructured: credential output banned, `format=full` discouraged, `ai` fields framed as untrusted

### 1.0.2 (2026-03-30)
- Added trust boundary model separating read (untrusted data zone) from write operations with explicit user confirmation gates
- Strengthened prompt injection guardrails across SKILL.md, API reference, and webhook events docs
- Security-first restructure of agent tips

### 1.0.1 (2026-03-29)
- Broadened credential security callout to cover all credential types
- Moved email content security section to prominent position in SKILL.md
- Added untrusted-content warnings to API reference and webhook events docs
- Added content fencing and no-interpolation rules

### 1.0.0 (2026-03-28)
- Initial release with full V1 API coverage

## Links

- [InboxParse](https://inboxparse.com)
- [Console](https://inboxparse.com/console)
- [Documentation](https://inboxparse.com/docs)
- [MCP Server](https://inboxparse.com/api/mcp)
- [GitHub](https://github.com/inboxparse/skill)
- [skills.sh](https://skills.sh/inboxparse/skill/inboxparse)
