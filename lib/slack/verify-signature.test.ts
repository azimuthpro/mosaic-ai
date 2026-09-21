import { beforeAll, describe, expect, it } from "bun:test";
import crypto from "crypto";

import { verifySlackSignature } from "./verify-signature";

const SECRET = "test-signing-secret";

function sign(body: string, timestamp: string): string {
  const hmac = crypto
    .createHmac("sha256", SECRET)
    .update(`v0:${timestamp}:${body}`)
    .digest("hex");
  return `v0=${hmac}`;
}

function nowSeconds(offset = 0): string {
  return String(Math.floor(Date.now() / 1000) + offset);
}

describe("verifySlackSignature", () => {
  beforeAll(() => {
    process.env.SLACK_SIGNING_SECRET = SECRET;
  });

  it("accepts a correctly signed request", () => {
    const ts = nowSeconds();
    expect(verifySlackSignature("payload=1", ts, sign("payload=1", ts))).toBe(
      true,
    );
  });

  it("rejects a tampered body", () => {
    const ts = nowSeconds();
    expect(verifySlackSignature("payload=2", ts, sign("payload=1", ts))).toBe(
      false,
    );
  });

  it("rejects a replay older than five minutes", () => {
    const ts = nowSeconds(-301);
    expect(verifySlackSignature("payload=1", ts, sign("payload=1", ts))).toBe(
      false,
    );
  });

  // Regression: parseInt accepted the numeric prefix of a junk timestamp.
  it("rejects a timestamp with trailing junk", () => {
    const ts = nowSeconds();
    expect(
      verifySlackSignature("payload=1", `${ts}abc`, sign("payload=1", ts)),
    ).toBe(false);
  });

  // Regression: equal string length + unequal byte length made timingSafeEqual
  // throw, so a forged signature produced a 500 instead of a 401.
  it("returns false rather than throwing on a multi-byte signature", () => {
    const ts = nowSeconds();
    const forged = `v0=${"a".repeat(63)}é`;
    expect(forged.length).toBe(sign("payload=1", ts).length);
    expect(verifySlackSignature("payload=1", ts, forged)).toBe(false);
  });

  it("rejects an empty signature", () => {
    expect(verifySlackSignature("payload=1", nowSeconds(), "")).toBe(false);
  });
});
