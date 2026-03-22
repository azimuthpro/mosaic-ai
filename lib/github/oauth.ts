const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

const GITHUB_SCOPES = "repo read:org";

export function getGitHubOAuthUrl(state: string, returnTo?: string): string {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) throw new Error("GITHUB_CLIENT_ID is not configured");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const redirectUri = `${appUrl}/api/auth/github/callback`;

  const stateParam = returnTo
    ? `${state}:${encodeURIComponent(returnTo)}`
    : state;

  const url = new URL(GITHUB_OAUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", GITHUB_SCOPES);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", stateParam);

  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
}> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth credentials are not configured");
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange HTTP error: ${response.status}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      `GitHub token exchange failed: ${data.error_description ?? data.error ?? "Missing access_token"}`,
    );
  }

  return {
    access_token: data.access_token,
    token_type: data.token_type ?? "bearer",
    scope: data.scope ?? "",
  };
}
