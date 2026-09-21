import { tool } from "ai";
import { z } from "zod";

import { searchWeb } from "@/lib/search/tavily";

import {
  findTilesByQuery,
  getChannelInfo,
  getLatestTileResult,
  getMosaicTiles,
  getTileStatus,
  getUserMosaics,
  runTileForUser,
  searchByName,
} from "./data";

interface GitHubRepoConfig {
  repos?: { owner: string; repo: string }[];
  owner?: string;
  repo?: string;
}

/**
 * Extracts "owner/repo" strings from a github_issue tile config.
 */
function extractRepoNames(config: unknown): string[] {
  const c = config as GitHubRepoConfig;
  if (c.repos?.length) {
    return c.repos.map((r) => `${r.owner}/${r.repo}`);
  }
  if (c.owner && c.repo) {
    return [`${c.owner}/${c.repo}`];
  }
  return [];
}

export interface BotToolContext {
  slackToken?: string;
  channelId?: string;
  teamId?: string;
  threadTs?: string;
}

/**
 * Creates AI tools scoped to a specific Mosaic user.
 */
export function createBotTools(userId: string, context?: BotToolContext) {
  return {
    list_mosaics: tool({
      description:
        "List all mosaics (workspaces) the user has access to, with tile counts.",
      inputSchema: z.object({}),
      execute: async () => {
        const { owned, shared } = await getUserMosaics(userId);
        const all = [
          ...owned.map((m) => ({ ...m, role: "owner" as const })),
          ...shared,
        ];

        if (all.length === 0) return "The user has no mosaics.";
        return all;
      },
    }),

    get_mosaic_details: tool({
      description:
        "Get the tiles in a specific mosaic by mosaic name or ID. Use search first if you only have a partial name.",
      inputSchema: z.object({
        mosaic_id: z
          .string()
          .describe("The mosaic ID (UUID). Use search to find it by name."),
      }),
      execute: async ({ mosaic_id }) => {
        const result = await getMosaicTiles(mosaic_id, userId);
        if (!result) return "Mosaic not found or user does not have access.";
        return {
          mosaic: result.mosaic,
          tiles: result.tiles.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.tile_type,
            schedule: t.schedule_cron,
            active: t.is_active,
          })),
        };
      },
    }),

    get_tile_status: tool({
      description:
        "Get the execution status and recent jobs for a specific tile by ID. For github_issue tiles, also returns configured repositories.",
      inputSchema: z.object({
        tile_id: z.string().describe("The tile ID (UUID)."),
      }),
      execute: async ({ tile_id }) => {
        const result = await getTileStatus(tile_id, userId);
        if (!result?.tile) return "Tile not found, or you don't have access.";
        const tileInfo: Record<string, unknown> = {
          name: result.tile.name,
          type: result.tile.tile_type,
          schedule: result.tile.schedule_cron,
          active: result.tile.is_active,
        };
        if (result.tile.tile_type === "github_issue" && result.tile.config) {
          tileInfo.repos = extractRepoNames(result.tile.config);
        }
        return {
          tile: tileInfo,
          recentJobs: result.recentJobs.map((j) => ({
            status: j.status,
            startedAt: j.started_at,
            completedAt: j.completed_at,
            error: j.error_message,
          })),
        };
      },
    }),

    get_tile_result: tool({
      description:
        "Get the latest execution result content from a specific tile by ID.",
      inputSchema: z.object({
        tile_id: z.string().describe("The tile ID (UUID)."),
      }),
      execute: async ({ tile_id }) => {
        const result = await getLatestTileResult(tile_id, userId);
        if (!result) {
          return "No results found for this tile, or you don't have access.";
        }

        const text =
          typeof result.content === "string"
            ? result.content.slice(0, 8000)
            : JSON.stringify(result.content).slice(0, 8000);

        return {
          createdAt: result.created_at,
          content: text,
        };
      },
    }),

    find_tile: tool({
      description:
        "Find the most relevant tile for a user's question using semantic search. Returns matching tiles with descriptions and the latest result from the top match. Use this FIRST when the user asks about their data.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "The user's natural language question or topic to search for.",
          ),
      }),
      execute: async ({ query }) => {
        const result = await findTilesByQuery(userId, query);
        if (result.tiles.length === 0) {
          return "No matching tiles found. Try the search tool to find tiles by name.";
        }
        return result;
      },
    }),

    search: tool({
      description:
        "Search mosaics and tiles by name. Use this to find IDs when the user refers to things by name.",
      inputSchema: z.object({
        query: z.string().describe("Search query to match against names."),
      }),
      execute: async ({ query }) => {
        const result = await searchByName(userId, query);
        return {
          mosaics: result.mosaics.map((m) => ({ id: m.id, name: m.name })),
          tiles: result.tiles.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.tile_type,
          })),
        };
      },
    }),

    run_tile: tool({
      description:
        "Run a tile to execute it now. Use this when the user asks to run a tile, create a GitHub issue, send an offer, trigger an analysis, or otherwise execute a tile. Optionally provide custom input text instead of using the tile's configured sources. For github_issue tiles with multiple repos, specify target_repo to select the right repository. For offer_sender tiles, pass the user's instruction (e.g. recipient email and personalization notes) as `input`; the bot will post a draft preview back into this Slack thread with Approve & Send / Cancel buttons.",
      inputSchema: z.object({
        tile_id: z
          .string()
          .describe("The tile ID (UUID). Use search or find_tile to find it."),
        input: z
          .string()
          .optional()
          .describe(
            "Optional custom input text. If provided, this replaces the tile's normal source content. Useful for creating issues, sending offers, or running analyses on specific text from the conversation.",
          ),
        target_repo: z
          .string()
          .optional()
          .describe(
            'Target repository in "owner/repo" format for github_issue tiles. Use get_channel_info and context clues (channel name, topic, links in message) to determine the right repo.',
          ),
      }),
      execute: ({ tile_id, input, target_repo }) =>
        runTileForUser(userId, tile_id, input, target_repo, {
          teamId: context?.teamId,
          channelId: context?.channelId,
          threadTs: context?.threadTs,
          botToken: context?.slackToken,
        }),
    }),

    get_channel_info: tool({
      description:
        "Get info about the current Slack channel (name, topic, purpose). Use this to determine context for selecting the right repository or tile when the user asks to create an issue or run a tile. Call this BEFORE run_tile for github_issue tiles to pick the correct target repo.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!context?.slackToken || !context?.channelId) {
          return "Channel context not available.";
        }
        const info = await getChannelInfo(
          context.slackToken,
          context.channelId,
        );
        if (!info) return "Could not fetch channel info.";
        return info;
      },
    }),

    web_search: tool({
      description:
        "Search the web for detailed information using Tavily. Use for deep research when you need thorough, structured results beyond what Google Search provides. Supports 'advanced' depth for comprehensive research.",
      inputSchema: z.object({
        query: z.string().describe("The search query."),
        depth: z
          .enum(["basic", "advanced"])
          .optional()
          .describe(
            "Search depth. Use 'advanced' for thorough research on complex topics.",
          ),
      }),
      execute: async ({ query, depth }) => {
        const results = await searchWeb(query, {
          searchDepth: depth ?? "basic",
          maxResults: 5,
        });
        return results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
          score: r.score,
        }));
      },
    }),
  };
}
