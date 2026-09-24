// The Sign in with Apple REST API, reduced to the two calls this project makes: exchange an
// authorization code for a refresh token, and revoke that refresh token.
//
// ============================================================================
// WHY THIS EXISTS AT ALL
// ============================================================================
//
// Apple requires that an app offering Sign in with Apple revoke the user's tokens when the
// user deletes their account. It has been an enforced App Review item since 30 June 2022 and
// it is checked, on the flow reviewers exercise first. Supabase does not do it for you:
// `auth.admin.deleteUser` removes the auth.users row and nothing else, so without this the
// grant stays live in iOS Settings > Apple ID > Sign in with Apple for an account that no
// longer exists, and the app is rejected under Guideline 5.1.1(v).
//
// The awkward part is the ordering. Revocation needs a refresh token; a refresh token can only
// be obtained by exchanging `credential.authorizationCode`; and that code is single-use and
// expires in about five minutes. So the code a user got at sign-in is long dead by the time they
// delete their account, and it has to be spent at SIGN-IN, which is why there is an
// `apple-authorization` function whose whole job is one HTTP round trip and one upsert. The
// client-side half is `signInWithApple()` in apps/mobile/src/features/auth/appleSignIn.ts,
// which used to read `credential.identityToken` and drop everything else on the floor.
//
// That sign-in call is fire and forget, so it is not the only way in. When the account being
// deleted is an Apple account, the client asks Apple for a FRESH code at deletion time
// (`appleAuthorizationCodeForDeletion`) and sends it in the delete-account body, and
// delete-account exchanges it right there whenever no stored token exists or the stored one
// would not revoke. One lost request at sign-in no longer means a grant that can never be
// revoked.
//
// ============================================================================
// THE CLIENT SECRET IS A JWT YOU SIGN YOURSELF
// ============================================================================
//
// Apple has no static client secret. Both endpoints want a `client_secret` that is an ES256
// JWT signed with a Sign in with Apple key (.p8) downloadable exactly once from the Apple
// Developer portal, carrying the team id as `iss`, the client id as `sub`, and
// https://appleid.apple.com as `aud`. Apple caps its lifetime at six months; this mints a
// short-lived one per call instead, because there is nowhere to cache it that is cheaper than
// signing it, and a five-minute secret cannot be stolen from a log and reused.
//
// CLIENT ID IS THE BUNDLE ID, not a Services ID. The native flow
// (expo-apple-authentication + signInWithIdToken) has no browser redirect in it, so there is
// no Services ID, no Return URL and no verified domain anywhere in this integration; Apple
// mints the identity token with `aud` = com.duoqueue.app and expects the same value here.
// This is also why no `redirect_uri` is sent on the exchange: that parameter belongs to the
// web flow, and including it makes Apple reject an app-originated code.
//
// WebCrypto is used rather than a JOSE library because Deno has it built in and ECDSA-P256
// signatures come back in raw r||s form, which is exactly the 64 bytes JWS ES256 wants. A DER
// signature -- what most non-WebCrypto signers produce -- would need unwrapping first, and
// getting that wrong is silent: Apple answers `invalid_client` and says nothing else.

import { appleIdTokenSubject } from "./apple-id-token.ts";

const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";
const APPLE_AUDIENCE = "https://appleid.apple.com";

/** How long a minted client secret is good for. Apple's ceiling is six months; we want minutes. */
const CLIENT_SECRET_TTL_SECONDS = 300;

/**
 * How long either Apple call may take before it is abandoned.
 *
 * `fetch` has no timeout of its own, and both callers are on a path a person is waiting on: a
 * sign-in that has already succeeded, and an account deletion that must finish. An Apple that
 * accepts the connection and never answers would otherwise hold the function until the platform
 * kills it, and on the deletion path that kill lands AFTER the storage objects are gone and
 * BEFORE deleteUser runs. Eight seconds is several times Apple's ordinary latency and well
 * inside the Edge Function wall clock.
 */
const APPLE_FETCH_TIMEOUT_MS = 8000;

function describeThrown(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

export interface AppleAuthConfig {
  /** Apple Developer team id, 10 characters. `iss` on the client secret. */
  teamId: string;
  /** The id of the Sign in with Apple key the .p8 belongs to. Goes in the JWT header as `kid`. */
  keyId: string;
  /** The .p8 file's contents, PEM and all. Newlines may arrive escaped; see `parsePrivateKey`. */
  privateKeyPem: string;
  /** The iOS bundle identifier. `sub` on the client secret and `client_id` on both calls. */
  clientId: string;
}

/**
 * Reads the four values from the environment, or returns null when Apple revocation has not
 * been configured for this deployment.
 *
 * NULL IS A SUPPORTED ANSWER, deliberately. `delete-account` must keep working before the .p8
 * exists (and on a local stack that will never have one), and a missing secret must never be
 * the reason somebody cannot delete their account -- that would trade one App Review failure
 * for a worse one. Callers log and carry on.
 */
export function appleAuthConfigFromEnv(): AppleAuthConfig | null {
  const teamId = Deno.env.get("APPLE_TEAM_ID");
  const keyId = Deno.env.get("APPLE_KEY_ID");
  const privateKeyPem = Deno.env.get("APPLE_PRIVATE_KEY");
  const clientId = Deno.env.get("APPLE_BUNDLE_ID");
  if (!teamId || !keyId || !privateKeyPem || !clientId) return null;
  return { teamId, keyId, privateKeyPem, clientId };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * PEM in, CryptoKey out.
 *
 * `\n` is un-escaped first because a .p8 pasted into `supabase secrets set` (or into a CI
 * variable, or a .env file) routinely arrives with its newlines as two literal characters.
 * Both forms are accepted rather than documenting one and failing opaquely on the other: the
 * failure is a base64 decode error at sign time, on the one path nobody exercises until a real
 * user deletes a real account.
 */
async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const normalized = privateKeyPem.replace(/\\n/g, "\n");
  const body = normalized
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

/** The ES256 JWT Apple wants wherever an OAuth client secret would normally go. */
export async function createClientSecret(config: AppleAuthConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeJson({ alg: "ES256", kid: config.keyId, typ: "JWT" });
  const payload = base64UrlEncodeJson({
    iss: config.teamId,
    iat: now,
    exp: now + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: config.clientId,
  });

  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(config.privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export type AppleExchangeResult =
  | {
      ok: true;
      refreshToken: string;
      /**
       * The Apple user the code belonged to, from the id_token in the same response, or null
       * when Apple sent none or it did not parse. Callers compare it to the caller's own Apple
       * identity before keeping or spending the token; see apple-id-token.ts.
       */
      subject: string | null;
    }
  /** Apple said no, or could not be reached. `detail` is safe to log and never shown. */
  | { ok: false; detail: string };

/**
 * Exchanges a one-time authorization code for a refresh token.
 *
 * No `redirect_uri`: see the header. The refresh token this returns is the ONLY artifact of a
 * sign-in that can later revoke the grant, which is why the caller stores it rather than
 * treating this as fire and forget.
 *
 * NEVER THROWS. A malformed .p8 fails inside `importPrivateKey`, a DNS or TLS failure fails
 * inside `fetch`, and a hung Apple fails at the timeout; every one of them comes back as
 * `{ ok: false }` with the reason in `detail`, so a caller cannot forget the try/catch that
 * turns them into a 500.
 */
export async function exchangeAuthorizationCode(
  config: AppleAuthConfig,
  authorizationCode: string,
): Promise<AppleExchangeResult> {
  try {
    const clientSecret = await createClientSecret(config);

    const response = await fetch(APPLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(APPLE_FETCH_TIMEOUT_MS),
    });

    const text = await response.text();
    if (!response.ok) {
      return { ok: false, detail: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }

    let parsed: { refresh_token?: unknown; id_token?: unknown };
    try {
      parsed = JSON.parse(text) as { refresh_token?: unknown; id_token?: unknown };
    } catch {
      return { ok: false, detail: "Apple returned a non-JSON token response." };
    }

    if (typeof parsed.refresh_token !== "string" || parsed.refresh_token.length === 0) {
      return { ok: false, detail: "Apple returned no refresh_token." };
    }
    return {
      ok: true,
      refreshToken: parsed.refresh_token,
      subject: appleIdTokenSubject(parsed.id_token, config.clientId),
    };
  } catch (err) {
    return { ok: false, detail: `exchange threw: ${describeThrown(err)}` };
  }
}

/**
 * Revokes a refresh token, and with it the user's whole grant for this app.
 *
 * Apple answers 200 with an empty body on success. A failure is returned rather than thrown
 * because the only caller is an account deletion already in flight, and a deletion that stops
 * halfway because Apple was unreachable is a worse outcome than a grant that outlives the
 * account: the first one strands a user who asked to leave, the second one is a line in a log.
 * That promise used to cover only an Apple that answered with an error; a key that would not
 * import or a network that would not connect threw straight through it. Now it covers both.
 */
export async function revokeRefreshToken(
  config: AppleAuthConfig,
  refreshToken: string,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  try {
    const clientSecret = await createClientSecret(config);

    const response = await fetch(APPLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: clientSecret,
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
      signal: AbortSignal.timeout(APPLE_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, detail: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: `revoke threw: ${describeThrown(err)}` };
  }
}
