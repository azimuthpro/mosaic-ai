import { tool } from "ai";
import { z } from "zod";

import {
  findTilesByQuery,
  getLatestTileResult,
  getMosaicTiles,
  getTileStatus,
  getUserMosaics,
  runTileForUser,
  searchByName,
} from "./data";

/**
 * Creates AI tools scoped to a specific Mosaic user.
 */
export function createBotTools(userId: string) {
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
        "Get the execution status and recent jobs for a specific tile by ID.",
      inputSchema: z.object({
        tile_id: z.string().describe("The tile ID (UUID)."),
      }),
      execute: async ({ tile_id }) => {
        const result = await getTileStatus(tile_id);
        if (!result.tile) return "Tile not found.";
        return {
          tile: {
            name: result.tile.name,
            type: result.tile.tile_type,
            schedule: result.tile.schedule_cron,
            active: result.tile.is_active,
          },
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
        const result = await getLatestTileResult(tile_id);
        if (!result) return "No results found for this tile.";

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
        "Run a tile to execute it now. Use this when the user asks to run a tile, create a GitHub issue, trigger an analysis, or otherwise execute a tile. Optionally provide custom input text instead of using the tile's configured sources.",
      inputSchema: z.object({
        tile_id: z
          .string()
          .describe("The tile ID (UUID). Use search or find_tile to find it."),
        input: z
          .string()
          .optional()
          .describe(
            "Optional custom input text. If provided, this replaces the tile's normal source content. Useful for creating issues or running analyses on specific text from the conversation.",
          ),
      }),
      execute: async ({ tile_id, input }) => {
        return runTileForUser(userId, tile_id, input);
      },
    }),
  };
}
