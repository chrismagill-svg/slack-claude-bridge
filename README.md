# Slack Claude Bridge

A Netlify serverless function that bridges a Slack slash command to a Claude Code routine.

## How it works

1. User runs a slash command in Slack (e.g. `/run-routine some text here`)
2. Slack POSTs to the Netlify function URL
3. The function verifies the request is genuinely from Slack, then fires the Claude routine
4. Slack gets an immediate `200` with a private confirmation message

## Environment variables

Set these in Netlify → Site configuration → Environment variables:

| Variable | Where to find it |
|---|---|
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information → App Credentials |
| `CLAUDE_ROUTINE_URL` | The full `/fire` endpoint URL for your Claude Code routine |
| `CLAUDE_ROUTINE_TOKEN` | The bearer token generated for the API trigger |

## Wiring up the Slack slash command

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and open your app
2. In the sidebar, go to **Slash Commands** → **Create New Command**
3. Fill in:
   - **Command**: e.g. `/run-routine`
   - **Request URL**: `https://<your-netlify-site>.netlify.app/.netlify/functions/trigger-claude-routine`
   - **Short Description**: whatever makes sense for your team
4. Save, then reinstall the app to your workspace if prompted
5. Deploy this repo to Netlify and confirm the environment variables are set

## Text sent to the Claude routine

```
Command: <whatever the user typed> | Triggered by: @username in #channel-name
```
