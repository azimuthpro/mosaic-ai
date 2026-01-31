import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback route for PKCE flow (Supabase-generated magic links).
 *
 * Exchanges the authorization code for a session.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/mosaics";
  const errorUrl = `${origin}/signin?error=auth_callback_error`;

  if (!code) {
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
