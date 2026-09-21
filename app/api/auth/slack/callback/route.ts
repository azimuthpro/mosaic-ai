import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { appRedirectUrl, exchangeCodeForToken } from "@/lib/slack/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type { SlackIntegrationMetadata } from "@/types/database";

function sameState(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, so compare byte lengths first.
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Reads the CSRF nonce and return path out of the cookie set by the connect
 * route. Returns null for anything unusable — malformed JSON, or no nonce to
 * compare the query parameter against.
 */
function parseStateCookie(
  cookieValue: string | undefined,
): { state: string; returnTo: string } | null {
  try {
    const parsed = JSON.parse(cookieValue ?? "") as {
      state?: string;
      returnTo?: string;
    };
    if (!parsed.state) return null;
    return { state: parsed.state, returnTo: parsed.returnTo ?? "/" };
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // The state cookie holds both the CSRF nonce and where to send the user back
  // to. Consume it before anything can fail, so a nonce is never reusable.
  const cookieStore = await cookies();
  const saved = cookieStore.get("slack_oauth_state")?.value;
  cookieStore.delete("slack_oauth_state");

  // Validate state before acting on anything else in the query, including the
  // error branch — otherwise that branch is an unauthenticated redirect.
  const savedState = parseStateCookie(saved);
  if (!savedState || !state || !sameState(savedState.state, state)) {
    return NextResponse.redirect(
      appRedirectUrl(appUrl, "/", { slack_error: "invalid_state" }),
    );
  }
  const { returnTo } = savedState;

  // Handle user declining authorization
  if (error) {
    return NextResponse.redirect(
      appRedirectUrl(appUrl, returnTo, { slack_error: error }),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      appRedirectUrl(appUrl, returnTo, { slack_error: "missing_params" }),
    );
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(appRedirectUrl(appUrl, "/sign-in"));
  }

  try {
    const tokenData = await exchangeCodeForToken(code);

    const metadata: SlackIntegrationMetadata = {
      team_id: tokenData.team.id,
      team_name: tokenData.team.name,
      bot_user_id: tokenData.bot_user_id,
    };

    const adminClient = createAdminClient();
    // Single write: user_integrations is the only place a bot token lives. The
    // bot resolves tokens from here per request, so a workspace connected now
    // works immediately on every instance.
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
        upsertError.message,
      );
      return NextResponse.redirect(
        appRedirectUrl(appUrl, returnTo, { slack_error: "save_failed" }),
      );
    }

    return NextResponse.redirect(
      appRedirectUrl(appUrl, returnTo, { slack_connected: "1" }),
    );
  } catch (err) {
    console.error("[slack/callback] Token exchange failed:", err);
    return NextResponse.redirect(
      appRedirectUrl(appUrl, returnTo, {
        slack_error: "token_exchange_failed",
      }),
    );
  }
}
