"use server";

import { revalidatePath } from "next/cache";

import { MAX_URLS_PER_TILE } from "@/lib/constants/tiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import { compareBySortOrder } from "@/lib/utils";
import type {
  Json,
  LanguageCode,
  OutputFormat,
  SlackSourceConfig,
  SourceType,
  Tile,
  TileConnection,
  TileInsert,
  TilePattern,
  TileSource,
  TileSourceInsert,
  TileSourceUpdate,
  TileType,
  TileUpdate,
  UrlSourceConfig,
  WebSearchConfig,
} from "@/types/database";

export type TileWithSources = Tile & { sources: TileSource[] };
export type TileWithConnections = Tile & {
  sources: TileSource[];
  incoming_connections: TileConnection[];
  outgoing_connections: TileConnection[];
};

type TileQueryResult = Tile & {
  tile_sources: TileSource[] | null;
};

/** Fire-and-forget: re-index a tile for router vector search */
function reindexTileAsync(tileId: string): void {
  const admin = createAdminClient();
  const query = admin
    .from("tiles")
    .select("*, tile_sources!tile_sources_tile_id_fkey (*)")
    .eq("id", tileId)
    .single();

  // Wrap in Promise.resolve because Supabase returns PromiseLike (no .catch)
  Promise.resolve(query)
    .then(({ data }) => {
      if (!data) return;
      const tile = data as unknown as Tile & { tile_sources: TileSource[] };
      return import("@/lib/router/index-tile").then(({ indexTile }) =>
        indexTile(admin, tile, tile.tile_sources || []),
      );
    })
    .catch((err) =>
      console.error(`[router/sync] Failed to re-index tile ${tileId}:`, err),
    );
}

/**
 * Get all tiles in a mosaic
 */
export async function getTiles(mosaicId: string): Promise<TileWithSources[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("tiles")
    .select(
      `
      *,
      tile_sources!tile_sources_tile_id_fkey (*)
    `,
    )
    .eq("mosaic_id", mosaicId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching tiles:", error);
    return [];
  }

  return ((data as TileQueryResult[]) || []).map((t) => ({
    ...t,
    sources: (t.tile_sources || []).sort(compareBySortOrder),
  })) as TileWithSources[];
}

/**
 * Get a single tile by ID
 */
export async function getTile(id: string): Promise<TileWithConnections | null> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("tiles")
    .select(
      `
      *,
      tile_sources!tile_sources_tile_id_fkey (*)
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching tile:", error);
    return null;
  }

  const tile = data as TileQueryResult;

  // Get connections
  const { data: incomingConnections } = await supabase
    .from("tile_connections")
    .select("*")
    .eq("target_tile_id", id);

  const { data: outgoingConnections } = await supabase
    .from("tile_connections")
    .select("*")
    .eq("source_tile_id", id);

  return {
    ...tile,
    sources: (tile.tile_sources || []).sort(compareBySortOrder),
    incoming_connections: (incomingConnections as TileConnection[]) || [],
    outgoing_connections: (outgoingConnections as TileConnection[]) || [],
  } as TileWithConnections;
}

interface CreateTileParams {
  mosaicId: string;
  name: string;
  description?: string;
  tileType: TileType;
  color?: string;
  pattern?: TilePattern;
  gridX?: number;
  gridY?: number;
  gridWidth?: number;
  gridHeight?: number;
  systemPrompt?: string;
  outputFormat?: OutputFormat;
  outputSchema?: string;
  language?: LanguageCode;
  scheduleCron?: string;
  triggerOnSourceUpdate?: boolean;
  sources?: {
    url?: string;
    name?: string;
    type?: SourceType;
    config?: WebSearchConfig;
  }[];
  connections?: string[]; // IDs of source tiles to connect
  slackChannels?: { channel_id: string; channel_name: string }[];
  slackTimeWindowDays?: number;
  config?: import("@/types/database").Json; // Type-specific configuration (e.g., GitHubIssueConfig)
}

/**
 * Create a new tile
 */
export async function createTile(params: CreateTileParams) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify mosaic ownership or admin access
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("id, owner_id")
    .eq("id", params.mosaicId)
    .single();

  const mosaic = mosaicData as { id: string; owner_id: string } | null;
  const isOwner = mosaic?.owner_id === user.id;

  if (!isOwner) {
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", params.mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Not authorized to create tiles in this mosaic" };
    }
  }

  const tileInsert: TileInsert = {
    mosaic_id: params.mosaicId,
    name: params.name,
    description: params.description || null,
    tile_type: params.tileType,
    color: params.color || "#3B82F6",
    pattern: params.pattern || "solid",
    grid_x: params.gridX ?? 0,
    grid_y: params.gridY ?? 0,
    grid_width: params.gridWidth ?? 1,
    grid_height: params.gridHeight ?? 1,
    system_prompt: params.systemPrompt || null,
    output_format: params.outputFormat || "text",
    language: params.language || "en",
    schedule_cron: params.scheduleCron || null,
    is_active: true,
    ...(params.config ? { config: params.config } : {}),
  };

  const { data: tileData, error: tileError } = await supabase
    .from("tiles")
    .insert(tileInsert as never)
    .select()
    .single();

  if (tileError || !tileData) {
    console.error("Error creating tile:", tileError);
    return { error: "Failed to create tile" };
  }

  const tile = tileData as Tile;

  // Create sources if provided
  if (params.sources && params.sources.length > 0) {
    const sourceData: TileSourceInsert[] = params.sources.map((s) => ({
      tile_id: tile.id,
      url: s.type === "url" ? s.url : null,
      name: s.name || null,
      type: s.type || "url",
      config:
        s.type === "web_search" && s.config
          ? (s.config as unknown as Json)
          : {},
    }));

    const { error: sourcesError } = await supabase
      .from("tile_sources")
      .insert(sourceData as never);

    if (sourcesError) {
      console.error("Error creating tile sources:", sourcesError);
      // Rollback
      await supabase.from("tiles").delete().eq("id", tile.id);
      return { error: "Failed to create tile sources" };
    }
  }

  // Create Slack channel sources for slack_reader tiles
  if (params.slackChannels && params.slackChannels.length > 0) {
    const daysBack = params.slackTimeWindowDays ?? 7;
    const slackSourceData: TileSourceInsert[] = params.slackChannels.map(
      (ch) => ({
        tile_id: tile.id,
        type: "slack_channel" as SourceType,
        url: null,
        name: ch.channel_name,
        config: {
          channel_id: ch.channel_id,
          channel_name: ch.channel_name,
          max_messages: 100,
          include_threads: true,
          days_back: daysBack,
        } as unknown as Json,
      }),
    );

    const { error: slackSourcesError } = await supabase
      .from("tile_sources")
      .insert(slackSourceData as never);

    if (slackSourcesError) {
      console.error("Error creating Slack channel sources:", slackSourcesError);
      await supabase.from("tiles").delete().eq("id", tile.id);
      return { error: "Failed to create Slack channel sources" };
    }
  }

  // Create connections if provided
  if (params.connections && params.connections.length > 0) {
    const connectionData = params.connections.map((sourceId) => ({
      mosaic_id: params.mosaicId,
      source_tile_id: sourceId,
      target_tile_id: tile.id,
    }));

    const { error: connError } = await supabase
      .from("tile_connections")
      .insert(connectionData as never);

    if (connError) {
      console.error("Error creating tile connections:", connError);
      // Non-fatal, but log it
    }
  }

  revalidatePath(`/mosaics/${params.mosaicId}`);
  reindexTileAsync(tile.id);
  return { success: true, tile };
}

/**
 * Update a tile
 */
export async function updateTile(
  id: string,
  params: Partial<CreateTileParams>,
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const updateData: TileUpdate = {};
  if (params.name !== undefined) updateData.name = params.name;
  if (params.description !== undefined)
    updateData.description = params.description || null;
  if (params.tileType !== undefined) updateData.tile_type = params.tileType;
  if (params.color !== undefined) updateData.color = params.color;
  if (params.pattern !== undefined) updateData.pattern = params.pattern;
  if (params.gridX !== undefined) updateData.grid_x = params.gridX;
  if (params.gridY !== undefined) updateData.grid_y = params.gridY;
  if (params.gridWidth !== undefined) updateData.grid_width = params.gridWidth;
  if (params.gridHeight !== undefined)
    updateData.grid_height = params.gridHeight;
  if (params.systemPrompt !== undefined)
    updateData.system_prompt = params.systemPrompt || null;
  if (params.outputFormat !== undefined)
    updateData.output_format = params.outputFormat;
  if (params.outputSchema !== undefined)
    updateData.output_schema = params.outputSchema || null;
  if (params.language !== undefined) updateData.language = params.language;
  if (params.scheduleCron !== undefined)
    updateData.schedule_cron = params.scheduleCron || null;
  if (params.triggerOnSourceUpdate !== undefined)
    updateData.trigger_on_source_update = params.triggerOnSourceUpdate;
  if (params.config !== undefined) updateData.config = params.config;

  const { data: tileData, error } = await supabase
    .from("tiles")
    .update(updateData as never)
    .eq("id", id)
    .select("mosaic_id")
    .single();

  if (error) {
    console.error("Error updating tile:", error);
    return { error: "Failed to update tile" };
  }

  const tile = tileData as { mosaic_id: string };
  revalidatePath(`/mosaics/${tile.mosaic_id}`);
  reindexTileAsync(id);
  return { success: true };
}

/**
 * Update tile position on the grid
 */
export async function updateTilePosition(
  id: string,
  gridX: number,
  gridY: number,
  gridWidth?: number,
  gridHeight?: number,
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const updateData: TileUpdate = {
    grid_x: gridX,
    grid_y: gridY,
  };
  if (gridWidth !== undefined) updateData.grid_width = gridWidth;
  if (gridHeight !== undefined) updateData.grid_height = gridHeight;

  const { data: tileData, error } = await supabase
    .from("tiles")
    .update(updateData as never)
    .eq("id", id)
    .select("mosaic_id")
    .single();

  if (error) {
    console.error("Error updating tile position:", error);
    return { error: "Failed to update tile position" };
  }

  const tile = tileData as { mosaic_id: string };
  revalidatePath(`/mosaics/${tile.mosaic_id}`);
  return { success: true };
}

/**
 * Delete a tile
 */
export async function deleteTile(id: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get mosaic ID for revalidation
  const { data: tileData } = await supabase
    .from("tiles")
    .select("mosaic_id")
    .eq("id", id)
    .single();

  const tile = tileData as { mosaic_id: string } | null;
  if (!tile) {
    return { error: "Tile not found" };
  }

  const { error } = await supabase.from("tiles").delete().eq("id", id);

  if (error) {
    console.error("Error deleting tile:", error);
    return { error: "Failed to delete tile" };
  }

  revalidatePath(`/mosaics/${tile.mosaic_id}`);
  return { success: true };
}

/**
 * Toggle tile active state
 */
export async function toggleTileActive(id: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get current state
  const { data: tileData, error: fetchError } = await supabase
    .from("tiles")
    .select("is_active, mosaic_id")
    .eq("id", id)
    .single();

  const tile = tileData as { is_active: boolean; mosaic_id: string } | null;
  if (fetchError || !tile) {
    return { error: "Tile not found" };
  }

  const newIsActive = !tile.is_active;

  const { error } = await supabase
    .from("tiles")
    .update({ is_active: newIsActive } as never)
    .eq("id", id);

  if (error) {
    console.error("Error toggling tile:", error);
    return { error: "Failed to toggle tile" };
  }

  revalidatePath(`/mosaics/${tile.mosaic_id}`);
  return { success: true, isActive: newIsActive };
}

/**
 * Update tile Slack output settings
 */
export async function updateTileSlackOutput(
  tileId: string,
  config: {
    enabled: boolean;
    channelId: string | null;
    channelName: string | null;
    teamId?: string | null;
  },
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: tileData, error } = await supabase
    .from("tiles")
    .update({
      slack_output_enabled: config.enabled,
      slack_output_channel_id: config.channelId,
      slack_output_channel_name: config.channelName,
      slack_output_team_id: config.teamId ?? null,
    } as never)
    .eq("id", tileId)
    .select("mosaic_id")
    .single();

  if (error) {
    console.error("Error updating tile Slack output:", error);
    return { error: "Failed to update Slack output settings" };
  }

  const tile = tileData as { mosaic_id: string };
  revalidatePath(`/mosaics/${tile.mosaic_id}`);
  return { success: true };
}

// ============================================================================
// Tile Sources
// ============================================================================

interface AddTileSourceParams {
  tileId: string;
  type?: SourceType;
  url?: string;
  name?: string;
  config?: WebSearchConfig;
  urlConfig?: UrlSourceConfig;
  slackConfig?: SlackSourceConfig;
}

/**
 * Add a source to a tile
 */
export async function addTileSource(params: AddTileSourceParams) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const sourceType = params.type ?? "url";

  // Verify tile access
  const { data: tileData } = await supabase
    .from("tiles")
    .select("id, mosaic_id")
    .eq("id", params.tileId)
    .single();

  const tile = tileData as { id: string; mosaic_id: string } | null;
  if (!tile) {
    return { error: "Tile not found" };
  }

  // Enforce URL limit for URL sources
  if (sourceType === "url") {
    const { count, error: countError } = await supabase
      .from("tile_sources")
      .select("*", { count: "exact", head: true })
      .eq("tile_id", params.tileId)
      .eq("type", "url");

    if (countError) {
      console.error("Error counting URL sources:", countError);
      return { error: "Failed to check source count" };
    }

    if ((count ?? 0) >= MAX_URLS_PER_TILE) {
      return {
        error: `Maximum of ${MAX_URLS_PER_TILE} URL sources per tile reached`,
      };
    }
  }

  // Validate based on source type
  if (sourceType === "url" && !params.url) {
    return { error: "URL is required for URL source type" };
  }

  if (sourceType === "slack_channel" && !params.slackConfig?.channel_id) {
    return { error: "Channel is required for Slack channel source type" };
  }

  // Validate URL for SSRF protection (backend safety layer)
  if (sourceType === "url" && params.url) {
    const { validateUrlWithDnsCheck } =
      await import("@/lib/validation/url-validator");
    const urlValidation = await validateUrlWithDnsCheck(params.url);
    if (!urlValidation.isValid) {
      return { error: urlValidation.error || "Invalid URL" };
    }
  }

  if (sourceType === "web_search" && !params.config?.query) {
    return { error: "Search query is required for web_search source type" };
  }

  const configByType: Partial<Record<SourceType, unknown>> = {
    url: params.urlConfig,
    web_search: params.config,
    slack_channel: params.slackConfig,
  };
  const config = (configByType[sourceType] as Json) ?? {};

  // Compute next sort_order for this tile
  const { data: maxOrderRow } = await supabase
    .from("tile_sources")
    .select("sort_order")
    .eq("tile_id", params.tileId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const nextSortOrder =
    ((maxOrderRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const sourceInsert: TileSourceInsert = {
    tile_id: params.tileId,
    type: sourceType,
    url: sourceType === "url" ? params.url : null,
    name:
      params.name ??
      (sourceType === "slack_channel"
        ? (params.slackConfig?.channel_name ?? null)
        : null),
    config,
    sort_order: nextSortOrder,
  };

  const { data, error } = await supabase
    .from("tile_sources")
    .insert(sourceInsert as never)
    .select()
    .single();

  if (error) {
    console.error("Error adding tile source:", error);
    return { error: "Failed to add source" };
  }

  if (!data) {
    console.error(
      "Error adding tile source: insert succeeded but no data returned",
    );
    return { error: "Failed to add source" };
  }

  revalidatePath(`/mosaics/${tile.mosaic_id}`);
  reindexTileAsync(params.tileId);
  return { success: true, source: data };
}

/**
 * Delete a tile source
 */
export async function deleteTileSource(sourceId: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get source to find mosaic for revalidation
  const { data: sourceData } = await supabase
    .from("tile_sources")
    .select(
      `
      id,
      tile_id,
      tiles!tile_sources_tile_id_fkey (mosaic_id)
    `,
    )
    .eq("id", sourceId)
    .single();

  type SourceWithTile = {
    id: string;
    tile_id: string;
    tiles: { mosaic_id: string };
  };
  const source = sourceData as SourceWithTile | null;
  if (!source) {
    return { error: "Source not found" };
  }

  const { error } = await supabase
    .from("tile_sources")
    .delete()
    .eq("id", sourceId);

  if (error) {
    console.error("Error deleting tile source:", error);
    return { error: "Failed to delete source" };
  }

  revalidatePath(`/mosaics/${source.tiles.mosaic_id}`);
  reindexTileAsync(source.tile_id);
  return { success: true };
}

/**
 * Update a tile source
 */
export async function updateTileSource(
  sourceId: string,
  params: {
    url?: string;
    name?: string | null;
    is_active?: boolean;
    config?: Record<string, unknown>;
  },
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get source to find mosaic for revalidation and validate type
  const { data: sourceData } = await supabase
    .from("tile_sources")
    .select(
      `
      id,
      tile_id,
      type,
      tiles!tile_sources_tile_id_fkey (mosaic_id)
    `,
    )
    .eq("id", sourceId)
    .single();

  type SourceWithTile = {
    id: string;
    tile_id: string;
    type: SourceType;
    tiles: { mosaic_id: string };
  };
  const source = sourceData as SourceWithTile | null;
  if (!source) {
    return { error: "Source not found" };
  }

  // Validate based on source type
  if (source.type === "url" && params.url !== undefined && !params.url.trim()) {
    return { error: "URL cannot be empty" };
  }

  // Validate URL for SSRF protection (backend safety layer)
  if (source.type === "url" && params.url) {
    const { validateUrlWithDnsCheck } =
      await import("@/lib/validation/url-validator");
    const urlValidation = await validateUrlWithDnsCheck(params.url);
    if (!urlValidation.isValid) {
      return { error: urlValidation.error || "Invalid URL" };
    }
  }

  if (
    source.type === "web_search" &&
    params.config?.query !== undefined &&
    !(params.config.query as string).trim()
  ) {
    return { error: "Search query cannot be empty" };
  }

  const updateData: TileSourceUpdate = {};
  if (params.url !== undefined) updateData.url = params.url;
  if (params.name !== undefined) updateData.name = params.name;
  if (params.is_active !== undefined) updateData.is_active = params.is_active;
  if (params.config !== undefined)
    updateData.config = params.config as unknown as Json;

  const { error } = await supabase
    .from("tile_sources")
    .update(updateData as never)
    .eq("id", sourceId);

  if (error) {
    console.error("Error updating tile source:", error);
    return { error: "Failed to update source" };
  }

  revalidatePath(`/mosaics/${source.tiles.mosaic_id}`);
  reindexTileAsync(source.tile_id);
  return { success: true };
}

/**
 * Reorder tile sources by updating their sort_order values.
 */
export async function reorderTileSources(tileId: string, sourceIds: string[]) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify tile access
  const { data: tileData } = await supabase
    .from("tiles")
    .select("mosaic_id")
    .eq("id", tileId)
    .single();

  const tile = tileData as { mosaic_id: string } | null;
  if (!tile) {
    return { error: "Tile not found" };
  }

  // Update sort_order for each source
  const results = await Promise.all(
    sourceIds.map((id, index) =>
      supabase
        .from("tile_sources")
        .update({ sort_order: index } as never)
        .eq("id", id)
        .eq("tile_id", tileId),
    ),
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("Error reordering tile sources:", failed.error);
    return { error: "Failed to reorder sources" };
  }

  revalidatePath(`/mosaics/${tile.mosaic_id}`);
  return { success: true };
}

// ============================================================================
// Tile Connections
// ============================================================================

/**
 * Get all connections in a mosaic
 */
export async function getTileConnections(
  mosaicId: string,
): Promise<TileConnection[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("tile_connections")
    .select("*")
    .eq("mosaic_id", mosaicId);

  if (error) {
    console.error("Error fetching tile connections:", error);
    return [];
  }

  return (data || []) as TileConnection[];
}

/**
 * Create a connection between tiles
 */
export async function createTileConnection(
  mosaicId: string,
  sourceTileId: string,
  targetTileId: string,
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check for circular dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hasCycle } = await (supabase.rpc as any)(
    "check_tile_circular_dependency",
    {
      p_source_tile_id: sourceTileId,
      p_target_tile_id: targetTileId,
    },
  );

  if (hasCycle) {
    return {
      error: "Cannot create connection: would create a circular dependency",
    };
  }

  const { error } = await supabase.from("tile_connections").insert({
    mosaic_id: mosaicId,
    source_tile_id: sourceTileId,
    target_tile_id: targetTileId,
  } as never);

  if (error) {
    if (error.code === "23505") {
      return { error: "Connection already exists" };
    }
    console.error("Error creating tile connection:", error);
    return { error: "Failed to create connection" };
  }

  revalidatePath(`/mosaics/${mosaicId}`);
  return { success: true };
}

/**
 * Update a tile connection (change source tile)
 */
export async function updateTileConnection(
  connectionId: string,
  newSourceTileId: string,
) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get existing connection
  const { data: connectionData } = await supabase
    .from("tile_connections")
    .select("mosaic_id, target_tile_id")
    .eq("id", connectionId)
    .single();

  const connection = connectionData as {
    mosaic_id: string;
    target_tile_id: string;
  } | null;
  if (!connection) {
    return { error: "Connection not found" };
  }

  // Check for circular dependency with new source
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hasCycle } = await (supabase.rpc as any)(
    "check_tile_circular_dependency",
    {
      p_source_tile_id: newSourceTileId,
      p_target_tile_id: connection.target_tile_id,
    },
  );

  if (hasCycle) {
    return {
      error: "Cannot update connection: would create a circular dependency",
    };
  }

  const { error } = await supabase
    .from("tile_connections")
    .update({ source_tile_id: newSourceTileId } as never)
    .eq("id", connectionId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Connection to that tile already exists" };
    }
    console.error("Error updating tile connection:", error);
    return { error: "Failed to update connection" };
  }

  revalidatePath(`/mosaics/${connection.mosaic_id}`);
  return { success: true };
}

/**
 * Delete a tile connection
 */
export async function deleteTileConnection(connectionId: string) {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get connection for revalidation
  const { data: connectionData } = await supabase
    .from("tile_connections")
    .select("mosaic_id")
    .eq("id", connectionId)
    .single();

  const connection = connectionData as { mosaic_id: string } | null;
  if (!connection) {
    return { error: "Connection not found" };
  }

  const { error } = await supabase
    .from("tile_connections")
    .delete()
    .eq("id", connectionId);

  if (error) {
    console.error("Error deleting tile connection:", error);
    return { error: "Failed to delete connection" };
  }

  revalidatePath(`/mosaics/${connection.mosaic_id}`);
  return { success: true };
}

/**
 * Get tiles that can be used as sources for another tile
 */
export async function getTilesForSourceSelection(
  mosaicId: string,
  excludeTileId?: string,
): Promise<{ id: string; name: string; tile_type: TileType }[]> {
  const supabase = await createClient();
  const user = await getUser();

  if (!user) {
    return [];
  }

  let query = supabase
    .from("tiles")
    .select("id, name, tile_type")
    .eq("mosaic_id", mosaicId)
    .order("name", { ascending: true });

  if (excludeTileId) {
    query = query.neq("id", excludeTileId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching tiles for source selection:", error);
    return [];
  }

  return (data || []) as { id: string; name: string; tile_type: TileType }[];
}
