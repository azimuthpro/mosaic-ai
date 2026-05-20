"use server";

import { revalidatePath } from "next/cache";

import {
  disableSheetSync,
  enableSheetSync,
  pushCatalogToSheet,
  type SyncResult,
} from "@/lib/outputs/sheets-output";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import type {
  CatalogDiff,
  CatalogEntry,
  CatalogEntryEvent,
  CatalogField,
  CatalogSchema,
  Tile,
} from "@/types/database";

export interface CatalogStats {
  totalEntries: number;
  totalEvents: number;
  lastUpdated: string | null;
  entityType: string | null;
}

export interface CatalogEntryWithEventCount extends CatalogEntry {
  event_count: number;
}

export async function getCatalogSchema(
  tileId: string,
): Promise<CatalogSchema | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_schemas")
    .select("*")
    .eq("tile_id", tileId)
    .maybeSingle();

  return data as CatalogSchema | null;
}

export async function getCatalogEntries(
  tileId: string,
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortField?: string;
    sortDir?: "asc" | "desc";
  } = {},
): Promise<{ entries: CatalogEntryWithEventCount[]; total: number }> {
  const {
    page = 1,
    pageSize = 20,
    search,
    sortField,
    sortDir = "desc",
  } = options;
  const supabase = await createClient();

  let query = supabase
    .from("catalog_entries")
    .select("*", { count: "exact" })
    .eq("tile_id", tileId);

  if (search) {
    query = query.ilike("match_key", `%${search}%`);
  }

  if (sortField) {
    query = query.order(`data->>${sortField}` as never, {
      ascending: sortDir === "asc",
    });
  } else {
    query = query.order("updated_at", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count } = await query;
  const entries = (data || []) as CatalogEntry[];

  if (entries.length === 0) {
    return { entries: [], total: count || 0 };
  }

  // Get event counts for these entries
  const { data: eventRows } = await supabase
    .from("catalog_entry_events")
    .select("entry_id")
    .in(
      "entry_id",
      entries.map((e) => e.id),
    );

  const countMap = new Map<string, number>();
  for (const row of (eventRows || []) as { entry_id: string }[]) {
    countMap.set(row.entry_id, (countMap.get(row.entry_id) || 0) + 1);
  }

  const entriesWithCounts = entries.map((entry) => ({
    ...entry,
    event_count: countMap.get(entry.id) || 0,
  }));

  return { entries: entriesWithCounts, total: count || 0 };
}

export async function getCatalogEntry(
  entryId: string,
): Promise<{ entry: CatalogEntry; events: CatalogEntryEvent[] } | null> {
  const supabase = await createClient();

  const { data: entry } = await supabase
    .from("catalog_entries")
    .select("*")
    .eq("id", entryId)
    .maybeSingle();

  if (!entry) return null;

  const { data: events } = await supabase
    .from("catalog_entry_events")
    .select("*")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: false });

  return {
    entry: entry as CatalogEntry,
    events: (events || []) as CatalogEntryEvent[],
  };
}

export async function getCatalogEntryEvents(
  entryId: string,
  options: { page?: number; pageSize?: number } = {},
): Promise<{ events: CatalogEntryEvent[]; total: number }> {
  const { page = 1, pageSize = 20 } = options;
  const supabase = await createClient();

  const from = (page - 1) * pageSize;
  const { data, count } = await supabase
    .from("catalog_entry_events")
    .select("*", { count: "exact" })
    .eq("entry_id", entryId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  return {
    events: (data || []) as CatalogEntryEvent[],
    total: count || 0,
  };
}

export async function deleteCatalogEntry(
  entryId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("catalog_entries")
    .delete()
    .eq("id", entryId);

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function getCatalogDiffs(
  tileId: string,
  limit: number = 10,
): Promise<CatalogDiff[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("catalog_diffs")
    .select("*")
    .eq("tile_id", tileId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []) as CatalogDiff[];
}

export async function getCatalogStats(tileId: string): Promise<CatalogStats> {
  const supabase = await createClient();

  const [schemaRes, entriesRes, eventsRes] = await Promise.all([
    supabase
      .from("catalog_schemas")
      .select("entity_type")
      .eq("tile_id", tileId)
      .maybeSingle(),
    supabase
      .from("catalog_entries")
      .select("id, updated_at", { count: "exact" })
      .eq("tile_id", tileId)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("catalog_entry_events")
      .select("id", { count: "exact", head: true })
      .eq("tile_id", tileId),
  ]);

  const schema = schemaRes.data as { entity_type: string } | null;
  const latestEntry = (entriesRes.data as { updated_at: string }[] | null)?.[0];

  return {
    totalEntries: entriesRes.count || 0,
    totalEvents: eventsRes.count || 0,
    lastUpdated: latestEntry?.updated_at || null,
    entityType: schema?.entity_type || null,
  };
}

export async function getCatalogSchemaFields(
  tileId: string,
): Promise<CatalogField[]> {
  const schema = await getCatalogSchema(tileId);
  if (!schema) return [];
  return schema.fields as unknown as CatalogField[];
}

/**
 * Loads the tile and verifies the calling user owns the mosaic (or is admin).
 * Returns the tile on success, an error string otherwise.
 */
async function authorizeCatalogTile(
  tileId: string,
): Promise<{ tile: Tile } | { error: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const supabase = await createClient();
  const { data: tileData } = await supabase
    .from("tiles")
    .select("*")
    .eq("id", tileId)
    .maybeSingle();
  const tile = tileData as Tile | null;
  if (!tile) return { error: "Tile not found" };
  if (tile.tile_type !== "catalog") return { error: "Not a catalog tile" };

  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("owner_id")
    .eq("id", tile.mosaic_id)
    .single();
  const mosaic = mosaicData as { owner_id: string } | null;
  if (!mosaic) return { error: "Mosaic not found" };

  if (mosaic.owner_id !== user.id) {
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", tile.mosaic_id)
      .eq("user_id", user.id)
      .single();
    const membership = membershipData as { role: string } | null;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return { error: "Not authorized" };
    }
  }

  return { tile };
}

export async function enableCatalogSheetSync(
  tileId: string,
): Promise<{ url: string } | { error: string }> {
  const user = await getUser();
  if (!user) return { error: "Not authenticated" };

  const authz = await authorizeCatalogTile(tileId);
  if ("error" in authz) return { error: authz.error };

  const adminClient = createAdminClient();

  // Probe the integration directly via the service-role client so we surface
  // a precise error if the OAuth row genuinely isn't there for this user.
  const { data: integration } = await adminClient
    .from("user_integrations")
    .select("id, metadata")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .limit(1)
    .maybeSingle();

  if (!integration) {
    console.error(
      `[enableCatalogSheetSync] No google integration row for user_id=${user.id}. ` +
        `Re-run the OAuth flow at /api/auth/google/connect.`,
    );
    return {
      error:
        "Google isn't connected for this account. Click 'Connect Google Sheets' to retry the OAuth flow.",
    };
  }

  try {
    const { url } = await enableSheetSync(adminClient, authz.tile, user.id);
    revalidatePath(`/mosaics/${authz.tile.mosaic_id}`);
    return { url };
  } catch (err) {
    console.error("[enableCatalogSheetSync] failed:", err);
    return {
      error: err instanceof Error ? err.message : "Failed to enable sheet sync",
    };
  }
}

export async function disableCatalogSheetSync(
  tileId: string,
): Promise<{ ok: true } | { error: string }> {
  const authz = await authorizeCatalogTile(tileId);
  if ("error" in authz) return { error: authz.error };

  try {
    const adminClient = createAdminClient();
    await disableSheetSync(adminClient, authz.tile);
    revalidatePath(`/mosaics/${authz.tile.mosaic_id}`);
    return { ok: true };
  } catch (err) {
    console.error("[disableCatalogSheetSync] failed:", err);
    return {
      error:
        err instanceof Error ? err.message : "Failed to disable sheet sync",
    };
  }
}

export async function syncCatalogSheet(
  tileId: string,
): Promise<({ ok: true } & SyncResult) | { error: string }> {
  const authz = await authorizeCatalogTile(tileId);
  if ("error" in authz) return { error: authz.error };

  if (!authz.tile.sheets_sync_enabled || !authz.tile.sheets_spreadsheet_id) {
    return { error: "Sheet sync is not enabled for this tile" };
  }

  const adminClient = createAdminClient();
  const result = await pushCatalogToSheet(adminClient, authz.tile);
  if (!result) {
    return {
      error:
        "Sync failed — check that Google is connected and the spreadsheet is accessible.",
    };
  }

  revalidatePath(`/mosaics/${authz.tile.mosaic_id}`);
  return { ok: true, ...result };
}
