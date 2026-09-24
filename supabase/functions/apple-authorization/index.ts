// Exchanges the one-time authorization code from a Sign in with Apple sheet for a refresh
// token, and stores it so that `delete-account` can revoke the grant later.
//
// ============================================================================
// WHY A FUNCTION AND NOT A LINE IN THE CLIENT
// ============================================================================
//
// The exchange has to be signed with the Sign in with Apple .p8 key. That key can create a
// client secret for this app's entire Apple relationship, so it cannot go anywhere near a
// binary that ships to phones -- everything in apps/mobile is readable by anybody who
// downloads the app. So the client sends the authorization code, which is single use, expires
// in about five minutes, and is worth nothing without the key, and the server does the part
// that needs the secret.
//
// ============================================================================
// WHY IT RUNS AT SIGN-IN AND NOT AT DELETION, WHICH IS WHERE IT IS NEEDED
// ============================================================================
//
// Revocation needs a refresh token. A refresh token comes only from exchanging the
// authorization code. The code is dead five minutes after the Apple sheet closes. There is no
// version of this that happens later, which is why an account deletion depends on a call made
// at a completely different moment, possibly months earlier -- and why the failure mode worth
// designing for is "the sign-in-time call never happened".
//
// ============================================================================
// FAILURE IS NON-FATAL, ON BOTH SIDES
// ============================================================================
//
// By the time this is called the user is ALREADY signed in: `signInWithIdToken` returned a
// session before the client got here. So a failure here cannot and must not fail the sign-in,
// and the client treats it as fire-and-forget. What it costs is one account whose Apple grant
// cannot be revoked at deletion time, logged on both ends. That is the correct trade against
// the alternative, which is refusing to let somebody into the app because Apple's token
// endpoint was slow.
//
// This also means the function is safe to call again: a later sign-in produces a new code and
// upserts a fresh token over the old one. It does NOT revoke the token it replaces -- same
// grant, same user, and revoking it would sign out the session being established.
//
// verify_jwt = true (supabase/config.toml), and the caller is re-derived from the JWT with
// getUser() rather than taken from the body. There is no user id in the request at all: a
// caller can only ever write a token for themselves. And only for their OWN Apple ID: the
// id_token that comes back with the refresh token names the Apple user the code belonged to,
// and a token whose `sub` is not one of the caller's linked Apple identities is dropped rather
// than stored (see _shared/apple-id-token.ts). Without that, any signed-in account, including
// an email one, could park an Apple grant it has nothing to do with under its own id.
//
// "ALWAYS 200" MEANS ALWAYS once the caller is known. Everything after the body is parsed runs
// inside one try/catch, so a malformed .p8, an Apple that never answers or a database hiccup
// is a log line and `{ ok: false }`, never a 500 the client would have to reason about.
import { createClient } from "npm:@supabase/supabase-js@2";

import { appleAuthConfigFromEnv, exchangeAuthorizationCode } from "../_shared/apple-auth.ts";
import { isCallersAppleSubject } from "../_shared/apple-id-token.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Apple's codes are short. A cap here means a hostile body cannot be streamed at us. */
const MAX_CODE_LENGTH = 2048;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  let authorizationCode: unknown;
  try {
    const body = (await req.json()) as { authorizationCode?: unknown };
    authorizationCode = body.authorizationCode;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (typeof authorizationCode !== "string" || authorizationCode.length === 0 || authorizationCode.length > MAX_CODE_LENGTH) {
    return jsonResponse({ error: "Missing or malformed authorizationCode" }, 400);
  }

  try {
    const config = appleAuthConfigFromEnv();
    if (!config) {
      // Deployed without the .p8 secrets. Say so in the log, tell the client nothing it could
      // act on, and answer 200: the sign-in it belongs to has already succeeded, and turning
      // this into a visible error would make a working sign-in look broken.
      console.warn("apple-authorization: Apple revocation secrets are not configured; skipping exchange");
      return jsonResponse({ ok: false, reason: "not_configured" }, 200);
    }

    const exchange = await exchangeAuthorizationCode(config, authorizationCode);
    if (!exchange.ok) {
      // Apple's own error text, in the log only. It routinely contains `invalid_client`, which
      // is a deployment problem (wrong team id, wrong key id, wrong bundle id) and not something
      // the user can fix, and `invalid_grant`, which is a code that was already spent -- the
      // ordinary outcome of a double-submitted sign-in.
      console.error("apple-authorization: code exchange failed", { detail: exchange.detail });
      return jsonResponse({ ok: false, reason: "exchange_failed" }, 200);
    }

    if (!isCallersAppleSubject(exchange.subject, user.identities)) {
      // Not revoked either: the grant it belongs to is somebody else's, or cannot be told
      // apart from somebody else's, and revoking it would be acting on an Apple ID this
      // caller never showed us. The token simply goes out of scope.
      console.error("apple-authorization: code does not belong to the caller's Apple identity; not stored", {
        userId: user.id,
        hasSubject: exchange.subject !== null,
      });
      return jsonResponse({ ok: false, reason: "identity_mismatch" }, 200);
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: upsertError } = await serviceClient
      .from("apple_refresh_tokens")
      .upsert(
        { user_id: user.id, refresh_token: exchange.refreshToken, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      console.error("apple-authorization: failed to store refresh token", { message: upsertError.message });
      return jsonResponse({ ok: false, reason: "store_failed" }, 200);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error("apple-authorization: unexpected failure; the sign-in itself is unaffected", {
      message: err instanceof Error ? err.message : String(err),
    });
    return jsonResponse({ ok: false, reason: "unexpected" }, 200);
  }
});
