# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **InboxParse Agent Skill** repository — a Vercel-compatible [Agent Skill](https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem) that enables AI agents (Claude Code, v0, Cursor, etc.) to work with the InboxParse Email-to-LLM REST API.

The skill is installed by users via `npx skills add inboxparse/skill` and gets loaded into agents through the `SKILL.md` frontmatter trigger system.

## Repository Structure

The build guide (`agent-skill-guide.md`) defines the target layout:

- `SKILL.md` — Main skill file with frontmatter metadata, loaded by agents at startup. Contains authentication, endpoint quick reference, common workflows, and agent tips.
- `references/api-reference.md` — Detailed V1 API endpoint documentation (params, request/response shapes)
- `references/webhook-events.md` — Webhook event types, delivery behavior, payload structure
- `references/error-codes.md` — Error codes with HTTP status and resolution steps
- `assets/examples/*.sh` — Curl script examples (list, search, send, webhook setup)
- `README.md` — Repo documentation with install instructions

## Key Concepts

- **API Base URL**: `https://inboxparse.com/api/v1`
- **API Keys**: Prefixed with `ip_` + 64 hex chars. Two tiers: **member** (read-only GET) and **admin** (full CRUD). Passed via `Authorization: Bearer` or `X-API-Key` header.
- **Response format**: Wrapped in `{ "data": ... }` with cursor-based pagination (`next_cursor`, `has_more`).
- **MCP Server**: Available at `https://inboxparse.com/api/mcp` with OAuth 2.1 + PKCE auth.
- **Skill activation**: Triggered by frontmatter keywords like "InboxParse", "email API", "parse emails", "email-to-LLM".

## Skill Spec Conventions

- `SKILL.md` must have YAML frontmatter with `name`, `description`, `metadata`, and `license` fields.
- Keep `SKILL.md` concise — detailed docs go in `references/` so agents can load them on demand.
- The `description` field in frontmatter doubles as the trigger phrase matcher.
