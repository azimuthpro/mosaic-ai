/**
 * Admin Authentication Utilities
 *
 * Provides functions to check if a user is a super admin.
 * Uses the is_super_admin flag from the profiles table.
 */

import { createClient as createServerClient } from "@/lib/supabase/server"

// Profile type for admin authentication
interface Profile {
  user_id: string
  is_super_admin: boolean
  [key: string]: unknown
}

/**
 * Check if the current authenticated user is a super admin
 * @returns true if user is super admin, false otherwise
 */
export async function isSuperAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return false
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("is_super_admin")
      .eq("user_id", user.id)
      .single()

    return profile?.is_super_admin === true
  } catch {
    return false
  }
}

/**
 * Get the current user if they are a super admin
 * @returns User profile if super admin, null otherwise
 * @throws Error if user is not authenticated or not a super admin
 */
export async function getSuperAdminUser(): Promise<Profile> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error("Not authenticated")
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error } = await (supabase as any)
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single() as { data: Profile | null; error: Error | null }

  if (error || !profile) {
    throw new Error("Profile not found")
  }

  if (!profile.is_super_admin) {
    throw new Error("Not authorized: Super admin access required")
  }

  return profile
}

/**
 * Require super admin access or redirect
 * Use this in page components to protect admin routes
 * @returns Profile if super admin, redirects to home otherwise
 */
export async function requireSuperAdmin(): Promise<Profile> {
  try {
    return await getSuperAdminUser()
  } catch {
    throw new Error("Unauthorized")
  }
}
