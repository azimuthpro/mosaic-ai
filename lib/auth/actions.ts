"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { sendMagicLinkEmail } from "@/lib/email/sendgrid"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

type AuthResult = { success: true } | { success: false; error: string }

async function getBaseUrl(): Promise<string> {
  const headerList = await headers()
  const origin = headerList.get("origin")
  return process.env.NEXT_PUBLIC_SITE_URL || origin || "http://localhost:3000"
}

function tryCreateAdminClient(): ReturnType<typeof createAdminClient> | null {
  try {
    return createAdminClient()
  } catch (error) {
    console.error("Supabase admin client init error:", error)
    return null
  }
}

function buildMagicLinkUrl(
  baseUrl: string,
  tokenHash: string,
  email: string,
  next?: string
): string {
  const url = new URL("/auth/callback", baseUrl)
  url.searchParams.set("token_hash", tokenHash)
  url.searchParams.set("type", "magiclink")
  url.searchParams.set("email", email)
  if (next) {
    url.searchParams.set("next", next)
  }
  return url.toString()
}

/**
 * Server action: Sign in with magic link
 *
 * Generates a magic link via Supabase Admin API and sends via SendGrid.
 * The magic link redirects to /auth/callback for session creation.
 * If `next` is provided, it will be passed to the callback to redirect after auth.
 */
export async function signInWithMagicLink(email: string, next?: string): Promise<AuthResult> {
  const adminClient = tryCreateAdminClient()
  if (!adminClient) {
    return {
      success: false,
      error: "Auth is temporarily unavailable. Please try again shortly.",
    }
  }

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  })

  if (error) {
    console.error("Generate link error:", error)
    return {
      success: false,
      error: "Could not generate magic link. Please try again.",
    }
  }

  const baseUrl = await getBaseUrl()
  const magicLinkUrl = buildMagicLinkUrl(baseUrl, data.properties.hashed_token, email, next)

  const emailResult = await sendMagicLinkEmail({
    recipientEmail: email,
    magicLinkUrl,
    type: "signin",
  })

  if (!emailResult.success) {
    console.error("SendGrid error:", emailResult.error)
    return {
      success: false,
      error: "Could not send email. Please try again.",
    }
  }

  return { success: true }
}

interface SignUpPayload {
  email: string
  fullName: string
  shardId?: number
  next?: string
}

/**
 * Server action: Sign up with magic link
 *
 * Generates a magic link via Supabase Admin API and sends via SendGrid.
 * User metadata includes accepted terms flag and profile details for onboarding.
 * If `next` is provided, it will be passed to the callback to redirect after auth.
 */
export async function signUpWithMagicLink({
  email,
  fullName,
  shardId,
  next,
}: SignUpPayload): Promise<AuthResult> {
  if (!email || !fullName?.trim()) {
    return {
      success: false,
      error: "Please complete all required fields.",
    }
  }

  const adminClient = tryCreateAdminClient()
  if (!adminClient) {
    return {
      success: false,
      error: "Auth is temporarily unavailable. Please try again shortly.",
    }
  }

  const nameTrimmed = fullName.trim()
  const nameParts = nameTrimmed.split(/\s+/)
  const first = nameParts[0] || ""
  const last = nameParts.slice(1).join(" ") || ""

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: {
        accepted_terms: true,
        first_name: first,
        last_name: last,
        full_name: nameTrimmed,
        shard_id: shardId,
      },
    },
  })

  if (error) {
    console.error("Generate link error:", error)
    return {
      success: false,
      error: "Could not generate magic link. Please try again.",
    }
  }

  const baseUrl = await getBaseUrl()
  const magicLinkUrl = buildMagicLinkUrl(baseUrl, data.properties.hashed_token, email, next)

  const emailResult = await sendMagicLinkEmail({
    recipientEmail: email,
    recipientName: nameTrimmed,
    magicLinkUrl,
    type: "signup",
  })

  if (!emailResult.success) {
    console.error("SendGrid error:", emailResult.error)
    return {
      success: false,
      error: "Could not send email. Please try again.",
    }
  }

  return { success: true }
}

/**
 * Server action: Sign out
 *
 * Clears the user's session and redirects to the sign-in page.
 */
export async function signOut() {
  const supabase = await createServerClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error("Sign-out error:", error)
    return { success: false, error: "Could not sign out. Please try again." }
  }

  redirect("/signin")
}

/**
 * Server action: Check if user exists
 *
 * Verifies if an email is registered in the system.
 * Used by signin form to provide better UX.
 */
export async function checkUserExists(email: string): Promise<{
  exists: boolean
  error?: string
}> {
  const supabase = await createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("user_exists", {
    check_email: email,
  })

  if (error) {
    console.error("Error checking user existence:", error)
    return {
      exists: false,
      error: "Unable to verify email. Please try again.",
    }
  }

  return { exists: data === true }
}
