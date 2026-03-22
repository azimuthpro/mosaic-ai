import { NextResponse } from "next/server";
import { Octokit } from "octokit";

import { createClient, getUser } from "@/lib/supabase/server";

interface GitHubRepo {
  owner: string;
  name: string;
  full_name: string;
  private: boolean;
}

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
    .eq("provider", "github")
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "GitHub not connected" },
      { status: 404 },
    );
  }

  try {
    const token = (data as { access_token: string }).access_token;
    const octokit = new Octokit({ auth: token });
    const { data: repoData } =
      await octokit.rest.repos.listForAuthenticatedUser({
        sort: "updated",
        per_page: 100,
        affiliation: "owner,collaborator,organization_member",
      });

    const repos: GitHubRepo[] = repoData.map((r) => ({
      owner: r.owner.login,
      name: r.name,
      full_name: r.full_name,
      private: r.private,
    }));

    return NextResponse.json({ repos });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list repositories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
