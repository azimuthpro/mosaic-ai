/**
 * Supabase API keys. Prefers the new `sb_publishable_` / `sb_secret_` keys and
 * falls back to the legacy JWT `anon` / `service_role` keys, which Supabase
 * lets projects disable.
 *
 * Env vars are read with literal `process.env.NEXT_PUBLIC_*` access so Next.js
 * can inline the publishable key into the browser bundle.
 */

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Server-only. Bypasses RLS. */
export function getSupabaseSecretKey(): string | undefined {
  return (
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
