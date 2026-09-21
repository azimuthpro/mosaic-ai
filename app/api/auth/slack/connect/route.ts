import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getSlackOAuthUrl, safeReturnPath } from "@/lib/slack/oauth";
import { getUser } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const returnTo = safeReturnPath(searchParams.get("return_to"));

  // Generate a random state to prevent CSRF
  const state = randomBytes(16).toString("hex");

  // The return path travels in the cookie, not in `state`: `state` round-trips
  // through slack.com and the browser's address bar, so it is attacker-supplied
  // on the way back. The cookie is not.
  const cookieStore = await cookies();
  cookieStore.set("slack_oauth_state", JSON.stringify({ state, returnTo }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // "strict" would drop the cookie on the redirect back from Slack
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return NextResponse.redirect(getSlackOAuthUrl(state));
}
