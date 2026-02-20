import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSlackOAuthUrl } from "@/lib/slack/oauth";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("return_to") ?? "/";

  // Generate a random state to prevent CSRF
  const state = randomBytes(16).toString("hex");

  const cookieStore = await cookies();
  cookieStore.set("slack_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const oauthUrl = getSlackOAuthUrl(state, returnTo);
  return NextResponse.redirect(oauthUrl);
}
