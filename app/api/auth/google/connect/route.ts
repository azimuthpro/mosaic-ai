import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getGoogleOAuthUrl } from "@/lib/google/oauth";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("return_to") ?? "/";

  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(getGoogleOAuthUrl(state, returnTo));
}
