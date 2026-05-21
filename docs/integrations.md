# Integrations

Mosaic AI integrates with Slack, GitHub, and Google via OAuth. Tokens are stored in `user_integrations`, keyed by `(user_id, provider, provider_team_id)`. Tile execution resolves the active token by walking **tile → mosaic owner → user_integrations**.

| Integration | Provider key | Used for |
|-------------|--------------|----------|
| Slack | `slack` | `slack_reader` tiles, Slack output, bot, offer approval |
| GitHub | `github` | `github_issue` tiles |
| Google | `google` | Google Sheets sync from `catalog` tiles |

---

## Slack

The Slack integration is bidirectional: tiles can read channels, deliver results, and a Chat SDK bot responds to mentions and DMs.

### Create the Slack app

1. https://api.slack.com/apps → **Create New App** → From scratch
2. **OAuth & Permissions** → add bot scopes:
   - `channels:read`, `channels:history`
   - `groups:read`, `groups:history`
   - `chat:write`, `reactions:write`
   - `app_mentions:read`, `im:history`, `im:read`, `im:write` (for the bot)
   - `users:read`, `users:read.email` (to match Slack users to Mosaic accounts)
3. **Event Subscriptions** → Request URL: `https://<your-host>/api/slack/events`
4. **Interactivity & Shortcuts** → Request URL: `https://<your-host>/api/slack/interactivity` (offer Approve/Cancel)
5. **Basic Information** → copy Client ID, Client Secret, Signing Secret into `.env.local`:
   ```
   SLACK_CLIENT_ID=...
   SLACK_CLIENT_SECRET=...
   SLACK_SIGNING_SECRET=...
   ```

### OAuth flow

| Route | Purpose |
|-------|---------|
| `GET /api/auth/slack/connect` | Redirects to Slack install URL |
| `GET /api/auth/slack/callback` | Exchanges code, upserts `user_integrations` (`provider=slack`, `provider_team_id=<team>`) |

A single user can install multiple workspaces; each is stored as a separate row.

### Signature verification

`/api/slack/events` and `/api/slack/interactivity` verify `X-Slack-Signature` using HMAC-SHA256 against `SLACK_SIGNING_SECRET` with replay protection (`lib/slack/verify-signature.ts`).

### Bot

See [Slack Bot](bot.md) for capabilities and tools.

---

## GitHub

Used by `github_issue` tiles to create issues via Octokit.

### Create the GitHub OAuth app

1. https://github.com/settings/developers → **New OAuth App**
2. Authorization callback URL: `https://<your-host>/api/auth/github/callback`
3. Add to `.env.local`:
   ```
   GITHUB_CLIENT_ID=...
   GITHUB_CLIENT_SECRET=...
   ```

### OAuth flow

| Route | Purpose |
|-------|---------|
| `GET /api/auth/github/connect` | Redirects to GitHub authorize URL |
| `GET /api/auth/github/callback` | Exchanges code, stores token |
| `GET /api/github/status` | Returns connection state for the current user |
| `GET /api/github/repos` | Lists repos the connected account can access |

### Scopes

`repo` (issue creation requires write access). The tile picker calls `/api/github/repos` to populate the repo list; multi-repo tiles can accept a runtime `target_repo` (`owner/repo`).

---

## Google

Used by `catalog` tiles to sync entries and events to a Google Sheet. Sync is scoped to the user who enabled it on that tile.

### Create the Google OAuth client

1. https://console.cloud.google.com → **APIs & Services** → **Credentials** → OAuth client ID (Web)
2. Authorized redirect URI: `https://<your-host>/api/auth/google/callback`
3. Enable **Google Sheets API** and **Google Drive API** in the same project
4. Add to `.env.local`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

### OAuth flow

| Route | Purpose |
|-------|---------|
| `GET /api/auth/google/connect` | Redirects to Google consent screen |
| `GET /api/auth/google/callback` | Exchanges code, stores refresh + access token |
| `GET /api/google/status` | Returns connection state |

### Scopes

`https://www.googleapis.com/auth/spreadsheets` and `https://www.googleapis.com/auth/drive.file` (to create and write the sync sheet).

The sheet is created on first sync; its ID is stored on `tiles.google_sheets_sheet_id`. The owning user is recorded so revoking that user's connection cleanly disables the sync.

---

## Token resolution

When a tile runs, the executor resolves the integration token through this chain:

```
tile.mosaic_id → mosaics.owner_id → user_integrations(provider, owner_id)
```

This means the **mosaic owner's** integration is used, not the user who triggered the run. Multi-workspace Slack uses `provider_team_id` to pick the right token when the tile is bound to a specific Slack workspace.

Implementations:
- `lib/slack/integration.ts`
- `lib/github/integration.ts`
- `lib/google/integration.ts`
