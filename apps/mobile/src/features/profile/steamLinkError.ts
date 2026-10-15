/**
 * What a player reads when Steam linking fails. Pure, so it is tested.
 *
 * Until 1.0.2 the Connections screen printed whatever came back: a raw Postgres message when
 * start_steam_link failed (it failed on every call until 0087, see that migration), or the
 * callback's `detail` code ("state_expired", "invalid_assertion") after a round trip through
 * Steam. Cameron read that as "nothing even happens". The codes are the ones
 * supabase/functions/link-steam-callback/index.ts redirects with.
 */

export const STEAM_LINK_COPY = {
  couldNotStart: "Couldn't open Steam. Check your connection and try again.",
  notConfirmed: "Steam didn't confirm the sign-in. Please try again.",
  expired: "That took too long. Tap Connect to try again.",
  unavailable: "Steam linking isn't available right now. Please try again later.",
  tooMany: "Too many tries. Please wait a bit and try again.",
  saveFailed: "Couldn't save your Steam account. Please try again.",
} as const;

/** The callback's `detail` code (from duoqueue://link-steam-result?result=error&detail=...). */
export function steamLinkDetailMessage(detail: string | null | undefined): string {
  switch (detail) {
    case "state_expired":
      return STEAM_LINK_COPY.expired;
    case "steam_not_configured":
      return STEAM_LINK_COPY.unavailable;
    case "rate_limited":
      return STEAM_LINK_COPY.tooMany;
    case "save_failed":
      return STEAM_LINK_COPY.saveFailed;
    default:
      // missing_state, bad_op_endpoint, unsigned_claim, missing_return_to, bad_return_to,
      // state_mismatch, invalid_assertion, no_steam_id, or anything newer.
      return STEAM_LINK_COPY.notConfirmed;
  }
}
