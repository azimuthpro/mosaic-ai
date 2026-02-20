import { NextResponse } from "next/server";

import { listChannels } from "@/lib/slack/client";
import { createClient, getUser } from "@/lib/supabase/server";

export async function GET(): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_integrations")
    .select("access_token")
    .eq("user_id", user.id)
    .eq("provider", "slack")
    .single();

  const integration = data as { access_token: string } | null;

  if (error || !integration) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 404 });
  }

  try {
    const channels = await listChannels(integration.access_token);
    return NextResponse.json({ channels });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list channels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
