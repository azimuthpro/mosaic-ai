import { describe, expect, it } from "bun:test";

import { appRedirectUrl, safeReturnPath } from "./oauth";

const APP_URL = "https://app.test";

describe("safeReturnPath", () => {
  it("keeps same-site paths, including their query", () => {
    expect(safeReturnPath("/mosaics/1/settings?tab=slack")).toBe(
      "/mosaics/1/settings?tab=slack",
    );
  });

  // Regression: `${appUrl}${returnTo}` with these values leaves the site —
  // "@evil.com" turns our own host into a username.
  it("collapses off-site values to the root", () => {
    for (const value of [
      "//evil.com",
      "/\\evil.com",
      "@evil.com",
      "https://evil.com",
      "",
      null,
      undefined,
    ]) {
      expect(safeReturnPath(value)).toBe("/");
    }
  });
});

describe("appRedirectUrl", () => {
  // Regression: string concatenation produced "?tab=slack?slack_connected=1"
  // and the app never saw the flag.
  it("merges with an existing query string", () => {
    expect(
      appRedirectUrl(APP_URL, "/settings?tab=slack", { slack_connected: "1" }),
    ).toBe("https://app.test/settings?tab=slack&slack_connected=1");
  });

  it("never leaves the app origin", () => {
    expect(new URL(appRedirectUrl(APP_URL, "@evil.com", {})).host).toBe(
      "app.test",
    );
    expect(new URL(appRedirectUrl(APP_URL, "//evil.com", {})).host).toBe(
      "app.test",
    );
  });

  it("encodes error codes", () => {
    expect(appRedirectUrl(APP_URL, "/", { slack_error: "a b&c" })).toBe(
      "https://app.test/?slack_error=a+b%26c",
    );
  });
});
