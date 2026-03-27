import { authenticateApiRequest } from "@/lib/api/auth";
import { routeQuery } from "@/lib/router";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.valid || !authResult.mosaicId) {
    return Response.json(
      { error: authResult.error || "Authentication failed" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, threshold, max_candidates, skip_reasoning } = body as {
    query?: string;
    threshold?: number;
    max_candidates?: number;
    skip_reasoning?: boolean;
  };

  if (typeof query !== "string" || !query.trim()) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const result = await routeQuery(
    adminClient,
    authResult.mosaicId,
    query.trim(),
    {
      threshold,
      maxCandidates: max_candidates,
      skipReasoning: skip_reasoning,
    },
  );

  if ("error" in result) {
    const status = result.code === "NO_MATCHES" ? 404 : 500;
    return Response.json(result, { status });
  }

  return Response.json(result);
}
