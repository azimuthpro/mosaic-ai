import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { exchangeCodeForToken } from "@/lib/google/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import type { GoogleIntegrationMetadata } from "@/types/database";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/?google_error=${encodeURIComponent(error)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/?google_error=missing_params`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value;

  const colonIndex = state.indexOf(":");
  const stateValue = colonIndex === -1 ? state : state.slice(0, colonIndex);
  const returnTo =
    colonIndex === -1 ? "/" : decodeURIComponent(state.slice(colonIndex + 1));

  if (!savedState || savedState !== stateValue) {
    return NextResponse.redirect(`${appUrl}/?google_error=invalid_state`);
  }

  cookieStore.delete("google_oauth_state");

  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/sign-in`);
  }

  try {
    const tokenData = await exchangeCodeForToken(code);

    const metadata: GoogleIntegrationMetadata = {
      email: tokenData.email,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(
        Date.now() + tokenData.expires_in * 1000,
      ).toISOString(),
    };

    const adminClient = createAdminClient();
    const { data: upserted, error: upsertError } = await adminClient
      .from("user_integrations")
      .upsert(
        {
          user_id: user.id,
          provider: "google",
          provider_team_id: "",
          access_token: tokenData.access_token,
          metadata,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id,provider,provider_team_id" },
      )
      .select("id")
      .maybeSingle();

    if (upsertError || !upserted) {
      console.error(
        `[google/callback] Failed to save integration for user_id=${user.id}:`,
        upsertError ?? "no row returned",
      );
      return NextResponse.redirect(
        `${appUrl}${returnTo}?google_error=save_failed`,
      );
    }

    console.log(
      `[google/callback] Saved google integration for user_id=${user.id} (email=${tokenData.email || "unknown"})`,
    );
    return NextResponse.redirect(`${appUrl}${returnTo}?google_connected=1`);
  } catch (err) {
    console.error("[google/callback] Token exchange failed:", err);
    return NextResponse.redirect(
      `${appUrl}${returnTo}?google_error=token_exchange_failed`,
    );
  }
}
