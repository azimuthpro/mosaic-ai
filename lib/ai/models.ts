/**
 * Model IDs routed through the Vercel AI Gateway.
 *
 * Plain `"provider/model"` strings are resolved by the AI SDK's global provider,
 * which is the gateway by default — no provider package or provider API key is
 * needed. Auth comes from `AI_GATEWAY_API_KEY`, falling back to
 * `VERCEL_OIDC_TOKEN` (written by `vercel env pull`, auto-refreshed on Vercel).
 *
 * The gateway serves pinned slugs only — there is no `-latest` alias — so bumping
 * models means editing these two constants.
 */

export const flashModel = "google/gemini-3.8-flash";

export const embeddingModel = "google/gemini-embedding-2";
