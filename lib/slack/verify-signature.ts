import crypto from "crypto";

const MAX_TIMESTAMP_AGE_SECONDS = 5 * 60; // 5 minutes

/**
 * Verifies the authenticity of an incoming Slack request using
 * HMAC-SHA256 signature validation.
 *
 * @see https://api.slack.com/authentication/verifying-requests-from-slack
 */
export function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    throw new Error("SLACK_SIGNING_SECRET is not configured");
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const ts = parseInt(timestamp, 10);
  if (
    isNaN(ts) ||
    Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_TIMESTAMP_AGE_SECONDS
  ) {
    return false;
  }

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const expected = `v0=${hmac}`;

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
