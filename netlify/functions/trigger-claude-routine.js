const crypto = require("crypto");

async function fetchThread(channelId, threadTs, botToken) {
  const url = `https://slack.com/api/conversations.replies?channel=${channelId}&ts=${threadTs}&limit=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${botToken}` },
  });
  const data = await res.json();
  if (!data.ok) return null;
  return data.messages.map((m) => `@${m.username || m.user}: ${m.text}`).join("\n");
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { SLACK_SIGNING_SECRET, CLAUDE_ROUTINE_URL, CLAUDE_ROUTINE_TOKEN, SLACK_BOT_TOKEN } =
    process.env;

  // Verify Slack signing secret
  const timestamp = event.headers["x-slack-request-timestamp"];
  const slackSignature = event.headers["x-slack-signature"];

  if (!timestamp || !slackSignature) {
    return { statusCode: 400, body: "Missing Slack signature headers" };
  }

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return { statusCode: 400, body: "Request timestamp too old" };
  }

  const rawBody = event.body || "";
  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const computedSig =
    "v0=" +
    crypto
      .createHmac("sha256", SLACK_SIGNING_SECRET)
      .update(sigBasestring, "utf8")
      .digest("hex");

  const sigBuffer = Buffer.from(computedSig, "utf8");
  const slackSigBuffer = Buffer.from(slackSignature, "utf8");

  if (
    sigBuffer.length !== slackSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, slackSigBuffer)
  ) {
    return { statusCode: 401, body: "Invalid Slack signature" };
  }

  // Parse the message shortcut payload
  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get("payload") || "{}");

  const messageText = payload.message?.text || "";
  const threadTs = payload.message?.thread_ts || payload.message?.ts || "";
  const channelId = payload.channel?.id || "";
  const channelName = payload.channel?.name || "unknown";
  const userName = payload.user?.username || payload.user?.name || "unknown";

  // Fetch the full thread if we have a bot token
  let threadContext = "";
  if (SLACK_BOT_TOKEN && threadTs && channelId) {
    const thread = await fetchThread(channelId, threadTs, SLACK_BOT_TOKEN);
    if (thread) threadContext = `\n\nFull thread:\n${thread}`;
  }

  const routineText = `Log FAQ request from @${userName} in #${channelName}\n\nMessage: ${messageText}${threadContext}`;

  // Fire the Claude routine without awaiting — Slack needs a response in <3s
  fetch(CLAUDE_ROUTINE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLAUDE_ROUTINE_TOKEN}`,
      "anthropic-beta": "experimental-cc-routine-2026-04-01",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: routineText }),
  }).catch((err) => console.error("Claude routine fire failed:", err));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      response_type: "ephemeral",
      text: "FAQ logged to Claude.",
    }),
  };
};
