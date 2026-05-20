import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveGoogleToken } from "@/lib/google/integration";
import {
  appendValues,
  createSpreadsheet,
  deleteRows,
  getSheetIds,
  getValues,
  type Row,
  updateValues,
} from "@/lib/google/sheets-client";
import type {
  CatalogEntry,
  CatalogEntryEvent,
  CatalogField,
  Database,
  Json,
  Tile,
} from "@/types/database";

const ENTRIES_TAB = "Entries";
const EVENTS_TAB = "Events";

// Trailing meta column on the Entries tab so users see when a row last changed.
const ENTRY_META_COLUMNS = ["updated_at"] as const;

// Event tab columns after the hidden id; entry_match_key gives humans context.
const EVENT_COLUMNS = [
  "entry_match_key",
  "event_type",
  "title",
  "description",
  "event_date",
  "source_url",
  "created_at",
] as const;

type AdminClient = SupabaseClient<Database>;

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
}

interface CatalogSnapshot {
  schemaFields: CatalogField[];
  entries: CatalogEntry[];
  events: CatalogEntryEvent[];
  entryIdToMatchKey: Map<string, string>;
}

/**
 * Loads everything we need to render the sheet, in one place.
 */
async function loadCatalogSnapshot(
  adminClient: AdminClient,
  tileId: string,
): Promise<CatalogSnapshot> {
  const [schemaRes, entriesRes, eventsRes] = await Promise.all([
    adminClient
      .from("catalog_schemas")
      .select("fields")
      .eq("tile_id", tileId)
      .maybeSingle(),
    adminClient
      .from("catalog_entries")
      .select("*")
      .eq("tile_id", tileId)
      .order("created_at", { ascending: true }),
    adminClient
      .from("catalog_entry_events")
      .select("*")
      .eq("tile_id", tileId)
      .order("created_at", { ascending: true }),
  ]);

  const schemaFields =
    ((schemaRes.data as { fields: Json } | null)?.fields as
      | CatalogField[]
      | undefined) ?? [];
  const entries = (entriesRes.data ?? []) as CatalogEntry[];
  const events = (eventsRes.data ?? []) as CatalogEntryEvent[];

  const entryIdToMatchKey = new Map<string, string>();
  for (const e of entries) entryIdToMatchKey.set(e.id, e.match_key);

  return { schemaFields, entries, events, entryIdToMatchKey };
}

function formatCellValue(value: unknown, type?: CatalogField["type"]): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (type === "date" && typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function buildEntryHeaders(schemaFields: CatalogField[]): string[] {
  return [
    "__match_key",
    ...schemaFields.map((f) => f.name),
    ...ENTRY_META_COLUMNS,
  ];
}

function buildEventHeaders(): string[] {
  return ["__event_id", ...EVENT_COLUMNS];
}

function buildEntryRow(entry: CatalogEntry, schemaFields: CatalogField[]): Row {
  const data = (entry.data ?? {}) as Record<string, unknown>;
  return [
    entry.match_key,
    ...schemaFields.map((f) => formatCellValue(data[f.name], f.type)),
    entry.updated_at,
  ];
}

function buildEventRow(event: CatalogEntryEvent, entryMatchKey: string): Row {
  return [
    event.id,
    entryMatchKey,
    event.event_type,
    event.title,
    event.description,
    event.event_date ?? "",
    event.source_url ?? "",
    event.created_at,
  ];
}

/**
 * Resolves the Google token used to push a catalog tile to its sheet.
 *
 * Prefers `tile.sheets_owner_user_id` (the user who enabled sync) so the
 * spreadsheet ends up in their own Drive. Falls back to the mosaic owner for
 * tiles enabled before that column existed.
 */
async function resolveSyncToken(
  adminClient: AdminClient,
  tile: Tile,
  preferUserId?: string,
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  if (preferUserId) {
    return resolveGoogleToken(adminClient, preferUserId);
  }

  if (tile.sheets_owner_user_id) {
    return resolveGoogleToken(adminClient, tile.sheets_owner_user_id);
  }

  const { data: mosaicData } = await adminClient
    .from("mosaics")
    .select("owner_id")
    .eq("id", tile.mosaic_id)
    .single();

  if (!mosaicData) return { ok: false, reason: "Mosaic not found" };

  return resolveGoogleToken(
    adminClient,
    (mosaicData as { owner_id: string }).owner_id,
  );
}

/**
 * Enables sheet sync for a catalog tile: creates a new spreadsheet in the
 * acting user's Drive, seeds tabs with headers, runs an initial push.
 *
 * `userId` is the user who clicked "Enable" — their Google integration is
 * used and stamped onto the tile so future pushes resolve the same account.
 */
export async function enableSheetSync(
  adminClient: AdminClient,
  tile: Tile,
  userId: string,
): Promise<{ url: string }> {
  const resolved = await resolveSyncToken(adminClient, tile, userId);
  if (!resolved.ok) throw new Error(resolved.reason);

  const snapshot = await loadCatalogSnapshot(adminClient, tile.id);

  const created = await createSpreadsheet(
    resolved.token,
    `${tile.name} — Catalog`,
    [
      {
        title: ENTRIES_TAB,
        headers: buildEntryHeaders(snapshot.schemaFields),
        hiddenLeadingColumns: 1,
      },
      {
        title: EVENTS_TAB,
        headers: buildEventHeaders(),
        hiddenLeadingColumns: 1,
      },
    ],
  );

  const { error: updateError } = await adminClient
    .from("tiles")
    .update({
      sheets_sync_enabled: true,
      sheets_spreadsheet_id: created.spreadsheetId,
      sheets_spreadsheet_url: created.spreadsheetUrl,
      sheets_owner_user_id: userId,
      sheets_last_synced_at: null,
    } as never)
    .eq("id", tile.id);
  if (updateError) {
    console.error("[sheets-output] failed to save tile columns:", updateError);
    throw new Error("Failed to save spreadsheet on tile");
  }

  // Initial population.
  const updatedTile: Tile = {
    ...tile,
    sheets_sync_enabled: true,
    sheets_spreadsheet_id: created.spreadsheetId,
    sheets_spreadsheet_url: created.spreadsheetUrl,
    sheets_owner_user_id: userId,
  };
  await pushCatalogToSheet(adminClient, updatedTile);

  return { url: created.spreadsheetUrl };
}

/**
 * Clears sheet sync columns on the tile. The Drive file itself is left alone —
 * the user can keep or delete it.
 */
export async function disableSheetSync(
  adminClient: AdminClient,
  tile: Tile,
): Promise<void> {
  const { error } = await adminClient
    .from("tiles")
    .update({
      sheets_sync_enabled: false,
      sheets_spreadsheet_id: null,
      sheets_spreadsheet_url: null,
      sheets_owner_user_id: null,
      sheets_last_synced_at: null,
    } as never)
    .eq("id", tile.id);
  if (error) {
    console.error("[sheets-output] failed to clear sheet sync columns:", error);
    throw new Error("Failed to disable sheet sync");
  }
}

interface SheetIndex {
  /** Map keyColumn[0] → 1-indexed row number in the sheet. */
  rowByKey: Map<string, number>;
  /** Full row contents, indexed by row number, for diffing. */
  rowsByNumber: Map<number, string[]>;
}

function indexSheet(values: string[][]): SheetIndex {
  const rowByKey = new Map<string, number>();
  const rowsByNumber = new Map<number, string[]>();
  // Row 1 is the header; data starts at row 2.
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const key = row?.[0]?.trim();
    if (!key) continue;
    const rowNumber = i + 1;
    rowByKey.set(key, rowNumber);
    rowsByNumber.set(rowNumber, row);
  }
  return { rowByKey, rowsByNumber };
}

function rowsEqual(a: string[] | undefined, b: Row): boolean {
  if (!a) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = (a[i] ?? "").toString();
    const bv = b[i] === null || b[i] === undefined ? "" : String(b[i]);
    if (av !== bv) return false;
  }
  return true;
}

function columnLetter(index: number): string {
  // 0 → A, 25 → Z, 26 → AA, etc.
  let n = index;
  let result = "";
  do {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return result;
}

/**
 * One-way push of catalog state into the spreadsheet.
 *
 * Fire-and-forget when called from execution code (returns silently on
 * error). The manual-button server action wraps this and surfaces failures.
 */
export async function pushCatalogToSheet(
  adminClient: AdminClient,
  tile: Tile,
): Promise<SyncResult | null> {
  if (!tile.sheets_sync_enabled || !tile.sheets_spreadsheet_id) return null;

  try {
    const resolved = await resolveSyncToken(adminClient, tile);
    if (!resolved.ok) {
      console.error("[sheets-output]", resolved.reason, "tile:", tile.id);
      return null;
    }
    const token = resolved.token;
    const spreadsheetId = tile.sheets_spreadsheet_id;

    const snapshot = await loadCatalogSnapshot(adminClient, tile.id);
    const sheetIds = await getSheetIds(token, spreadsheetId);
    const entriesSheetId = sheetIds[ENTRIES_TAB];
    const eventsSheetId = sheetIds[EVENTS_TAB];
    if (entriesSheetId === undefined || eventsSheetId === undefined) {
      console.error(
        "[sheets-output] spreadsheet is missing required tabs. tile:",
        tile.id,
      );
      return null;
    }

    const result: SyncResult = { added: 0, updated: 0, deleted: 0 };

    const entryHeaders = buildEntryHeaders(snapshot.schemaFields);
    const eventHeaders = buildEventHeaders();
    const entriesEndCol = columnLetter(entryHeaders.length - 1);
    const eventsEndCol = columnLetter(eventHeaders.length - 1);

    // --- Entries tab ---
    {
      const range = `${ENTRIES_TAB}!A1:${entriesEndCol}`;
      const currentValues = await getValues(token, spreadsheetId, range);
      const index = indexSheet(currentValues);

      const catalogKeys = new Set(snapshot.entries.map((e) => e.match_key));

      const updates: { range: string; values: Row[] }[] = [];
      const appends: Row[] = [];

      for (const entry of snapshot.entries) {
        const row = buildEntryRow(entry, snapshot.schemaFields);
        const existingRowNumber = index.rowByKey.get(entry.match_key);
        if (existingRowNumber === undefined) {
          appends.push(row);
        } else {
          const current = index.rowsByNumber.get(existingRowNumber);
          if (!rowsEqual(current, row)) {
            updates.push({
              range: `${ENTRIES_TAB}!A${existingRowNumber}:${entriesEndCol}${existingRowNumber}`,
              values: [row],
            });
          }
        }
      }

      const rowsToDelete: number[] = [];
      for (const [key, rowNumber] of index.rowByKey.entries()) {
        if (!catalogKeys.has(key)) rowsToDelete.push(rowNumber);
      }

      // Apply: updates (row numbers still valid) → appends → deletes (descending).
      for (const u of updates) {
        await updateValues(token, spreadsheetId, u.range, u.values);
      }
      if (appends.length > 0) {
        await appendValues(token, spreadsheetId, ENTRIES_TAB, appends);
      }
      if (rowsToDelete.length > 0) {
        await deleteRows(token, spreadsheetId, entriesSheetId, rowsToDelete);
      }

      result.added += appends.length;
      result.updated += updates.length;
      result.deleted += rowsToDelete.length;
    }

    // --- Events tab ---
    {
      const range = `${EVENTS_TAB}!A1:${eventsEndCol}`;
      const currentValues = await getValues(token, spreadsheetId, range);
      const index = indexSheet(currentValues);

      const catalogEventIds = new Set(snapshot.events.map((e) => e.id));

      const updates: { range: string; values: Row[] }[] = [];
      const appends: Row[] = [];

      for (const event of snapshot.events) {
        const matchKey = snapshot.entryIdToMatchKey.get(event.entry_id) ?? "";
        const row = buildEventRow(event, matchKey);
        const existingRowNumber = index.rowByKey.get(event.id);
        if (existingRowNumber === undefined) {
          appends.push(row);
        } else {
          const current = index.rowsByNumber.get(existingRowNumber);
          if (!rowsEqual(current, row)) {
            updates.push({
              range: `${EVENTS_TAB}!A${existingRowNumber}:${eventsEndCol}${existingRowNumber}`,
              values: [row],
            });
          }
        }
      }

      const rowsToDelete: number[] = [];
      for (const [key, rowNumber] of index.rowByKey.entries()) {
        if (!catalogEventIds.has(key)) rowsToDelete.push(rowNumber);
      }

      for (const u of updates) {
        await updateValues(token, spreadsheetId, u.range, u.values);
      }
      if (appends.length > 0) {
        await appendValues(token, spreadsheetId, EVENTS_TAB, appends);
      }
      if (rowsToDelete.length > 0) {
        await deleteRows(token, spreadsheetId, eventsSheetId, rowsToDelete);
      }

      result.added += appends.length;
      result.updated += updates.length;
      result.deleted += rowsToDelete.length;
    }

    await adminClient
      .from("tiles")
      .update({ sheets_last_synced_at: new Date().toISOString() } as never)
      .eq("id", tile.id);

    return result;
  } catch (err) {
    console.error("[sheets-output] push failed:", err);
    return null;
  }
}
