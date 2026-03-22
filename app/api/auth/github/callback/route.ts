import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCodeForToken } from "@/lib/github/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type { GitHubIntegrationMetadata } from "@/types/database";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/?github_error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?github_error=missing_params`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("github_oauth_state")?.value;

  const colonIndex = state.indexOf(":");
  const stateValue = colonIndex === -1 ? state : state.slice(0, colonIndex);
  const returnTo =
    colonIndex === -1 ? "/" : decodeURIComponent(state.slice(colonIndex + 1));

  if (!savedState || savedState !== stateValue) {
    return NextResponse.redirect(`${appUrl}/?github_error=invalid_state`);
  }

  cookieStore.delete("github_oauth_state");

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/sign-in`);
  }

  try {
    const tokenData = await exchangeCodeForToken(code);

    // Fetch GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to fetch GitHub user: ${userResponse.status}`);
    }

    const githubUser = (await userResponse.json()) as {
      login: string;
      avatar_url?: string;
    };

    const metadata: GitHubIntegrationMetadata = {
      username: githubUser.login,
      avatar_url: githubUser.avatar_url,
    };

    const adminClient = createAdminClient();
    const { error: upsertError } = await adminClient
      .from("user_integrations")
      .upsert(
        {
          user_id: user.id,
          provider: "github",
          provider_team_id: "",
          access_token: tokenData.access_token,
          metadata,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id,provider,provider_team_id" },
      );

    if (upsertError) {
      console.error(
        "[github/callback] Failed to save integration:",
        upsertError,
      );
      return NextResponse.redirect(
        `${appUrl}${returnTo}?github_error=save_failed`,
      );
    }

    return NextResponse.redirect(`${appUrl}${returnTo}?github_connected=1`);
  } catch (err) {
    console.error("[github/callback] Token exchange failed:", err);
    return NextResponse.redirect(
      `${appUrl}${returnTo}?github_error=token_exchange_failed`,
    );
  }
}
