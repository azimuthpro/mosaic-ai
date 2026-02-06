"use server";

import { revalidatePath } from "next/cache";

import { createClient, getUser } from "@/lib/supabase/server";
import type {
  AgentReportSourceConfig,
  Json,
  LanguageCode,
  OutputFormat,
  SourceType,
  Tile,
  TileConnection,
  TileInsert,
  TilePattern,
  TileSource,
  TileSourceInsert,
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
    sources: t.tile_sources || [],
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
    sources: tile.tile_sources || [],
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
  sources?: {
    url?: string;
    name?: string;
    type?: SourceType;
    config?: WebSearchConfig;
  }[];
  connections?: string[]; // IDs of source tiles to connect
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

  // Validate based on source type
  if (sourceType === "url" && !params.url) {
    return { error: "URL is required for URL source type" };
  }

  if (sourceType === "web_search" && !params.config?.query) {
    return { error: "Search query is required for web_search source type" };
  }

  const configByType: Partial<Record<SourceType, unknown>> = {
    url: params.urlConfig,
    web_search: params.config,
  };
  const config = (configByType[sourceType] as Json) ?? {};

  const sourceInsert: TileSourceInsert = {
    tile_id: params.tileId,
    type: sourceType,
    url: sourceType === "url" ? params.url : null,
    name: params.name ?? null,
    config,
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
