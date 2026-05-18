import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Returns true if the user owns the mosaic OR is a member (any role).
 * Uses the admin client so it bypasses RLS — callers must already trust the user id.
 */
export async function verifyMosaicAccess(
  admin: SupabaseClient<Database>,
  mosaicId: string,
  userId: string,
): Promise<boolean> {
  const { count: ownedCount } = await admin
    .from("mosaics")
    .select("id", { count: "exact", head: true })
    .eq("id", mosaicId)
    .eq("owner_id", userId);

  if (ownedCount) return true;

  const { count: memberCount } = await admin
    .from("mosaic_members")
    .select("id", { count: "exact", head: true })
    .eq("mosaic_id", mosaicId)
    .eq("user_id", userId);

  return (memberCount ?? 0) > 0;
}
