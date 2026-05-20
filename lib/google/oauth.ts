const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

// drive.file restricts access to files we create/open with this app — the user
// keeps full control of everything else in their Drive.
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

function getRedirectUri(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${appUrl}/api/auth/google/callback`;
}

export function getGoogleOAuthUrl(state: string, returnTo?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");

  const stateParam = returnTo
    ? `${state}:${encodeURIComponent(returnTo)}`
    : state;

  const url = new URL(GOOGLE_OAUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", stateParam);

  return url.toString();
}

export interface GoogleTokenExchangeResult {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  email: string;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<GoogleTokenExchangeResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(
      `Google token exchange HTTP ${response.status}: ${errBody}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };

  if (!data.access_token || !data.refresh_token || !data.expires_in) {
    throw new Error(
      "Google token exchange missing fields (access_token / refresh_token / expires_in). " +
        "If you've already granted consent before, revoke at https://myaccount.google.com/permissions and retry.",
    );
  }

  // Fetch email via userinfo (id_token decoding works too, but a single fetch is simpler).
  const userinfoRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  if (!userinfoRes.ok) {
    throw new Error(`Google userinfo HTTP ${userinfoRes.status}`);
  }
  const userinfo = (await userinfoRes.json()) as { email?: string };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    email: userinfo.email ?? "",
  };
}

export interface GoogleRefreshResult {
  access_token: string;
  expires_in: number;
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleRefreshResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Google token refresh HTTP ${response.status}: ${errBody}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token || !data.expires_in) {
    throw new Error("Google token refresh missing fields");
  }

  return { access_token: data.access_token, expires_in: data.expires_in };
}
