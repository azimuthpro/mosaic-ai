import { NextRequest, NextResponse } from "next/server";

import {
  deleteTileWebhook,
  getTileWebhook,
  updateTileWebhook,
} from "@/lib/actions/webhooks";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Helper to check access
async function checkAccess(
  tileId: string,
  webhookId: string,
): Promise<{
  authorized: boolean;
  isAdminOrOwner: boolean;
  error?: string;
  status?: number;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authorized: false,
      isAdminOrOwner: false,
      error: "Unauthorized",
      status: 401,
    };
  }

  // Check tile access
  const { data: tileData } = await supabase
    .from("tiles")
    .select("id, mosaic_id")
    .eq("id", tileId)
    .single();

  const tile = tileData as { id: string; mosaic_id: string } | null;

  if (!tile) {
    return {
      authorized: false,
      isAdminOrOwner: false,
      error: "Tile not found",
      status: 404,
    };
  }

  // Check webhook belongs to tile
  const webhook = await getTileWebhook(webhookId);
  if (!webhook || webhook.tile_id !== tileId) {
    return {
      authorized: false,
      isAdminOrOwner: false,
      error: "Webhook not found",
      status: 404,
    };
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

  const isOwner = mosaic?.owner_id === user.id;
  const isAdmin = member?.role === "admin" || member?.role === "owner";
  const isMember = !!member;

  if (!isOwner && !isMember) {
    return {
      authorized: false,
      isAdminOrOwner: false,
      error: "Access denied",
      status: 403,
    };
  }

  return { authorized: true, isAdminOrOwner: isOwner || isAdmin };
}

// GET /api/v1/tiles/[tileId]/webhooks/[webhookId] - Get webhook details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string; webhookId: string }> },
) {
  const { tileId, webhookId } = await params;

  const access = await checkAccess(tileId, webhookId);
  if (!access.authorized) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const webhook = await getTileWebhook(webhookId);
  return NextResponse.json({ webhook });
}

// PATCH /api/v1/tiles/[tileId]/webhooks/[webhookId] - Update webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string; webhookId: string }> },
) {
  const { tileId, webhookId } = await params;

  const access = await checkAccess(tileId, webhookId);
  if (!access.authorized) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  if (!access.isAdminOrOwner) {
    return NextResponse.json(
      { error: "Only owners and admins can update webhooks" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { name, url, events, auth_type, auth_config, is_active } = body;

  // Validate URL if provided
  if (url) {
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  const result = await updateTileWebhook(webhookId, {
    name,
    url,
    events,
    authType: auth_type,
    authConfig: auth_config,
    isActive: is_active,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ webhook: result.webhook });
}

// DELETE /api/v1/tiles/[tileId]/webhooks/[webhookId] - Delete webhook
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tileId: string; webhookId: string }> },
) {
  const { tileId, webhookId } = await params;

  const access = await checkAccess(tileId, webhookId);
  if (!access.authorized) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  if (!access.isAdminOrOwner) {
    return NextResponse.json(
      { error: "Only owners and admins can delete webhooks" },
      { status: 403 },
    );
  }

  const result = await deleteTileWebhook(webhookId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
