import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

import { supabase } from "@/lib/supabase";

import { composeAppleDisplayName } from "./appleDisplayName";
import { clearPendingDisplayName, setPendingDisplayName } from "./pendingDisplayName";
import { isAppleCancellation } from "./socialSignIn";

/** 32 random bytes, hex encoded: 256 bits, far past anything a replay could guess. */
const NONCE_BYTES = 32;

/**
 * A one-time value that ties the identity token Apple mints to THIS sign-in attempt.
 *
 * WHY: without one, an Apple identity token is a bearer credential for as long as it lives. Anybody
 * who got hold of one (a log line, a proxy, a crash report) could hand it to `signInWithIdToken`
 * and be signed in as that user until it expired. With a nonce, the token carries a value only the
 * app instance that asked for it knows, and GoTrue refuses the token without it.
 *
 * WHICH VALUE GOES WHERE, which is the part that is easy to get backwards and fails silently as
 * "Nonces mismatch": Apple is given the SHA-256 HASH, and puts that hash in the token's `nonce`
 * claim. Supabase is given the RAW value, hashes it the same way (lowercase hex SHA-256) and
 * compares. So the raw value never leaves this process except in the call to our own auth server,
 * and the thing written into a token that may be logged is a hash of it.
 */
async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Array.from(Crypto.getRandomBytes(NONCE_BYTES), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
  return { raw, hashed };
}

/** Throws on failure or user cancellation — callers should catch and surface/ignore. */
export async function signInWithApple(): Promise<void> {
  const nonce = await createNonce();

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: nonce.hashed,
  });

  if (!credential.identityToken) {
    throw new Error("Apple sign-in did not return an identity token.");
  }

  // BEFORE the token exchange, not after, and that ordering is the whole reason this is not a
  // one-liner at the bottom of the function.
  //
  // `signInWithIdToken` fires the store's auth listener as part of resolving, and once a
  // session exists for an account with no profile row, `app/index.tsx` renders
  // CompleteSignupScreen. That screen reads this key. Writing afterwards would be a race
  // against a screen that is already mounting — usually won, since a profile read is several
  // network calls and this is one AsyncStorage write, and a lost race costs exactly the thing
  // this whole mechanism exists to prevent. Writing first means there is no race to lose.
  //
  // A null writes a clear rather than nothing: see `setPendingDisplayName`. Apple gives the
  // name only on the first authorization for an Apple ID, so a returning user MUST wipe
  // whatever a previous attempt on this phone left behind rather than inherit it.
  await setPendingDisplayName(composeAppleDisplayName(credential.fullName));

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: credential.identityToken,
    nonce: nonce.raw,
  });
  if (error) {
    // No session came of it, so nothing will ever read this. Dropping it here keeps the value's
    // lifetime tied to a signup that actually started.
    await clearPendingDisplayName();
    throw error;
  }

  // Order matters: the session has to exist before this call, because the function it reaches
  // is authenticated and derives the user from the JWT rather than from anything in the body.
  await captureAppleAuthorizationCode(credential.authorizationCode);
}

/**
 * Hands Apple's one-time authorization code to the server so the grant can be revoked when the
 * account is deleted.
 *
 * ============================================================================
 * WHY THIS CALL EXISTS
 * ============================================================================
 *
 * Apple requires any app offering Sign in with Apple to call its token revocation endpoint
 * when a user deletes their account. It has been an enforced App Review item since 30 June
 * 2022 and it is checked, on the deletion flow reviewers exercise first. Supabase does not do
 * it: `auth.admin.deleteUser` removes the auth.users row and nothing else, so the grant would
 * stay live in iOS Settings > Apple ID > Sign in with Apple, pointing at an account that no
 * longer exists.
 *
 * Revoking needs a refresh token, a refresh token comes only from exchanging this code, and
 * the code is single use and dead about five minutes after the Apple sheet closes. So it has
 * to be spent NOW, at sign-in, for something that will not be needed until deletion. This
 * function used to read `credential.identityToken` and let the rest of the credential go out
 * of scope, which made compliant deletion impossible rather than merely unimplemented.
 *
 * The exchange itself happens in the `apple-authorization` Edge Function because it must be
 * signed with the Sign in with Apple .p8 key, and that key can mint a client secret for this
 * app's entire Apple relationship. It cannot ship inside a binary anybody can download. The
 * code alone is worth nothing without it.
 *
 * ============================================================================
 * WHY A FAILURE HERE IS SWALLOWED
 * ============================================================================
 *
 * The user is already signed in by the time this runs. Throwing would surface an error on a
 * sign-in that SUCCEEDED, and the error would say nothing they could act on. What a failure
 * actually costs is one account whose Apple grant cannot be revoked later, which is logged on
 * both ends and is strictly better than blocking somebody at the door because Apple's token
 * endpoint was slow.
 *
 * A missing code is not an error either. Apple omits it in some re-authorization paths, and on
 * a subsequent sign-in the previously stored token is still the right one for the same grant.
 */
async function captureAppleAuthorizationCode(authorizationCode: string | null): Promise<void> {
  if (!authorizationCode) return;

  try {
    const { error } = await supabase.functions.invoke("apple-authorization", {
      body: { authorizationCode },
    });
    if (error) {
      console.warn("Could not register the Apple authorization code:", error.message);
    }
  } catch (err) {
    console.warn("Could not register the Apple authorization code:", err);
  }
}

/**
 * A fresh Apple authorization code, asked for at the moment an Apple account is being deleted,
 * or null when one cannot be had.
 *
 * ============================================================================
 * WHY DELETION ASKS APPLE AGAIN
 * ============================================================================
 *
 * `captureAppleAuthorizationCode` above is fire and forget, and it is the only thing that ever
 * stores the refresh token delete-account needs. If that one request failed (no signal, secrets
 * not set yet, the function not deployed, an Apple 5xx), the code it carried died five minutes
 * later and that account's grant could never be revoked. Apple rejects apps under Guideline
 * 5.1.1(v) for exactly that, and a reviewer's own test account is the one most likely to have
 * signed in during a deploy window.
 *
 * So the deletion path gets its own code, minutes before it is spent. delete-account exchanges it
 * whenever it has no stored token (or the stored one will not revoke) and checks that it belongs
 * to the same Apple ID as the account before revoking anything. On a device already authorized
 * for this app, Apple shows a short "Continue with Apple ID" confirmation rather than the full
 * consent sheet. No scopes are requested: nothing about the name or email is needed, only the
 * code.
 *
 * ============================================================================
 * WHY EVERY FAILURE IS A NULL, AND THE DELETION STILL HAPPENS
 * ============================================================================
 *
 * The user has already confirmed, twice, that they want their account gone. Dismissing Apple's
 * sheet, a device with no Apple ID signed in, or Android (where an Apple account can exist but
 * this sheet cannot) must not turn that into "you cannot delete your account", which would trade
 * one App Review failure for a worse one. It is logged, and the server falls back to the token
 * stored at sign-in, if there is one.
 */
export async function appleAuthorizationCodeForDeletion(): Promise<string | null> {
  if (Platform.OS !== "ios") {
    console.warn("Apple revocation at deletion is iOS only; relying on the token stored at sign-in.");
    return null;
  }

  try {
    if (!(await AppleAuthentication.isAvailableAsync())) {
      console.warn("Sign in with Apple is unavailable on this device; relying on the token stored at sign-in.");
      return null;
    }

    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    if (!credential.authorizationCode) {
      console.warn("Apple returned no authorization code at deletion; relying on the token stored at sign-in.");
      return null;
    }
    return credential.authorizationCode;
  } catch (err) {
    if (isAppleCancellation(err)) {
      console.warn(
        "Apple confirmation was dismissed at deletion. The account is still deleted, but its Apple grant can only be revoked if a token was stored at sign-in.",
      );
    } else {
      console.warn("Could not get a fresh Apple authorization code for deletion; revocation could not be done from here:", err);
    }
    return null;
  }
}
