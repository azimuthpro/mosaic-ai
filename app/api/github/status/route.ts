import { NextResponse } from "next/server";

import { createClient, getUser } from "@/lib/supabase/server";
import type { GitHubIntegrationMetadata } from "@/types/database";

export async function GET(): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_integrations")
    .select("metadata")
    .eq("user_id", user.id)
    .eq("provider", "github")
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ connected: false });
  }

  const metadata = (data as { metadata: GitHubIntegrationMetadata | null })
    .metadata;

  return NextResponse.json({
    connected: true,
    username: metadata?.username ?? null,
    avatar_url: metadata?.avatar_url ?? null,
  });
}
