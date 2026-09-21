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

  // Reject requests older than 5 minutes to prevent replay attacks.
  // parseInt would accept "1700000000abc", so require digits only.
  if (!/^\d+$/.test(timestamp)) {
    return false;
  }
  const ts = Number(timestamp);
  if (
    Math.abs(Math.floor(Date.now() / 1000) - ts) > MAX_TIMESTAMP_AGE_SECONDS
  ) {
    return false;
  }

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const expected = Buffer.from(`v0=${hmac}`, "utf8");
  const provided = Buffer.from(signature, "utf8");

  // Compare BYTE lengths, not string lengths: a forged signature of the same
  // character count containing a multi-byte character makes timingSafeEqual
  // throw, turning a rejected request into a 500.
  if (expected.length !== provided.length) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(expected, provided);
}
