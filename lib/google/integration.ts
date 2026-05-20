import type { SupabaseClient } from "@supabase/supabase-js";

import { refreshAccessToken } from "@/lib/google/oauth";
import type { Database, GoogleIntegrationMetadata } from "@/types/database";

type GoogleTokenResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

// Refresh slightly before actual expiry so a long-running request doesn't 401 mid-call.
const REFRESH_BUFFER_MS = 60_000;

/**
 * Resolves a usable Google access token for a user. Refreshes via the stored
 * refresh_token if the current access token is past `expires_at`, and persists
 * the new token back to `user_integrations`.
 */
export async function resolveGoogleToken(
  adminClient: SupabaseClient<Database>,
  userId: string,
): Promise<GoogleTokenResult> {
  const { data } = await adminClient
    .from("user_integrations")
    .select("access_token, metadata")
    .eq("user_id", userId)
    .eq("provider", "google")
    .limit(1)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      reason: "Google integration not connected.",
    };
  }

  const row = data as {
    access_token: string;
    metadata: GoogleIntegrationMetadata | null;
  };
  const metadata = row.metadata;

  if (!metadata?.refresh_token) {
    return {
      ok: false,
      reason:
        "Google integration is missing a refresh token. Please reconnect.",
    };
  }

  const expiresAt = metadata.expires_at
    ? new Date(metadata.expires_at).getTime()
    : 0;

  if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
    return { ok: true, token: row.access_token };
  }

  // Refresh
  try {
    const refreshed = await refreshAccessToken(metadata.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000,
    ).toISOString();

    const updatedMetadata: GoogleIntegrationMetadata = {
      ...metadata,
      expires_at: newExpiresAt,
    };

    await adminClient
      .from("user_integrations")
      .update({
        access_token: refreshed.access_token,
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("user_id", userId)
      .eq("provider", "google");

    return { ok: true, token: refreshed.access_token };
  } catch (err) {
    console.error("[google/integration] refresh failed:", err);
    return {
      ok: false,
      reason: "Failed to refresh Google access token. Please reconnect.",
    };
  }
}
