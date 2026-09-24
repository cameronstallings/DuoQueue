/**
 * Whether the signed-in account has a Sign in with Apple identity behind it.
 *
 * Asked in exactly one situation: deleting the account. An Apple account needs a fresh Apple
 * authorization code sent along with the deletion so its grant can be revoked (see
 * `appleAuthorizationCodeForDeletion`), and an email account must not be shown an Apple sheet it
 * has nothing to do with. Getting this wrong in the first direction leaves a grant alive in iOS
 * Settings after the account is gone; in the second, it asks an email user to confirm an Apple ID.
 *
 * ============================================================================
 * THREE PLACES, BECAUSE GOTRUE WRITES THREE
 * ============================================================================
 *
 *   - `app_metadata.providers`: every provider linked to the account. The one that matters most,
 *     because it also covers an email account that later signed in with Apple and was linked by
 *     GoTrue's automatic identity linking.
 *   - `app_metadata.provider`: the provider of the FIRST identity only. Kept as a fallback for a
 *     session minted before `providers` existed in the JWT.
 *   - `identities[].provider`: present on the user object from `getUser()`, and on some sessions.
 *
 * Any one of them saying "apple" is enough. The cost of a false positive is one Apple sheet the
 * user can dismiss; the cost of a false negative is a grant nobody can revoke.
 *
 * Pure and dependency free, so it runs under vitest without the Supabase client in the tree.
 */
export interface AppleIdentityCarrier {
  app_metadata?: { provider?: unknown; providers?: unknown } | null;
  identities?: readonly { provider?: string | null }[] | null;
}

export function hasAppleIdentity(user: AppleIdentityCarrier | null | undefined): boolean {
  if (!user) return false;

  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes("apple")) return true;
  if (user.app_metadata?.provider === "apple") return true;

  return (user.identities ?? []).some((identity) => identity?.provider === "apple");
}
