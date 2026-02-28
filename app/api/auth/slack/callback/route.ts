import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCodeForToken } from "@/lib/slack/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type { SlackIntegrationMetadata } from "@/types/database";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Handle user declining authorization
  if (error) {
    return NextResponse.redirect(
      `${appUrl}/?slack_error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?slack_error=missing_params`);
  }

  // Validate state to prevent CSRF
  const cookieStore = await cookies();
  const savedState = cookieStore.get("slack_oauth_state")?.value;

  // State encodes "stateValue:encodedReturnTo"
  const colonIndex = state.indexOf(":");
  const stateValue = colonIndex === -1 ? state : state.slice(0, colonIndex);
  const returnTo =
    colonIndex === -1 ? "/" : decodeURIComponent(state.slice(colonIndex + 1));

  if (!savedState || savedState !== stateValue) {
    return NextResponse.redirect(`${appUrl}/?slack_error=invalid_state`);
  }

  // Clear the state cookie
  cookieStore.delete("slack_oauth_state");

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/sign-in`);
  }

  try {
    const tokenData = await exchangeCodeForToken(code);

    const metadata: SlackIntegrationMetadata = {
      team_id: tokenData.team.id,
      team_name: tokenData.team.name,
      bot_user_id: tokenData.bot_user_id,
    };

    const adminClient = createAdminClient();
    const { error: upsertError } = await adminClient
      .from("user_integrations")
      .upsert(
        {
          user_id: user.id,
          provider: "slack",
          provider_team_id: tokenData.team.id,
          access_token: tokenData.access_token,
          metadata,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id,provider,provider_team_id" },
      );

    if (upsertError) {
      console.error(
        "[slack/callback] Failed to save integration:",
        upsertError,
      );
      return NextResponse.redirect(
        `${appUrl}${returnTo}?slack_error=save_failed`,
      );
    }

    return NextResponse.redirect(`${appUrl}${returnTo}?slack_connected=1`);
  } catch (err) {
    console.error("[slack/callback] Token exchange failed:", err);
    return NextResponse.redirect(
      `${appUrl}${returnTo}?slack_error=token_exchange_failed`,
    );
  }
}
