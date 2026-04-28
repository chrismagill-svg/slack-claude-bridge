const crypto = require("crypto");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { SLACK_SIGNING_SECRET, CLAUDE_ROUTINE_URL, CLAUDE_ROUTINE_TOKEN } =
    process.env;

  // Verify Slack signing secret
  const timestamp = event.headers["x-slack-request-timestamp"];
  const slackSignature = event.headers["x-slack-signature"];

  if (!timestamp || !slackSignature) {
    return { statusCode: 400, body: "Missing Slack signature headers" };
  }

  // Reject requests older than 5 minutes to prevent replay attacks
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

  // Parse the slash command payload
  const params = new URLSearchParams(rawBody);
  const commandText = params.get("text") || "";
  const userName = params.get("user_name") || "unknown";
  const channelName = params.get("channel_name") || "unknown";

  const routineText = `Command: ${commandText} | Triggered by: @${userName} in #${channelName}`;

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
      text: "Claude routine triggered.",
    }),
  };
};
