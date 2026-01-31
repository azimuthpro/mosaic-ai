import { createClient as createServerClient } from "@/lib/supabase/server"

export interface EmailValidationResult {
  allowed: boolean
  email: string
  domain: string
  reason?: string
}

/**
 * Validates if an email is allowed to sign up based on allowlist
 *
 * @param email - Email address to validate
 * @returns Promise with validation result
 */
export async function validateEmailAllowlist(email: string): Promise<EmailValidationResult> {
  try {
    // Extract domain for logging/debugging
    const domain = extractDomain(email)

    // Allow bypass in development if DISABLE_EMAIL_ALLOWLIST is set
    if (process.env.DISABLE_EMAIL_ALLOWLIST === "true") {
      console.log("⚠️  Email allowlist check bypassed for:", email)
      return {
        allowed: true,
        email,
        domain,
        reason: "Development mode - allowlist disabled",
      }
    }

    // Get Supabase client with service role for database access
    const supabase = await createServerClient()

    // Call database RPC function to check allowlist
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("is_email_allowed", {
      check_email: email,
    })

    if (error) {
      console.error("Error checking email allowlist:", error)
      // Fail closed: deny signup if allowlist check fails
      return {
        allowed: false,
        email,
        domain,
        reason: "Allowlist validation failed - defaulting to deny for security",
      }
    }

    return {
      allowed: data === true,
      email,
      domain,
      reason: data ? undefined : "Email or domain not in allowlist",
    }
  } catch (error) {
    console.error("Unexpected error in validateEmailAllowlist:", error)
    // Fail closed on unexpected errors
    return {
      allowed: false,
      email,
      domain: "",
      reason: "Unexpected error during validation - defaulting to deny",
    }
  }
}

/**
 * Extracts domain from email address
 *
 * @param email - Email address
 * @returns Domain portion (e.g., "gmail.com")
 */
export function extractDomain(email: string): string {
  const parts = email.split("@")
  if (parts.length !== 2) {
    return ""
  }
  return parts[1].toLowerCase()
}

/**
 * Formats a user-friendly error message for rejected emails
 *
 * @param email - Rejected email address
 * @returns Error message with contact information
 */
export function getEmailNotAllowedMessage(email: string): string {
  return `The email address "${email}" is not yet authorized for signup. If you believe this is an error or would like to request access, please contact support@themeshline.com with your email and company information.`
}
