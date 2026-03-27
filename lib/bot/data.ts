import { searchTiles } from "@/lib/router/search";
import { createAdminClient } from "@/lib/supabase/admin";

const SLACK_API_BASE = "https://slack.com/api";
const userCache = new Map<string, string>();

/**
 * Resolves a Slack user to a Mosaic user ID by looking up
 * the Slack user's email and matching it against Supabase auth.users.
 */
export async function resolveSlackUser(
  token: string,
  slackUserId: string,
): Promise<string | null> {
  const cached = userCache.get(slackUserId);
  if (cached) return cached;

  // Get email from Slack
  const res = await fetch(
    `${SLACK_API_BASE}/users.info?user=${slackUserId}&include_locale=false`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    user?: { profile?: { email?: string } };
  };

  if (!data.ok) {
    console.error("[bot] Slack users.info failed:", data.error);
    return null;
  }

  const email = data.user?.profile?.email;
  if (!email) {
    console.error("[bot] Slack user has no email:", slackUserId);
    return null;
  }

  console.log("[bot] resolving Slack email:", email);

  // Match against Supabase auth.users
  const admin = createAdminClient();
  const {
    data: { users },
    error,
  } = await admin.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    console.error("[bot] listUsers error:", error.message);
    return null;
  }

  if (!users || users.length === 0) {
    console.error("[bot] no users found in Supabase");
    return null;
  }

  console.log(
    "[bot] searching",
    users.length,
    "Supabase users for email:",
    email,
  );

  const match = users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!match) {
    console.error("[bot] no Supabase user matches email:", email);
    return null;
  }

  userCache.set(slackUserId, match.id);
  return match.id;
}

interface MosaicRow {
  id: string;
  name: string;
  created_at: string;
}

interface TileRow {
  id: string;
  name: string;
  mosaic_id: string;
  tile_type: string;
  schedule_interval: string | null;
  is_active: boolean;
  created_at: string;
}

interface JobRow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

interface ResultRow {
  id: string;
  tile_id: string;
  content: unknown;
  raw_text: string | null;
  created_at: string;
}

/**
 * Lists mosaics the user owns or has access to via mosaic_members.
 */
export async function getUserMosaics(userId: string) {
  const admin = createAdminClient();

  const { data: owned } = await admin
    .from("mosaics")
    .select("id, name, created_at")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .returns<MosaicRow[]>();

  const { data: memberships } = await admin
    .from("mosaic_members")
    .select("mosaic_id, role")
    .eq("user_id", userId)
    .returns<{ mosaic_id: string; role: string }[]>();

  const memberRows = memberships ?? [];
  const sharedMosaicIds = memberRows.map((m) => m.mosaic_id);

  let sharedMosaics: (MosaicRow & { role: string })[] = [];
  if (sharedMosaicIds.length > 0) {
    const { data: mosaicRows } = await admin
      .from("mosaics")
      .select("id, name, created_at")
      .in("id", sharedMosaicIds)
      .returns<MosaicRow[]>();

    const roleMap = new Map(memberRows.map((m) => [m.mosaic_id, m.role]));

    sharedMosaics = (mosaicRows ?? []).map((m) => ({
      ...m,
      role: roleMap.get(m.id) ?? "member",
    }));
  }

  // Get tile counts
  const allMosaicIds = [
    ...(owned ?? []).map((m) => m.id),
    ...sharedMosaics.map((m) => m.id),
  ];

  const tileCounts = new Map<string, number>();
  if (allMosaicIds.length > 0) {
    const { data: tiles } = await admin
      .from("tiles")
      .select("mosaic_id")
      .in("mosaic_id", allMosaicIds)
      .returns<{ mosaic_id: string }[]>();

    for (const tile of tiles ?? []) {
      tileCounts.set(tile.mosaic_id, (tileCounts.get(tile.mosaic_id) ?? 0) + 1);
    }
  }

  return {
    owned: (owned ?? []).map((m) => ({
      ...m,
      tileCount: tileCounts.get(m.id) ?? 0,
    })),
    shared: sharedMosaics.map((m) => ({
      ...m,
      tileCount: tileCounts.get(m.id) ?? 0,
    })),
  };
}

/**
 * Gets tiles in a mosaic, verifying user has access.
 */
export async function getMosaicTiles(mosaicId: string, userId: string) {
  const admin = createAdminClient();

  const hasAccess = await verifyMosaicAccess(admin, mosaicId, userId);
  if (!hasAccess) return null;

  const { data: tiles } = await admin
    .from("tiles")
    .select("id, name, tile_type, schedule_interval, is_active, created_at")
    .eq("mosaic_id", mosaicId)
    .order("created_at", { ascending: true })
    .returns<TileRow[]>();

  const { data: mosaic } = await admin
    .from("mosaics")
    .select("id, name")
    .eq("id", mosaicId)
    .maybeSingle();

  return { mosaic, tiles: tiles ?? [] };
}

/**
 * Gets the latest execution result for a tile.
 */
export async function getLatestTileResult(tileId: string) {
  const admin = createAdminClient();

  const { data: results } = await admin
    .from("tile_job_results")
    .select("id, tile_id, content, raw_text, created_at")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<ResultRow[]>();

  return results?.[0] ?? null;
}

/**
 * Gets recent execution status for a tile.
 */
export async function getTileStatus(tileId: string) {
  const admin = createAdminClient();

  const { data: tileRows } = await admin
    .from("tiles")
    .select("id, name, tile_type, schedule_interval, is_active")
    .eq("id", tileId)
    .limit(1)
    .returns<
      Pick<
        TileRow,
        "id" | "name" | "tile_type" | "schedule_interval" | "is_active"
      >[]
    >();

  const tile = tileRows?.[0] ?? null;

  const { data: recentJobs } = await admin
    .from("tile_jobs")
    .select("id, status, started_at, completed_at, error")
    .eq("tile_id", tileId)
    .order("started_at", { ascending: false })
    .limit(5)
    .returns<JobRow[]>();

  return { tile, recentJobs: recentJobs ?? [] };
}

/**
 * Searches mosaics and tiles by name (ILIKE).
 */
export async function searchByName(userId: string, query: string) {
  const admin = createAdminClient();
  const pattern = `%${query}%`;

  const { data: ownedMosaics } = await admin
    .from("mosaics")
    .select("id, name")
    .eq("owner_id", userId)
    .ilike("name", pattern)
    .returns<{ id: string; name: string }[]>();

  const { data: memberships } = await admin
    .from("mosaic_members")
    .select("mosaic_id")
    .eq("user_id", userId)
    .returns<{ mosaic_id: string }[]>();

  const memberMosaicIds = (memberships ?? []).map((m) => m.mosaic_id);

  let sharedMosaics: { id: string; name: string }[] = [];
  if (memberMosaicIds.length > 0) {
    const { data } = await admin
      .from("mosaics")
      .select("id, name")
      .in("id", memberMosaicIds)
      .ilike("name", pattern)
      .returns<{ id: string; name: string }[]>();
    sharedMosaics = data ?? [];
  }

  const mosaics = [...(ownedMosaics ?? []), ...sharedMosaics];

  // Search tiles in accessible mosaics
  const allMosaicIds = [
    ...(ownedMosaics ?? []).map((m) => m.id),
    ...memberMosaicIds,
  ];

  let tiles: {
    id: string;
    name: string;
    mosaic_id: string;
    tile_type: string;
  }[] = [];
  if (allMosaicIds.length > 0) {
    const { data } = await admin
      .from("tiles")
      .select("id, name, mosaic_id, tile_type")
      .in("mosaic_id", allMosaicIds)
      .ilike("name", pattern)
      .returns<
        { id: string; name: string; mosaic_id: string; tile_type: string }[]
      >();
    tiles = data ?? [];
  }

  return { mosaics, tiles };
}

/**
 * Finds tiles matching a natural language query using vector search.
 * Searches across all mosaics the user has access to and returns
 * top matches with their latest result snippet.
 */
export async function findTilesByQuery(userId: string, query: string) {
  const admin = createAdminClient();

  // Get all mosaic IDs the user can access
  const { data: owned } = await admin
    .from("mosaics")
    .select("id, name")
    .eq("owner_id", userId)
    .returns<{ id: string; name: string }[]>();

  const { data: memberships } = await admin
    .from("mosaic_members")
    .select("mosaic_id")
    .eq("user_id", userId)
    .returns<{ mosaic_id: string }[]>();

  const memberIds = (memberships ?? []).map((m) => m.mosaic_id);
  let sharedMosaics: { id: string; name: string }[] = [];
  if (memberIds.length > 0) {
    const { data } = await admin
      .from("mosaics")
      .select("id, name")
      .in("id", memberIds)
      .returns<{ id: string; name: string }[]>();
    sharedMosaics = data ?? [];
  }

  const allMosaics = [...(owned ?? []), ...sharedMosaics];
  if (allMosaics.length === 0) return { tiles: [] };

  const mosaicMap = new Map(allMosaics.map((m) => [m.id, m.name]));

  // Search tiles across all mosaics, tracking which mosaic each came from
  type CandidateWithMosaic = Awaited<ReturnType<typeof searchTiles>>[number] & {
    mosaic_id: string;
  };
  const allCandidates: CandidateWithMosaic[] = [];
  for (const mosaic of allMosaics) {
    try {
      const candidates = await searchTiles(admin, mosaic.id, query, {
        threshold: 0.3,
        limit: 3,
      });
      allCandidates.push(
        ...candidates.map((c) => ({ ...c, mosaic_id: mosaic.id })),
      );
    } catch {
      // Skip mosaics that fail (e.g., no embeddings yet)
    }
  }

  // Sort by similarity and take top 5
  allCandidates.sort((a, b) => b.similarity - a.similarity);
  const topCandidates = allCandidates.slice(0, 5);

  if (topCandidates.length === 0) return { tiles: [] };

  // Fetch latest result for the top match
  const topTileId = topCandidates[0].tile_id;
  const latestResult = await getLatestTileResult(topTileId);
  const resultSnippet = latestResult
    ? (typeof latestResult.raw_text === "string"
        ? latestResult.raw_text
        : JSON.stringify(latestResult.content)
      ).slice(0, 4000)
    : null;

  return {
    tiles: topCandidates.map((c) => ({
      tile_id: c.tile_id,
      tile_name: c.tile_name,
      tile_type: c.tile_type,
      mosaic_name: mosaicMap.get(c.mosaic_id) ?? "Unknown",
      description: c.semantic_description,
      similarity: c.similarity,
    })),
    top_result: resultSnippet
      ? {
          tile_id: topTileId,
          tile_name: topCandidates[0].tile_name,
          content: resultSnippet,
          created_at: latestResult!.created_at,
        }
      : null,
  };
}

async function verifyMosaicAccess(
  admin: ReturnType<typeof createAdminClient>,
  mosaicId: string,
  userId: string,
): Promise<boolean> {
  const { count: ownedCount } = await admin
    .from("mosaics")
    .select("id", { count: "exact", head: true })
    .eq("id", mosaicId)
    .eq("owner_id", userId);

  if (ownedCount) return true;

  const { count: memberCount } = await admin
    .from("mosaic_members")
    .select("id", { count: "exact", head: true })
    .eq("mosaic_id", mosaicId)
    .eq("user_id", userId);

  return (memberCount ?? 0) > 0;
}
