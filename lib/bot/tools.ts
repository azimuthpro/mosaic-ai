import { tool } from "ai";
import { z } from "zod";

import {
  getLatestTileResult,
  getMosaicTiles,
  getTileStatus,
  getUserMosaics,
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
            schedule: t.schedule_interval,
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
            schedule: result.tile.schedule_interval,
            active: result.tile.is_active,
          },
          recentJobs: result.recentJobs.map((j) => ({
            status: j.status,
            startedAt: j.started_at,
            completedAt: j.completed_at,
            error: j.error,
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
          typeof result.raw_text === "string"
            ? result.raw_text.slice(0, 8000)
            : JSON.stringify(result.content).slice(0, 8000);

        return {
          createdAt: result.created_at,
          content: text,
        };
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
  };
}
