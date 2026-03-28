import { analyzeContent } from "@/lib/ai/gemini";
import { executeCatalogUpdate } from "@/lib/catalog/execute-catalog";
import {
  createExecutionContext,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TIMEOUT_MS,
} from "@/lib/execution/context";
import { executeGitHubIssue } from "@/lib/github/execute-github-issue";
import { deliverSlackOutput } from "@/lib/outputs/slack-output";
import {
  assertRateLimitAllowed,
  checkAndIncrementRateLimit,
  decrementConcurrentCount,
  logTileJobExecutionEvent,
  RateLimitError,
} from "@/lib/rate-limit/limiter";
import { searchTiles } from "@/lib/router/search";
import {
  countActiveUrlSources,
  fetchAllTileSourcesContent,
  fetchConnectionContent,
} from "@/lib/sources/tile-content-fetcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { triggerDownstreamTiles } from "@/lib/tiles/trigger-downstream";
import { compareBySortOrder } from "@/lib/utils";
import type {
  GitHubIssueConfig,
  Tile,
  TileConnection,
  TileJob,
  TileJobInsert,
  TileJobResultInsert,
  TileJobUpdate,
  TileSource,
} from "@/types/database";

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
  schedule_cron: string | null;
  is_active: boolean;
  created_at: string;
}

interface JobRow {
  id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

interface ResultRow {
  id: string;
  tile_id: string;
  content: unknown;
  format: string;
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
    .select("id, name, tile_type, schedule_cron, is_active, created_at")
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

  const { data: results, error } = await admin
    .from("tile_job_results")
    .select("id, tile_id, content, format, created_at")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<ResultRow[]>();

  if (error) {
    console.error("[bot] getLatestTileResult error:", error.message);
    return null;
  }

  console.log(
    "[bot] getLatestTileResult",
    tileId,
    results?.length ? `found (${results[0].created_at})` : "no results",
  );

  return results?.[0] ?? null;
}

/**
 * Gets recent execution status for a tile.
 */
export async function getTileStatus(tileId: string) {
  const admin = createAdminClient();

  const { data: tileRows } = await admin
    .from("tiles")
    .select("id, name, tile_type, schedule_cron, is_active, config")
    .eq("id", tileId)
    .limit(1)
    .returns<
      (Pick<
        TileRow,
        "id" | "name" | "tile_type" | "schedule_cron" | "is_active"
      > & { config: unknown })[]
    >();

  const tile = tileRows?.[0] ?? null;

  const { data: recentJobs } = await admin
    .from("tile_jobs")
    .select("id, status, started_at, completed_at, error_message")
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
  console.log("[bot] findTilesByQuery across", allMosaics.length, "mosaics");

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

  console.log(
    "[bot] findTilesByQuery candidates:",
    topCandidates.map((c) => `${c.tile_name} (${c.similarity.toFixed(3)})`),
  );

  if (topCandidates.length === 0) return { tiles: [] };

  // Fetch latest result for the top match
  const topTileId = topCandidates[0].tile_id;
  const latestResult = await getLatestTileResult(topTileId);
  const resultSnippet = latestResult
    ? (typeof latestResult.content === "string"
        ? latestResult.content
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

/**
 * Fetches Slack channel info (name, topic, purpose) for context resolution.
 */
export async function getChannelInfo(
  token: string,
  channelId: string,
): Promise<{
  name: string;
  topic: string;
  purpose: string;
} | null> {
  const res = await fetch(
    `${SLACK_API_BASE}/conversations.info?channel=${channelId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = (await res.json()) as {
    ok: boolean;
    channel?: {
      name?: string;
      topic?: { value?: string };
      purpose?: { value?: string };
    };
  };
  if (!data.ok || !data.channel) return null;
  return {
    name: data.channel.name || "",
    topic: data.channel.topic?.value || "",
    purpose: data.channel.purpose?.value || "",
  };
}

/**
 * Runs a tile on behalf of a user from the bot.
 * Handles rate limiting, content fetching, execution, and result storage.
 * Optionally accepts custom input text to use instead of fetching from sources.
 */
export async function runTileForUser(
  userId: string,
  tileId: string,
  input?: string,
  targetRepo?: string,
): Promise<{ success: boolean; message: string; content?: string }> {
  const admin = createAdminClient();
  let rateLimitIncremented = false;

  try {
    // Fetch tile with sources
    const { data: tileRow } = await admin
      .from("tiles")
      .select("*, tile_sources!tile_sources_tile_id_fkey (*)")
      .eq("id", tileId)
      .single();

    if (!tileRow) return { success: false, message: "Tile not found." };

    const tile = tileRow as unknown as Tile & { tile_sources: TileSource[] };
    tile.tile_sources.sort(compareBySortOrder);

    // Verify access
    const hasAccess = await verifyMosaicAccess(admin, tile.mosaic_id, userId);
    if (!hasAccess)
      return { success: false, message: "You don't have access to this tile." };

    if (tile.tile_type === "knowledge_base") {
      return {
        success: false,
        message: "Knowledge base tiles cannot be executed.",
      };
    }

    // Rate limit
    const rateLimitResult = await checkAndIncrementRateLimit(admin, userId);
    try {
      assertRateLimitAllowed(rateLimitResult);
      rateLimitIncremented = true;
    } catch (err) {
      if (err instanceof RateLimitError) {
        return { success: false, message: `Rate limit exceeded: ${err.reason}` };
      }
      throw err;
    }

    // Fetch connections
    const { data: connRows } = await admin
      .from("tile_connections")
      .select("*")
      .eq("target_tile_id", tileId);
    const connections = (connRows || []) as TileConnection[];

    // Determine content
    let fetchedContent: string[];

    if (input) {
      // Use caller-provided input
      fetchedContent = [input];
    } else {
      // Fetch from sources and connections like normal execution
      const hasSources = tile.tile_sources.length > 0;
      const hasConnections = connections.length > 0;

      if (!hasSources && !hasConnections) {
        return {
          success: false,
          message: "Tile has no sources or connections configured.",
        };
      }

      const ctx = createExecutionContext({
        rootAgentId: tileId,
        userId,
        maxDepth: tile.max_chain_depth ?? DEFAULT_MAX_DEPTH,
        timeoutMs: tile.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS,
      });

      const sourceResults = [];

      if (hasSources) {
        const results = await fetchAllTileSourcesContent(
          tile.tile_sources,
          admin,
          ctx,
        );
        sourceResults.push(...results);

        if (hasConnections) {
          const connResults = await fetchConnectionContent(
            tileId,
            tile.tile_type,
            connections,
            admin,
            ctx,
            countActiveUrlSources(tile.tile_sources),
          );
          sourceResults.push(...connResults);
        }
      } else if (hasConnections) {
        const connResults = await fetchConnectionContent(
          tileId,
          tile.tile_type,
          connections,
          admin,
          ctx,
        );
        sourceResults.push(...connResults);
      }

      fetchedContent = sourceResults
        .filter((r) => r.success && r.content)
        .map((r) => r.content!);

      if (fetchedContent.length === 0) {
        return {
          success: false,
          message: "Failed to fetch content from tile sources.",
        };
      }
    }

    // Create execution context and job
    const executionContext = createExecutionContext({
      rootAgentId: tileId,
      userId,
      maxDepth: tile.max_chain_depth ?? DEFAULT_MAX_DEPTH,
      timeoutMs: tile.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS,
    });

    await logTileJobExecutionEvent(admin, {
      executionId: executionContext.executionId,
      tileId,
      eventType: "started",
      metadata: { tileType: tile.tile_type, trigger: "bot" },
    });

    const jobInsert: TileJobInsert = {
      tile_id: tileId,
      status: "processing",
      started_at: new Date().toISOString(),
      metadata: {
        execution_id: executionContext.executionId,
        chain_depth: 0,
      },
      execution_id: executionContext.executionId,
      chain_depth: 0,
    };

    const { data: jobData, error: jobError } = await admin
      .from("tile_jobs")
      .insert(jobInsert as never)
      .select()
      .single();

    const job = jobData as TileJob | null;
    if (jobError || !job) {
      return { success: false, message: "Failed to create execution job." };
    }

    try {
      let resultContent: import("@/types/database").Json;
      let resultFormat = tile.output_format;
      let slackContent: import("@/types/database").Json;

      if (tile.tile_type === "catalog") {
        const catalogResult = await executeCatalogUpdate(
          tileId,
          fetchedContent,
          tile.system_prompt,
          admin,
          job.id,
        );
        resultContent = catalogResult.jobResultContent;
        resultFormat = "json";
        slackContent = catalogResult.diff.summary;
      } else if (tile.tile_type === "github_issue") {
        const githubResult = await executeGitHubIssue(
          tileId,
          fetchedContent,
          tile.system_prompt,
          admin,
          (tile.config ?? {}) as unknown as GitHubIssueConfig,
          tile.language,
          targetRepo,
        );
        resultContent = githubResult.jobResultContent;
        resultFormat = "json";
        slackContent = githubResult.slackSummary;
      } else {
        const analysis = await analyzeContent(
          fetchedContent,
          tile.system_prompt || "",
          tile.output_format,
          tile.language,
          tile.output_schema,
        );
        if (!analysis.success) {
          throw new Error(analysis.error || "AI analysis failed");
        }
        resultContent = analysis.content;
        slackContent = resultContent;
      }

      // Save result
      const reportInsert: TileJobResultInsert = {
        job_id: job.id,
        tile_id: tileId,
        content: resultContent,
        format: resultFormat,
        source_urls: input ? ["bot-input"] : [],
      };
      await admin.from("tile_job_results").insert(reportInsert as never);

      // Deliver Slack output
      await deliverSlackOutput(admin, tile, { content: slackContent });

      // Mark completed
      const completedUpdate: TileJobUpdate = {
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          execution_id: executionContext.executionId,
          chain_depth: 0,
        },
      };
      await admin
        .from("tile_jobs")
        .update(completedUpdate as never)
        .eq("id", job.id);

      await logTileJobExecutionEvent(admin, {
        executionId: executionContext.executionId,
        tileId,
        jobId: job.id,
        eventType: "completed",
        metadata: {
          durationMs: Date.now() - executionContext.startTime,
          trigger: "bot",
        },
      });

      // Trigger downstream
      triggerDownstreamTiles(admin, {
        completedTileId: tileId,
        completedJobId: job.id,
        mosaicId: tile.mosaic_id,
        userId,
      }).catch((err) =>
        console.error("[bot] downstream trigger error:", err),
      );

      // Return summary
      const contentStr =
        typeof resultContent === "string"
          ? resultContent
          : JSON.stringify(resultContent);
      return {
        success: true,
        message: `Tile "${tile.name}" executed successfully.`,
        content: contentStr.slice(0, 4000),
      };
    } catch (execError) {
      const errorMsg =
        execError instanceof Error ? execError.message : String(execError);

      const failedUpdate: TileJobUpdate = {
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: errorMsg,
      };
      await admin
        .from("tile_jobs")
        .update(failedUpdate as never)
        .eq("id", job.id);

      await logTileJobExecutionEvent(admin, {
        executionId: executionContext.executionId,
        tileId,
        jobId: job.id,
        eventType: "failed",
        metadata: { error: errorMsg, trigger: "bot" },
      });

      return { success: false, message: `Execution failed: ${errorMsg}` };
    }
  } finally {
    if (rateLimitIncremented) {
      await decrementConcurrentCount(admin, userId);
    }
  }
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
