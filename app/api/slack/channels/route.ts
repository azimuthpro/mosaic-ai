import { NextResponse } from "next/server";

import { listChannels } from "@/lib/slack/client";
import { createClient, getUser } from "@/lib/supabase/server";
import type { SlackIntegrationMetadata } from "@/types/database";

interface SlackChannel {
  id: string;
  name: string;
}

interface WorkspaceChannels {
  team_id: string;
  team_name: string;
  channels: SlackChannel[];
}

export async function GET(request: Request): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const teamIdFilter = searchParams.get("team_id");

  const supabase = await createClient();

  let query = supabase
    .from("user_integrations")
    .select("access_token, metadata, provider_team_id")
    .eq("user_id", user.id)
    .eq("provider", "slack");

  if (teamIdFilter) {
    query = query.eq("provider_team_id", teamIdFilter);
  }

  const { data, error } = await query;

  interface IntegrationRow {
    access_token: string;
    metadata: SlackIntegrationMetadata | null;
    provider_team_id: string;
  }

  const integrations = data as IntegrationRow[] | null;

  if (error || !integrations || integrations.length === 0) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 404 });
  }

  try {
    const workspaces: WorkspaceChannels[] = [];

    for (const { access_token, metadata, provider_team_id } of integrations) {
      const channels = await listChannels(access_token);
      workspaces.push({
        team_id: provider_team_id,
        team_name: metadata?.team_name || "Slack Workspace",
        channels,
      });
    }

    const allChannels = workspaces.flatMap((w) => w.channels);
    return NextResponse.json({ workspaces, channels: allChannels });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list channels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
