// Per-caller request throttle for user-invocable Edge Functions.
//
// Backed by the same rate_limit_hits table the database-side primitive
// (public.check_rate_limit(), migration 0048_rate_limiting.sql) uses, via a second SQL
// entry point — check_rate_limit_service(p_profile_id, ...) — granted to service_role
// only. Two reasons this can't just be an in-process counter or reuse
// check_rate_limit() directly:
//
//   1. Edge Functions are stateless, potentially-concurrent Deno isolates. An
//      in-memory counter would undercount across isolates and reset on every cold
//      start — it would look like it worked in manual testing and do nothing under
//      real concurrent load. The database is the only shared state available here
//      without standing up new infrastructure (e.g. Redis).
//   2. check_rate_limit() reads auth.uid() itself, which is only populated inside a
//      PostgREST/RPC request carrying the caller's own JWT. A service-role client (what
//      every Edge Function here uses for the actual privileged work) has no such uid —
//      calling check_rate_limit() from one would silently no-op every time (it treats a
//      null auth.uid() as a privileged-caller bypass, same as every other internal
//      SECURITY DEFINER helper in this schema). check_rate_limit_service() takes the
//      profile id explicitly instead, and is locked to service_role specifically so
//      that id can never come from anywhere but trusted server code.
//
// Identity MUST be resolved server-side before calling this — from
// `userClient.auth.getUser()` (verifies the caller's JWT against Supabase Auth), or, for
// link-steam-callback which carries no JWT at all, from the profile id
// consume_steam_link_state() resolves out of its one-time state token. Never pass a
// client-supplied header or request-body field as `profileId`: this helper trusts its
// caller completely and has no way to tell a forged id from a real one.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export class RateLimitedError extends Error {
  constructor(public readonly bucket: string) {
    super(`Rate limit exceeded for ${bucket}`);
    this.name = "RateLimitedError";
  }
}

/**
 * Throws RateLimitedError once `profileId` has made `limit` calls to `bucket` within
 * the last `windowSeconds`. `serviceClient` must be a client built with the service
 * role key — check_rate_limit_service is not reachable with anon/authenticated grants.
 */
export async function checkRateLimit(
  serviceClient: SupabaseClient,
  profileId: string,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const { error } = await serviceClient.rpc("check_rate_limit_service", {
    p_profile_id: profileId,
    p_bucket: bucket,
    p_limit: limit,
    p_window: `${windowSeconds} seconds`,
  });
  if (!error) return;
  if (error.message?.includes("rate_limit_exceeded")) {
    throw new RateLimitedError(bucket);
  }
  // Fail closed on anything unexpected (e.g. the RPC itself missing/misconfigured)
  // rather than silently skipping the throttle — same "a broken check must not become
  // an open door" reasoning as requireSecret() in require-secret-auth.ts.
  throw error;
}

/** Standard 429 body for a throttled request. */
export function rateLimitResponse(bucket: string): Response {
  return new Response(
    JSON.stringify({ error: "rate_limited", bucket }),
    { status: 429, headers: { "Content-Type": "application/json" } },
  );
}
