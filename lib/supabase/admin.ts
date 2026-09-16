import { createClient } from "@supabase/supabase-js";

import { getSupabaseSecretKey } from "@/lib/supabase/keys";
import type { Database } from "@/types/database";

const SUPABASE_FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetch wrapper that adds a 15-second timeout via AbortController.
 * Prevents any single Supabase call from hanging indefinitely.
 */
function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);

  // Merge with any existing signal from the caller
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener(
        "abort",
        () => controller.abort(callerSignal.reason),
        { once: true },
      );
    }
  }

  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

// Admin client with service role for server-side operations
// WARNING: This bypasses RLS - use with caution
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabaseSecretKey()!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: fetchWithTimeout,
      },
    },
  );
}

// Helper to check if an email is in the allowlist
export async function isEmailAllowed(email: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("allowlist")
    .select("id")
    .eq("email", email.toLowerCase())
    .eq("is_active", true)
    .single();

  return !error && !!data;
}

// Add an email to the allowlist (default to inactive)
export async function addToAllowlist(email: string): Promise<{ error: any }> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("allowlist").insert({
    email: email.toLowerCase(),
    is_active: false,
  } as any);

  return { error };
}
