"use server";

import type { RouterError, RouterResult } from "@/lib/router";
import { routeQuery } from "@/lib/router";
import { indexMosaicTiles } from "@/lib/router/index-tile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";

/** Route a user query to tiles in a mosaic */
export async function routeUserQuery(
  mosaicId: string,
  query: string,
): Promise<RouterResult | RouterError> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated", code: "AUTH_ERROR" };
  }

  const supabase = await createClient();

  const { data: mosaic } = await supabase
    .from("mosaics")
    .select("id")
    .eq("id", mosaicId)
    .single();

  if (!mosaic) {
    return { error: "Mosaic not found or access denied", code: "AUTH_ERROR" };
  }

  return routeQuery(supabase, mosaicId, query);
}

/** Reindex all tiles in a mosaic */
export async function reindexMosaic(
  mosaicId: string,
): Promise<
  | { error: string }
  | { success: true; indexed: number; failed: number; errors: string[] }
> {
  const user = await getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const supabase = await createClient();

  const { data: mosaic } = await supabase
    .from("mosaics")
    .select("id, owner_id")
    .eq("id", mosaicId)
    .single();

  if (!mosaic) {
    return { error: "Mosaic not found" };
  }

  const adminClient = createAdminClient();
  const result = await indexMosaicTiles(adminClient, mosaicId);

  return { success: true, ...result };
}
