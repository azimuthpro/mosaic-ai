import { createClient as createServerClient } from "@/lib/supabase/server"
import type { User } from "@supabase/supabase-js"

const MOCK_DEVELOPER_USER: User = {
  id: "dev-user-id",
  email: "dev@meshline.io",
  app_metadata: {},
  user_metadata: {
    full_name: "Piotr",
    avatar_url:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
  },
  aud: "authenticated",
  created_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  last_sign_in_at: new Date().toISOString(),
  role: "authenticated",
  updated_at: new Date().toISOString(),
}

/**
 * Get the current user session (server-side)
 *
 * Returns the authenticated user or null if no valid session exists.
 * Use this in Server Components and Server Actions to validate auth state.
 */
export async function getUserSession(): Promise<User | null> {
  const supabase = await createServerClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    // In development mode, return a mock user if no real session exists
    if (process.env.NODE_ENV === "development") {
      console.log("🛠️ Dev Mode: Using mock developer session")
      return MOCK_DEVELOPER_USER
    }
    return null
  }

  return user
}

/**
 * Get auth error message
 *
 * Maps Supabase error codes to user-friendly messages.
 * Returns a generic message for unknown errors.
 */
export function getAuthErrorMessage(error?: string): string {
  if (!error) return ""

  // Map known error codes to friendly messages
  const errorMessages: Record<string, string> = {
    invalid_code: "Invalid or expired link. Please request a new one.",
    server_error: "An error occurred. Please try again later.",
    auth_failed: "Authentication failed. Please try again.",
    session_expired: "Your session has expired. Please sign in again.",
    email_not_allowed:
      "Your email is not authorized for signup. Contact support@themeshline.com to request access.",
    user_not_found: "No account found with this email. Please sign up to create an account.",
  }

  return errorMessages[error] || "An unexpected error occurred."
}
