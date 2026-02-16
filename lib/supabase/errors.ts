/**
 * Shared utilities for extracting and formatting Supabase/Postgrest errors.
 */

interface SupabaseErrorLike {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/**
 * Extracts the standard error properties from a Supabase/Postgrest error
 * into a plain object suitable for console logging.
 */
export function formatSupabaseError(
  error: SupabaseErrorLike | null | undefined,
): Record<string, string | undefined> {
  return {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  };
}

/**
 * Extracts Supabase error properties into a flat metadata shape
 * suitable for inclusion in execution log metadata objects.
 */
export function supabaseErrorMetadata(
  error: SupabaseErrorLike | null | undefined,
): Record<string, string | undefined> {
  return {
    errorCode: error?.code,
    errorDetails: error?.details,
    errorHint: error?.hint,
  };
}

/**
 * Extracts a human-readable message from an unknown error value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
