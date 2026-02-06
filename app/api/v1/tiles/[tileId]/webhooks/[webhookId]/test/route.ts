import { NextRequest, NextResponse } from "next/server";

import { deliverWebhook, getTileWebhook } from "@/lib/actions/webhooks";
import { createClient } from "@/lib/supabase/server";
import type { TileWebhook, WebhookPayload } from "@/types/database";

export const runtime = "nodejs";

// POST /api/v1/tiles/[tileId]/webhooks/[webhookId]/test - Send test webhook
export async function POST(
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
    .select("id, name, mosaic_id")
    .eq("id", tileId)
    .single();

  const tile = tileData as {
    id: string;
    name: string;
    mosaic_id: string;
  } | null;

  if (!tile) {
    return NextResponse.json({ error: "Tile not found" }, { status: 404 });
  }

  // Check webhook belongs to tile
  const webhook = await getTileWebhook(webhookId);
  if (!webhook || webhook.tile_id !== tileId) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }

  // Check mosaic access (owner or admin only)
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

  const isOwner = mosaic?.owner_id === user.id;
  const isAdmin = member?.role === "admin" || member?.role === "owner";

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "Only owners and admins can test webhooks" },
      { status: 403 },
    );
  }

  // Create test payload
  const testPayload: WebhookPayload = {
    event: "job.completed",
    timestamp: new Date().toISOString(),
    tile: {
      id: tileId,
      name: tile.name,
    },
    job: {
      id: "test-job-id",
      started_at: new Date(Date.now() - 5000).toISOString(),
      completed_at: new Date().toISOString(),
    },
    result: {
      content: { text: "This is a test webhook delivery from Mosaic AI." },
      format: "text",
      source_urls: ["https://example.com/test"],
    },
  };

  // Deliver webhook
  const result = await deliverWebhook(webhook as TileWebhook, testPayload);

  return NextResponse.json({
    success: result.success,
    error: result.error,
  });
}
