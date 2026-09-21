const SLACK_OAUTH_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

/**
 * Bot scopes requested at install time.
 *
 * Slack grants exactly what this list asks for — the app's configured scopes
 * only set the ceiling. A scope missing here is missing from every token the
 * Connect button produces, even when the Slack app config lists it. Changing
 * this list requires each workspace to reinstall; tokens cannot be upgraded.
 */
const SLACK_SCOPES = [
  "app_mentions:read", // bot mentions in channels
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "chat:write",
  "im:read",
  "im:write", // DM conversations with the bot
  "im:history",
  "users:read",
  "users:read.email", // maps Slack users to Mosaic accounts — identity depends on it
  "reactions:read",
  "reactions:write",
].join(",");

export function getSlackOAuthUrl(state: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error("SLACK_CLIENT_ID is not configured");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const redirectUri = `${appUrl}/api/auth/slack/callback`;

  const url = new URL(SLACK_OAUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", SLACK_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * Keeps a post-install redirect on this site. `//evil.com` and `/\evil.com` are
 * protocol-relative URLs, and an `@evil.com` value appended to the app URL turns
 * our own host into a username — all three leave the site.
 */
export function safeReturnPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/";
  }
  return value;
}

/**
 * Builds an absolute redirect back into the app, preserving any query string the
 * return path already carries (string concatenation would produce `?a=1?b=2`,
 * and the flag would never be read).
 */
export function appRedirectUrl(
  appUrl: string,
  path: string,
  params: Record<string, string> = {},
): string {
  const url = new URL(safeReturnPath(path), appUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  team: { id: string; name: string };
  bot_user_id: string;
}> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Slack OAuth credentials are not configured");
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const redirectUri = `${appUrl}/api/auth/slack/callback`;

  const response = await fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack token exchange HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    team?: { id: string; name: string };
    bot_user_id?: string;
  };

  if (!data.ok || !data.access_token || !data.team || !data.bot_user_id) {
    throw new Error(
      `Slack token exchange failed: ${data.error ?? "Missing fields in response"}`,
    );
  }

  return {
    access_token: data.access_token,
    team: data.team,
    bot_user_id: data.bot_user_id,
  };
}
