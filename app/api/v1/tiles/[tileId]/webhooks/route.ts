import { NextRequest, NextResponse } from "next/server";

import { createTileWebhook, getTileWebhooks } from "@/lib/actions/webhooks";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET /api/v1/tiles/[tileId]/webhooks - List webhooks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string }> },
) {
  const { tileId } = await params;
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

  const webhooks = await getTileWebhooks(tileId);
  return NextResponse.json({ webhooks });
}

// POST /api/v1/tiles/[tileId]/webhooks - Create webhook
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string }> },
) {
  const { tileId } = await params;
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
      { error: "Only owners and admins can create webhooks" },
      { status: 403 },
    );
  }

  // Parse request body
  const body = await request.json();
  const { name, url, events, auth_type, auth_config } = body;

  if (!name || !url) {
    return NextResponse.json(
      { error: "Name and URL are required" },
      { status: 400 },
    );
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const result = await createTileWebhook({
    tileId,
    name,
    url,
    events,
    authType: auth_type,
    authConfig: auth_config,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ webhook: result.webhook }, { status: 201 });
}
