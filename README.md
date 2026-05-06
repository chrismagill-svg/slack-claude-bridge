# Slack Claude Bridge

A Netlify serverless function that bridges a Slack message shortcut to a Claude Code routine. When triggered, it reads the message (and optionally the full thread) and fires a Claude routine with that context.

## How it works

1. User clicks **"..."** on any Slack message → selects **Log FAQ**
2. Slack POSTs the message payload to the Netlify function
3. The function verifies the request is genuinely from Slack
4. If a bot token is provided, it fetches the full thread
5. It fires the Claude routine with the message + thread context
6. Slack gets an immediate `200` with a private confirmation message

## Setup

### 1. Deploy to Netlify

- Connect this repo to a new Netlify site
- In **Site configuration → Build & deploy → Build settings**, clear the Publish directory field (this is a functions-only site — no build step needed)
- The functions directory is set automatically via `netlify.toml`

### 2. Environment variables

Set these in Netlify → Site configuration → Environment variables:

| Variable | Required | Where to find it |
|---|---|---|
| `SLACK_SIGNING_SECRET` | Yes | Slack app → Basic Information → App Credentials |
| `CLAUDE_ROUTINE_URL` | Yes | Claude Code → your routine → API trigger → `/fire` endpoint URL |
| `CLAUDE_ROUTINE_TOKEN` | Yes | Claude Code → your routine → API trigger → bearer token |
| `SLACK_BOT_TOKEN` | Optional | Slack app → OAuth & Permissions → Bot User OAuth Token (`xoxb-...`) — enables full thread reading |

> **Important:** When adding each variable, check the **"Contains secret values"** checkbox. This masks the value in Netlify's UI and API so it can't be read back even by someone with account access.

### 3. Slack app configuration

#### Required scopes (OAuth & Permissions → Bot Token Scopes)
- `commands` — for shortcuts
- `channels:history` — read public channel threads
- `groups:history` — read private channel threads (if needed)

#### Interactivity & Shortcuts
1. Turn **Interactivity** on
2. Set the **Request URL** to:
   ```
   https://<your-netlify-site>.netlify.app/.netlify/functions/trigger-claude-routine
   ```
3. Under **Shortcuts → Create New Shortcut** → choose **On messages**
4. Fill in:
   - **Name**: `Log FAQ`
   - **Short description**: `Log this message as a FAQ`
   - **Callback ID**: `log_faq`
5. Save and reinstall the app to your workspace

### 4. Claude routine

In Claude Code, create a new **Remote** routine with:
- **Trigger**: Call via API
- **Instructions**: describe what Claude should do with the FAQ (log to Notion, summarise, etc.)

The routine receives a `text` field in this format:
```
Log FAQ request from @username in #channel-name

Message: <the message text>

Full thread:
@user1: ...
@user2: ...
```

## Usage

Find any message in Slack → click **"..."** → **Log FAQ** → Claude routine fires automatically.

## Keeping secrets secure

**Never put tokens or secrets in any file inside the repo.** Anything committed to GitHub — even a private repo — is a risk. Always add secrets through Netlify's Environment Variables UI only.

If you're working with Claude Code locally and want a safe place to store your tokens for reference (so you or an AI assistant can use them without exposing them in the codebase), create a local secrets file outside any repo:

```
~/.claude/secrets.json
```

Example format:
```json
{
  "slack-claude-bridge": {
    "SLACK_SIGNING_SECRET": "...",
    "CLAUDE_ROUTINE_URL": "...",
    "CLAUDE_ROUTINE_TOKEN": "...",
    "SLACK_BOT_TOKEN": "...",
    "netlify": {
      "pat": "...",
      "site_id": "..."
    }
  }
}
```

This file lives on your local machine only, is never tracked by git, and can be read by Claude Code when needed. Do not create this file inside a repo directory.
