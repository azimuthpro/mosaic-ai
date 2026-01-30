import crypto from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type { MosaicApiKey } from "@/types/database";

const API_KEY_PREFIX = "msk_";
const API_KEY_LENGTH = 32;

/**
 * Generate a new API key with the format: msk_<32 random chars>
 */
export function generateApiKey(): string {
  const randomPart = crypto.randomBytes(API_KEY_LENGTH).toString("base64url");
  return `${API_KEY_PREFIX}${randomPart.slice(0, API_KEY_LENGTH)}`;
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Extract the prefix from an API key for identification
 */
export function getKeyPrefix(key: string): string {
  return key.slice(0, 12); // msk_ + 8 chars
}

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return (
    key.startsWith(API_KEY_PREFIX) &&
    key.length === API_KEY_PREFIX.length + API_KEY_LENGTH
  );
}

export interface ApiKeyValidationResult {
  valid: boolean;
  error?: string;
  apiKey?: MosaicApiKey;
  mosaicId?: string;
}

/**
 * Validate an API key and return the associated mosaic info
 */
export async function validateApiKey(
  key: string,
): Promise<ApiKeyValidationResult> {
  if (!key) {
    return { valid: false, error: "API key is required" };
  }

  if (!isValidApiKeyFormat(key)) {
    return { valid: false, error: "Invalid API key format" };
  }

  const keyHash = hashApiKey(key);
  const adminClient = createAdminClient();

  const { data: apiKey, error } = await adminClient
    .from("mosaic_api_keys")
    .select("*")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (error || !apiKey) {
    return { valid: false, error: "Invalid or inactive API key" };
  }

  const typedApiKey = apiKey as MosaicApiKey;

  // Check expiration
  if (typedApiKey.expires_at && new Date(typedApiKey.expires_at) < new Date()) {
    return { valid: false, error: "API key has expired" };
  }

  // Update last_used_at
  await adminClient
    .from("mosaic_api_keys")
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", typedApiKey.id);

  return {
    valid: true,
    apiKey: typedApiKey,
    mosaicId: typedApiKey.mosaic_id,
  };
}

/**
 * Extract API key from Authorization header
 */
export function extractApiKeyFromHeader(
  authHeader: string | null,
): string | null {
  if (!authHeader) {
    return null;
  }

  // Support "Bearer <key>" format
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Support raw key format
  if (authHeader.startsWith(API_KEY_PREFIX)) {
    return authHeader;
  }

  return null;
}

/**
 * Middleware helper to authenticate API requests
 */
export async function authenticateApiRequest(
  request: Request,
): Promise<ApiKeyValidationResult> {
  const authHeader = request.headers.get("Authorization");
  const apiKey = extractApiKeyFromHeader(authHeader);

  if (!apiKey) {
    return { valid: false, error: "Missing Authorization header" };
  }

  return validateApiKey(apiKey);
}

type TileWithMosaic = { id: string; mosaic_id: string };

/**
 * Check if a tile belongs to a mosaic
 */
export async function verifyTileAccess(
  tileId: string,
  mosaicId: string,
): Promise<{ valid: boolean; error?: string }> {
  const adminClient = createAdminClient();

  const { data: tileData, error } = await adminClient
    .from("tiles")
    .select("id, mosaic_id")
    .eq("id", tileId)
    .single();

  if (error || !tileData) {
    return { valid: false, error: "Tile not found" };
  }

  const tile = tileData as TileWithMosaic;

  if (tile.mosaic_id !== mosaicId) {
    return { valid: false, error: "Tile does not belong to this mosaic" };
  }

  return { valid: true };
}
