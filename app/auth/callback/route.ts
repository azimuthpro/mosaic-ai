import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback route for admin-generated magic links.
 *
 * Handles token verification for magic links sent via SendGrid.
 * Unlike the PKCE flow callback at /(auth)/callback, this route
 * uses verifyOtp with a token_hash parameter.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/mosaics";
  const errorUrl = `${origin}/signin?error=auth_callback_error`;

  if (!tokenHash || !type) {
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("Auth verification error:", error);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
