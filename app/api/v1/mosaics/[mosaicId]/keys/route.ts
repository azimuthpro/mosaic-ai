import { NextResponse } from "next/server";

import { generateApiKey, getKeyPrefix, hashApiKey } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUser } from "@/lib/supabase/server";
import type {
  MemberRole,
  MosaicApiKey,
  MosaicApiKeyInsert,
} from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MembershipResult = { role: MemberRole } | null;
type MosaicResult = { id: string; owner_id: string } | null;

/**
 * List all API keys for a mosaic
 * Requires session authentication (user must be owner or admin)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ mosaicId: string }> },
): Promise<Response> {
  const { mosaicId } = await params;
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Verify user has access to the mosaic
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("id, owner_id")
    .eq("id", mosaicId)
    .single();

  const mosaic = mosaicData as MosaicResult;

  if (!mosaic) {
    // Check membership
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as MembershipResult;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Mosaic not found or access denied" },
        { status: 404 },
      );
    }
  } else if (mosaic.owner_id !== user.id) {
    // Check membership for non-owners
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as MembershipResult;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Get all API keys for this mosaic using admin client (table not in generated types yet)
  const adminClient = createAdminClient();
  const { data: keys, error } = await adminClient
    .from("mosaic_api_keys")
    .select(
      "id, name, key_prefix, created_by, last_used_at, expires_at, is_active, created_at",
    )
    .eq("mosaic_id", mosaicId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    keys: keys || [],
  });
}

/**
 * Create a new API key for a mosaic
 * Requires session authentication (user must be owner or admin)
 * Returns the full API key ONLY on creation - it cannot be retrieved later
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ mosaicId: string }> },
): Promise<Response> {
  const { mosaicId } = await params;
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Verify user has access to the mosaic
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("id, owner_id")
    .eq("id", mosaicId)
    .single();

  const mosaic = mosaicData as MosaicResult;

  if (!mosaic) {
    // Check membership
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as MembershipResult;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Mosaic not found or access denied" },
        { status: 404 },
      );
    }
  } else if (mosaic.owner_id !== user.id) {
    // Check membership for non-owners
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as MembershipResult;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Parse request body
  let body: { name?: string; expires_in_days?: number } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const name = body.name || "API Key";
  const expiresInDays = body.expires_in_days;

  // Generate the API key
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const keyPrefix = getKeyPrefix(apiKey);

  // Calculate expiration if specified
  let expiresAt: string | null = null;
  if (expiresInDays && expiresInDays > 0) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + expiresInDays);
    expiresAt = expDate.toISOString();
  }

  // Insert the API key using admin client
  const adminClient = createAdminClient();
  const keyInsert: MosaicApiKeyInsert = {
    mosaic_id: mosaicId,
    name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    created_by: user.id,
    expires_at: expiresAt,
    is_active: true,
  };

  const { data: keyData, error } = await adminClient
    .from("mosaic_api_keys")
    .insert(keyInsert as never)
    .select("id, name, key_prefix, expires_at, is_active, created_at")
    .single();

  if (error || !keyData) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 },
    );
  }

  const createdKey = keyData as MosaicApiKey;

  // Return the full key only on creation
  return NextResponse.json({
    id: createdKey.id,
    name: createdKey.name,
    key: apiKey, // Full key - only returned on creation!
    key_prefix: createdKey.key_prefix,
    expires_at: createdKey.expires_at,
    is_active: createdKey.is_active,
    created_at: createdKey.created_at,
    message: "Store this API key securely. It will not be shown again.",
  });
}

/**
 * Revoke (deactivate) an API key
 * Requires session authentication (user must be owner or admin)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ mosaicId: string }> },
): Promise<Response> {
  const { mosaicId } = await params;
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get key ID from query params
  const url = new URL(request.url);
  const keyId = url.searchParams.get("key_id");

  if (!keyId) {
    return NextResponse.json(
      { error: "key_id query parameter is required" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Verify user has access to the mosaic
  const { data: mosaicData } = await supabase
    .from("mosaics")
    .select("id, owner_id")
    .eq("id", mosaicId)
    .single();

  const mosaic = mosaicData as MosaicResult;

  if (!mosaic) {
    // Check membership
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as MembershipResult;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Mosaic not found or access denied" },
        { status: 404 },
      );
    }
  } else if (mosaic.owner_id !== user.id) {
    // Check membership for non-owners
    const { data: membershipData } = await supabase
      .from("mosaic_members")
      .select("role")
      .eq("mosaic_id", mosaicId)
      .eq("user_id", user.id)
      .single();

    const membership = membershipData as MembershipResult;
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Deactivate the key (soft delete) using admin client
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("mosaic_api_keys")
    .update({ is_active: false } as never)
    .eq("id", keyId)
    .eq("mosaic_id", mosaicId); // Ensure key belongs to this mosaic

  if (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "API key has been revoked",
  });
}
