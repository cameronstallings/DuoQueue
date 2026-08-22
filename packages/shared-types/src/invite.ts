/** Row shapes for the invite RPCs (see supabase/migrations/0065_invites.sql). */

/** `resolve_invite_code(p_code)`. Callable by anon: the sign-up screen has to be able to
 *  name the inviter before the invited person has an account. Zero rows for a code that is
 *  unknown, revoked, or belongs to a profile that is not visible. */
export interface ResolvedInviter {
  inviter_id: string;
  display_name: string;
}

/** `redeem_invite_code(p_code)`. Idempotent: a second call returns the first one's answer. */
export interface InviteRedemption {
  inviter_id: string;
  display_name: string;
  /** Whether this account has already accepted the invite. */
  connected: boolean;
}

/** `accept_invite()`. Deliberately the same (matched, match_id) shape `perform_swipe`
 *  returns, so the arrival screen hands its result to the existing match celebration
 *  rather than growing a second code path. `matched` is false when the inviter had
 *  already passed on this person, or when the inviter's 24 hour cap is spent. */
export interface InviteAcceptance {
  matched: boolean;
  match_id: string | null;
  inviter_id: string;
}
