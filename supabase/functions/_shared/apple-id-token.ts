// Who an Apple authorization code belongs to, read from the id_token Apple's token endpoint
// hands back alongside the refresh token.
//
// ============================================================================
// WHY THIS IS CHECKED AT ALL
// ============================================================================
//
// `apple-authorization` and `delete-account` both take an authorization code from a signed-in
// caller and trade it for a refresh token. Nothing about the code itself says whose Apple ID it
// came from: any signed-in user, including one who signed up with an email and a password, can
// post one. Unchecked, that means a DuoQueue account can end up holding (and at deletion,
// revoking) the Apple grant of an Apple ID it has nothing to do with -- a second account on the
// same phone, say, since `signInAsync` always answers for whatever Apple ID the device is signed
// in to. It cannot take over anybody's account, but revoking a stranger's grant is not a thing
// this project should be able to do by accident.
//
// So the exchange's id_token `sub` has to equal the Apple identity GoTrue already linked to the
// caller when they signed in with Apple. No Apple identity on the caller, or a different one, and
// the token is dropped on the floor.
//
// ============================================================================
// WHY THE SIGNATURE IS NOT VERIFIED
// ============================================================================
//
// This token never passes through a client. It is part of the response to a server-to-server
// POST this project made to https://appleid.apple.com over TLS, authenticated with our own
// client secret, which is the case OpenID Connect Core 3.1.3.7 lets TLS server validation stand
// in for the signature check. Fetching Apple's JWKS to verify it again would add a network call
// that can fail on the deletion path and prove nothing the handshake did not. The issuer and the
// audience ARE checked, because that costs nothing.
//
// PURE ON PURPOSE: no `Deno`, no `npm:` specifiers, so apps/mobile's vitest runner covers it
// (apps/mobile/vitest.config.mts), the same arrangement new-player-alert.ts has. Deno callers
// import it with the `.ts` extension; the test imports it without.

export const APPLE_ISSUER = "https://appleid.apple.com";

/**
 * The `sub` claim of an Apple id_token, or null when the token is missing, malformed, from
 * another issuer, or minted for another client.
 *
 * Null is an ordinary answer rather than an exception: Apple has omitted id_token from token
 * responses before, and every caller treats "cannot tell whose this is" the same way it treats
 * "it is somebody else's".
 */
export function appleIdTokenSubject(idToken: unknown, expectedAudience: string): string | null {
  if (typeof idToken !== "string") return null;

  const segments = idToken.split(".");
  if (segments.length !== 3 || !segments[1]) return null;

  let claims: unknown;
  try {
    claims = JSON.parse(base64UrlDecode(segments[1]));
  } catch {
    return null;
  }
  if (typeof claims !== "object" || claims === null) return null;

  const { iss, aud, sub } = claims as { iss?: unknown; aud?: unknown; sub?: unknown };
  if (iss !== APPLE_ISSUER) return null;

  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(expectedAudience)) return null;

  return typeof sub === "string" && sub.length > 0 ? sub : null;
}

/**
 * A GoTrue identity, restated structurally so this file needs no supabase-js types. Every field
 * is optional because the admin and user APIs have both changed which ones they fill in over
 * time.
 */
export interface IdentityLike {
  provider?: string | null;
  /** The provider's own user id on current GoTrue, i.e. Apple's `sub`. */
  id?: string | null;
  identity_data?: Record<string, unknown> | null;
}

/**
 * Every Apple subject GoTrue has linked to this user.
 *
 * Read from three places because GoTrue has moved it: `identity_data.sub` is what Apple's own
 * token said, `identity_data.provider_id` is where newer versions copy it, and `id` has meant the
 * provider id since `identity_id` took over the row's primary key. They agree whenever more than
 * one is present; collecting all of them just means a version change cannot turn every check
 * into a mismatch.
 */
export function appleSubjectsOf(identities: readonly IdentityLike[] | null | undefined): string[] {
  const subjects = new Set<string>();
  for (const identity of identities ?? []) {
    if (identity?.provider !== "apple") continue;
    for (const candidate of [identity.identity_data?.sub, identity.identity_data?.provider_id, identity.id]) {
      if (typeof candidate === "string" && candidate.length > 0) subjects.add(candidate);
    }
  }
  return [...subjects];
}

/** True only when `subject` is one of the caller's own Apple identities. A null never matches. */
export function isCallersAppleSubject(
  subject: string | null,
  identities: readonly IdentityLike[] | null | undefined,
): boolean {
  if (!subject) return false;
  return appleSubjectsOf(identities).includes(subject);
}

function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}
