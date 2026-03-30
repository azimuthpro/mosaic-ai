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
- Set `INBOXPARSE_API_KEY` environment variable or pass key via `Authorization: Bearer` header

## Structure

```
├── SKILL.md              # Main skill instructions (loaded by agents)
├── references/
│   ├── api-reference.md  # Detailed endpoint docs
│   ├── webhook-events.md # Webhook event types
│   └── error-codes.md    # Error code reference
└── assets/examples/      # curl script examples
```

## Links

- [InboxParse Dashboard](https://inboxparse.com/console)
- [API Documentation](https://inboxparse.com/docs)
- [MCP Server](https://inboxparse.com/api/mcp)
- [GitHub](https://github.com/inboxparse/skill)
- [skills.sh](https://skills.sh/)
