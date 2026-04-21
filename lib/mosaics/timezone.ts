import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Resolves the IANA timezone for a tile's mosaic.
 * Falls back to "UTC" if the mosaic has no timezone configured.
 */
export async function getMosaicTimezone(
  adminClient: SupabaseClient<Database>,
  tileId: string,
): Promise<string> {
  const { data: tileRow } = await adminClient
    .from("tiles")
    .select("mosaic_id")
    .eq("id", tileId)
    .single();

  if (!tileRow) return "UTC";

  const { data: mosaicRow } = await adminClient
    .from("mosaics")
    .select("settings")
    .eq("id", (tileRow as { mosaic_id: string }).mosaic_id)
    .single();

  const settings = (mosaicRow as { settings: Record<string, unknown> } | null)
    ?.settings;

  return typeof settings?.timezone === "string" ? settings.timezone : "UTC";
}
