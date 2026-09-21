import { analyzeContent } from "@/lib/ai/gemini";
import { executeCatalogUpdate } from "@/lib/catalog/execute-catalog";
import { executeOfferSender } from "@/lib/email/execute-offer-sender";
import { postOfferDraftToSlack } from "@/lib/email/post-offer-draft-slack";
import { attachSlackMessageTs } from "@/lib/email/send-offer-draft";
import {
  createExecutionContext,
  DEFAULT_MAX_DEPTH,
  DEFAULT_TIMEOUT_MS,
} from "@/lib/execution/context";
import { executeGitHubIssue } from "@/lib/github/execute-github-issue";
import { verifyMosaicAccess } from "@/lib/mosaics/access";
import { getMosaicTimezone } from "@/lib/mosaics/timezone";
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
  Json,
  OfferDraftResult,
  OfferDraftSlackContext,
  OfferSenderConfig,
  Tile,
  TileConnection,
  TileJob,
  TileJobInsert,
  TileJobResultInsert,
  TileJobUpdate,
  TileSource,
} from "@/types/database";

const SLACK_API_BASE = "https://slack.com/api";

// Type helper for RPC calls (since functions are created dynamically via migration)
type RpcClient = {
  rpc: <T>(
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: Error | null }>;
};

/** How long a resolved Slack → Mosaic user match is trusted. */
const USER_CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Keyed by `teamId:slackUserId` — Slack user IDs are only unique within a
 * workspace. Entries expire so a user removed from Mosaic stops being matched
 * without waiting for the instance to recycle.
 */
const userCache = new Map<string, { userId: string; expiresAt: number }>();

export type SlackIdentityFailure =
  | "slack_api_error"
  | "no_email"
  | "no_matching_user";

export type SlackIdentityResult =
  | { ok: true; userId: string }
  | { ok: false; reason: SlackIdentityFailure };

interface SlackUsersInfoResponse {
  ok: boolean;
  error?: string;
  user?: { profile?: { email?: string } };
}

/**
 * Resolves a Slack user to a Mosaic user ID by looking up the Slack user's
 * email and matching it against Supabase auth.users.
 *
 * Returns a reason on failure: a missing `users:read.email` scope and an
 * unknown email need different messages, and only the second one is
 * something the user can fix themselves.
 */
export async function resolveSlackIdentity(
  token: string,
  teamId: string,
  slackUserId: string,
): Promise<SlackIdentityResult> {
  const cacheKey = `${teamId}:${slackUserId}`;
  const cached = userCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, userId: cached.userId };
  }
  userCache.delete(cacheKey);

  // Get email from Slack
  let data: SlackUsersInfoResponse;
  try {
    const res = await fetch(
      `${SLACK_API_BASE}/users.info?user=${encodeURIComponent(slackUserId)}&include_locale=false`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    data = (await res.json()) as SlackUsersInfoResponse;
  } catch (err) {
    console.error("[bot] Slack users.info request failed:", err);
    return { ok: false, reason: "slack_api_error" };
  }

  if (!data.ok) {
    console.error("[bot] Slack users.info failed:", data.error);
    return { ok: false, reason: "slack_api_error" };
  }

  const email = data.user?.profile?.email?.trim().toLowerCase();
  if (!email) {
    // Almost always a token without the users:read.email scope.
    console.error("[bot] Slack profile has no email for user", slackUserId);
    return { ok: false, reason: "no_email" };
  }

  // Match against Supabase auth.users with a single indexed lookup.
  // Cast to RpcClient to handle dynamic RPC functions from migrations.
  const admin = createAdminClient();
  const rpcClient = admin as unknown as RpcClient;
  const { data: userId, error } = await rpcClient.rpc<string>(
    "find_user_id_by_email",
    { p_email: email },
  );

  if (error) {
    console.error("[bot] find_user_id_by_email failed:", error.message);
    return { ok: false, reason: "slack_api_error" };
  }
  // Misses are never cached: someone who signs up a minute later must get in.
  if (!userId) return { ok: false, reason: "no_matching_user" };

  userCache.set(cacheKey, {
    userId,
    expiresAt: Date.now() + USER_CACHE_TTL_MS,
  });
  return { ok: true, userId };
}

/**
 * Convenience wrapper for callers that only need the ID (the interactivity
 * route, which has no thread to explain a failure in).
 */
export async function resolveSlackUser(
  token: string,
  teamId: string,
  slackUserId: string,
): Promise<string | null> {
  const result = await resolveSlackIdentity(token, teamId, slackUserId);
  return result.ok ? result.userId : null;
}

/**
 * Verifies the user can reach a tile, via the mosaic that owns it.
 *
 * Every tile lookup in this module goes through here: the bot's tile IDs come
 * from an LLM, which takes them from whatever is in the Slack thread, so an
 * unscoped query would let any matched user read another mosaic's data.
 */
async function verifyTileAccess(
  admin: ReturnType<typeof createAdminClient>,
  tileId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("tiles")
    .select("mosaic_id")
    .eq("id", tileId)
    .maybeSingle();

  const mosaicId = (data as { mosaic_id?: string } | null)?.mosaic_id;
  if (!mosaicId) return false;

  return verifyMosaicAccess(admin, mosaicId, userId);
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
 * Reads the latest result row without an access check. Callers must already
 * have established access — either with verifyTileAccess, or by having found
 * the tile inside a mosaic the user can reach.
 */
async function fetchLatestResultRow(
  admin: ReturnType<typeof createAdminClient>,
  tileId: string,
) {
  const { data: results, error } = await admin
    .from("tile_job_results")
    .select("id, tile_id, content, format, created_at")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<ResultRow[]>();

  if (error) {
    console.error("[bot] fetchLatestResultRow error:", error.message);
    return null;
  }

  return results?.[0] ?? null;
}

/**
 * Gets the latest execution result for a tile the user has access to.
 * Returns null when the tile does not exist OR is not the user's — the bot must
 * not confirm that an ID it was handed is real.
 */
export async function getLatestTileResult(tileId: string, userId: string) {
  const admin = createAdminClient();

  if (!(await verifyTileAccess(admin, tileId, userId))) return null;

  return fetchLatestResultRow(admin, tileId);
}

/**
 * Gets recent execution status for a tile the user has access to.
 * Returns null when the tile does not exist or is not the user's.
 */
export async function getTileStatus(tileId: string, userId: string) {
  const admin = createAdminClient();

  if (!(await verifyTileAccess(admin, tileId, userId))) return null;

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

  // Fetch latest result for the top match. Access is already established: the
  // candidates only come from mosaics the user can reach.
  const topTileId = topCandidates[0].tile_id;
  const latestResult = await fetchLatestResultRow(admin, topTileId);
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
    name: data.channel.name ?? "",
    topic: data.channel.topic?.value ?? "",
    purpose: data.channel.purpose?.value ?? "",
  };
}

export interface BotSlackOrigin {
  teamId?: string;
  channelId?: string;
  threadTs?: string;
  botToken?: string;
}

/**
 * Runs a tile on behalf of a user from the bot.
 * Handles rate limiting, content fetching, execution, and result storage.
 * Optionally accepts custom input text to use instead of fetching from sources.
 * For offer_sender tiles, slackOrigin lets the bot post the draft preview
 * (with Approve/Cancel buttons) back into the originating thread.
 */
export async function runTileForUser(
  userId: string,
  tileId: string,
  input?: string,
  targetRepo?: string,
  slackOrigin?: BotSlackOrigin,
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
        return {
          success: false,
          message: `Rate limit exceeded: ${err.reason}`,
        };
      }
      throw err;
    }

    // Fetch connections
    const { data: connRows } = await admin
      .from("tile_connections")
      .select("*")
      .eq("target_tile_id", tileId);
    const connections = (connRows ?? []) as TileConnection[];

    // Create execution context (shared for both content fetching and job tracking)
    const executionContext = createExecutionContext({
      rootAgentId: tileId,
      userId,
      maxDepth: tile.max_chain_depth ?? DEFAULT_MAX_DEPTH,
      timeoutMs: tile.execution_timeout_ms ?? DEFAULT_TIMEOUT_MS,
    });

    // Determine content. Offer Sender treats `input` as the user's instruction
    // (comment) — not as scraped content — so we keep it separate.
    const isOfferSender = tile.tile_type === "offer_sender";
    let fetchedContent: string[];

    if (isOfferSender) {
      if (!input?.trim() && connections.length === 0) {
        return {
          success: false,
          message:
            "Offer Sender needs an instruction or a connected tile to know who to send to.",
        };
      }
      // Pull connection content but skip source-fetching; the comment carries intent.
      const connResults = connections.length
        ? await fetchConnectionContent(
            tileId,
            tile.tile_type,
            connections,
            admin,
            executionContext,
          )
        : [];
      fetchedContent = connResults
        .filter((r) => r.success && r.content)
        .map((r) => r.content!);
    } else if (input) {
      fetchedContent = [input];
    } else {
      const hasSources = tile.tile_sources.length > 0;
      const hasConnections = connections.length > 0;

      if (!hasSources && !hasConnections) {
        return {
          success: false,
          message: "Tile has no sources or connections configured.",
        };
      }

      const sourceResults = [];

      if (hasSources) {
        const results = await fetchAllTileSourcesContent(
          tile.tile_sources,
          admin,
          executionContext,
        );
        sourceResults.push(...results);
      }

      if (hasConnections) {
        const connResults = await fetchConnectionContent(
          tileId,
          tile.tile_type,
          connections,
          admin,
          executionContext,
          hasSources ? countActiveUrlSources(tile.tile_sources) : undefined,
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
    // Build optional slack draft context for offer_sender
    const offerSlackContext: OfferDraftSlackContext | undefined =
      isOfferSender &&
      slackOrigin?.teamId &&
      slackOrigin?.channelId &&
      slackOrigin?.threadTs
        ? {
            team_id: slackOrigin.teamId,
            channel_id: slackOrigin.channelId,
            thread_ts: slackOrigin.threadTs,
          }
        : undefined;

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
      } else if (isOfferSender) {
        const offerResult = await executeOfferSender(
          tileId,
          fetchedContent,
          input ?? null,
          tile.system_prompt,
          (tile.config ?? {}) as unknown as OfferSenderConfig,
          tile.language,
          admin,
          offerSlackContext,
        );
        resultContent = offerResult.jobResultContent as unknown as Json;
        resultFormat = "json";
        slackContent = offerResult.slackSummary;
      } else {
        const timezone = await getMosaicTimezone(admin, tileId);
        const analysis = await analyzeContent(
          fetchedContent,
          tile.system_prompt || "",
          tile.output_format,
          tile.language,
          tile.output_schema,
          timezone,
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

      // Offer Sender: post draft into the originating Slack thread with
      // Approve/Cancel buttons. Skip the regular Slack output.
      if (isOfferSender && offerSlackContext && slackOrigin?.botToken) {
        try {
          const posted = await postOfferDraftToSlack(
            slackOrigin.botToken,
            offerSlackContext.channel_id,
            offerSlackContext.thread_ts,
            job.id,
            resultContent as unknown as OfferDraftResult,
          );
          if (posted?.ts) {
            await attachSlackMessageTs(admin, job.id, posted.ts);
          }
        } catch (err) {
          console.error("[bot] failed to post offer draft to Slack:", err);
        }
      } else if (!isOfferSender) {
        await deliverSlackOutput(admin, tile, { content: slackContent });
      }

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

      // Trigger downstream (skip for offer_sender — drafts aren't completed work).
      if (!isOfferSender) {
        triggerDownstreamTiles(admin, {
          completedTileId: tileId,
          completedJobId: job.id,
          mosaicId: tile.mosaic_id,
          userId,
        }).catch((err) =>
          console.error("[bot] downstream trigger error:", err),
        );
      }

      if (isOfferSender) {
        const draft = resultContent as unknown as OfferDraftResult;
        const tail =
          offerSlackContext && slackOrigin?.botToken
            ? "I posted the draft above with Approve & Send / Cancel buttons."
            : "Draft saved — open the tile in Mosaic AI to review and send.";
        return {
          success: true,
          message: `Offer draft prepared for ${draft.recipient_email}. ${tail}`,
          content: `Subject: ${draft.subject}\n\n${draft.text.slice(0, 1500)}`,
        };
      }

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
