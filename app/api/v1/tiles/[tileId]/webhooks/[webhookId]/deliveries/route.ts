import { NextRequest, NextResponse } from "next/server";

import { getTileWebhook, getWebhookDeliveries } from "@/lib/actions/webhooks";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/v1/tiles/[tileId]/webhooks/[webhookId]/deliveries - Get delivery history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string; webhookId: string }> },
) {
  const { tileId, webhookId } = await params;
  const supabase = await createClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check tile access
  const { data: tileData } = await supabase
    .from("tiles")
    .select("id, mosaic_id")
    .eq("id", tileId)
    .single();

  const tile = tileData as { id: string; mosaic_id: string } | null;

  if (!tile) {
    return NextResponse.json({ error: "Tile not found" }, { status: 404 });
  }

  // Check webhook belongs to tile
  const webhook = await getTileWebhook(webhookId);
  if (!webhook || webhook.tile_id !== tileId) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  // Check mosaic access
  const { data: memberData } = await supabase
    .from("mosaic_members")
    .select("role")
    .eq("mosaic_id", tile.mosaic_id)
    .eq("user_id", user.id)
    .single();

  const member = memberData as { role: string } | null;

  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("owner_id")
    .eq("id", tile.mosaic_id)
    .single();

  const mosaic = mosaicData as { owner_id: string } | null;

  if (!member && mosaic?.owner_id !== user.id) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Get limit from query params
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "20", 10);

  const deliveries = await getWebhookDeliveries(webhookId, limit);
  return NextResponse.json({ deliveries });
}
