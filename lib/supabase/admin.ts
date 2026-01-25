import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Admin client with service role for server-side operations
// WARNING: This bypasses RLS - use with caution
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Helper to check if an email is in the allowlist
export async function isEmailAllowed(email: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('allowlist')
    .select('id')
    .eq('email', email.toLowerCase())
    .single()

  if (error || !data) {
    return false
  }

  return true
}
