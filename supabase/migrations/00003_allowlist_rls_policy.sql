-- Add explicit RLS policy for allowlist table
-- The allowlist is managed via service role only (server-side admin functions)
-- This policy explicitly denies all access to regular users while satisfying the linter

-- Deny all access to regular authenticated users
-- Service role bypasses RLS, so admin operations continue to work
create policy "Allowlist is service role only"
  on public.allowlist for all
  using (false);
