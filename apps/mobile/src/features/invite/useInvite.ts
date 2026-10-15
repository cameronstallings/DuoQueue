import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InviteAcceptance, InviteRedemption, ResolvedInviter } from "@duoqueue/shared-types";

import { MATCHES_QUERY_KEY } from "@/features/chat/useMatches";
import { PARTY_LFG_RPC, type ResolvedPartyCode } from "@/features/party/partyCall";
import {
  duoRedemptionOutcome,
  inviteUrl,
  isInviteCodeShape,
  needsCallEndedCheck,
  normalizeInviteCode,
  partyRedemptionOutcome,
  redemptionStillWanted,
  shouldRedeemInvite,
} from "@/lib/invite";
import { supabase } from "@/lib/supabase";
import { useInviteStore } from "@/store/invite-store";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

/**
 * The four server calls behind the invite flow, and the one effect that ties them to the
 * session. The decisions all live in `@/lib/invite`, with tests; this file is queries.
 */

export const INVITE_CODE_QUERY_KEY = ["invite-code"] as const;

/**
 * The signed-in user's own code and link, minted on first ask.
 *
 * `staleTime: Infinity` because the code is stable for the life of the account. Nothing
 * revokes it from inside the app today, so a refetch could only ever return the same
 * string, and the invite screen should not show a spinner the second time it opens.
 */
export function useInviteCode() {
  const profileId = useSessionStore((s) => s.session?.user.id);

  const query = useQuery({
    queryKey: [...INVITE_CODE_QUERY_KEY, profileId],
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc("get_or_create_invite_code");
      if (error) throw error;
      return data as string;
    },
    enabled: !!profileId,
    staleTime: Infinity,
  });

  const code = query.data ?? null;
  return {
    code,
    url: code ? inviteUrl(code, process.env.EXPO_PUBLIC_SUPABASE_URL) : null,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/**
 * Who a code belongs to, resolvable with no session.
 *
 * This is the only anon-reachable call in the feature, and it exists so the sign-up screen
 * can say "Cameron invited you" to somebody who does not have an account yet. See D4 in
 * 0065_invites.sql for the disclosure argument.
 *
 * A zero-row answer is a valid result (unknown or revoked code), not an error, so it
 * resolves to null and the caller shows "that code did not work" rather than a failure.
 */
export function useResolveInviteCode(rawCode: string | null | undefined) {
  const code = normalizeInviteCode(rawCode);
  const enabled = isInviteCodeShape(code);

  const query = useQuery({
    queryKey: ["invite-inviter", code],
    queryFn: async (): Promise<ResolvedInviter | null> => {
      const { data, error } = await supabase.rpc("resolve_invite_code", { p_code: code });
      if (error) throw error;
      const rows = (data ?? []) as ResolvedInviter[];
      return rows[0] ?? null;
    },
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    inviter: enabled ? (query.data ?? null) : null,
    isPending: enabled && query.isPending,
    isError: query.isError,
    /** The code is well-formed but nobody owns it. */
    notFound: enabled && !query.isPending && !query.isError && query.data == null,
  };
}

/**
 * Redeems a pending code the moment there is a PROFILE to attach it to.
 *
 * Mounted once, from `RootLayout`, and deliberately NOT at the point of sign-up. The
 * attribution row has to be written as early as it possibly can be: the invited person is
 * about to walk through a ten-step wizard, and if they abandon it halfway the fact that an
 * invite brought them is exactly the thing the growth loop most needs to have recorded.
 * `redeem_invite_code` is idempotent, so running this on every store change is safe.
 *
 * WHY IT WAITS ON `profileStatus` AND NOT ON `status`. It used to fire on `status ===
 * "signed_in"` alone, which was correct only while a session implied a profile. Sign in with
 * Apple broke that: the account authenticates first and the age gate runs after, so there is
 * a real window where the session exists and `profiles` has no row for it. Firing in that
 * window did not merely fail, it destroyed the invite. `redeem_invite_code` reads
 * `profiles.created_at` to check the 14 day window (0066), gets NULL, and raises
 * 'invite_window_closed' -- a verdict that is exactly backwards for the newest account
 * possible. The hook below treats every failure as a settled answer, so `settleRedemption(null)`
 * cleared `pendingCode` from the store AND from AsyncStorage, and the effect never ran again
 * because there was nothing left to run on. Every invited Apple install lost its attribution
 * silently: no invite_redemptions row, no credit to the inviter, no arrival screen.
 *
 * Gating on "loaded" fixes the ordering rather than papering over the symptom. It is also
 * self-timing: `completeSignup` ends in a `refreshProfile()` that flips profileStatus to
 * "loaded", which re-runs this effect at precisely the first moment the RPC can succeed. The
 * email path is unchanged, because `initialize()` reads the profile before it flips `status`,
 * so both facts land in the same set().
 *
 * FAILURE IS A NORMAL OUTCOME, NOT AN ERROR TO SURFACE. The window closed, they were
 * already invited by somebody else, the code was revoked. None of those are worth an alert
 * on top of a sign-up flow; they simply mean there is no arrival to show, and
 * `inviteRouteAction` reads "failed" as "carry on into the app". Two endings ARE said, once, as
 * an info toast, because the player did something and deserves to know why nothing came of it:
 * a party post that filled or ended, and a Duo Call that ended, before their profile existed.
 */
export function useInviteRedemption(): void {
  const status = useSessionStore((s) => s.status);
  const profileStatus = useSessionStore((s) => s.profileStatus);
  const pendingCode = useInviteStore((s) => s.pendingCode);
  const redemption = useInviteStore((s) => s.redemption);
  const markRedeeming = useInviteStore((s) => s.markRedeeming);
  const settleRedemption = useInviteStore((s) => s.settleRedemption);

  useEffect(() => {
    // The gate itself lives in `@/lib/invite` with tests, for the same reason
    // `inviteRouteAction` does: it is the part of this hook that can be wrong, it was wrong,
    // and being wrong cost every invited Apple install its attribution without saying so.
    if (!pendingCode || !shouldRedeemInvite({ sessionStatus: status, profileStatus, pendingCode, redemption })) return;

    const code = pendingCode;
    markRedeeming();

    // SETTLE ONLY WHILE THE STORE IS STILL WAITING ON THIS CODE. This used to be a `cancelled`
    // flag set by the effect's cleanup, but `markRedeeming()` just above changes `redemption`,
    // one of this effect's own dependencies, so React ran the cleanup on the very next render:
    // every answer arrived "cancelled", nothing ever settled, and `redemption` sat at "pending"
    // for good (an invite deep link held its Logo frame, and the commit gave up after 5 s and
    // went to /welcome instead of /invited). The store itself says whether the answer is still
    // wanted: a newer code (setPendingCode resets it to "idle") or a cleared arrival means no.
    // The decision is `redemptionStillWanted` in `@/lib/invite`, with tests.
    const stillWaiting = () => {
      const { pendingCode: nowPending, redemption: nowRedemption } = useInviteStore.getState();
      return redemptionStillWanted(
        { pendingCode: nowPending, redemption: nowRedemption, sessionStatus: useSessionStore.getState().status },
        code,
      );
    };
    const say = (notice: string | null) => {
      if (notice) useToastStore.getState().showToast(notice, "info");
    };

    void (async () => {
      try {
        const onboarded = useSessionStore.getState().profile?.onboarding_completed === true;

        // A party LFG post's code first (0089). resolve_party_code is read-only, so asking costs an
        // ordinary invite nothing, and any error or zero rows falls through to the path below
        // exactly as before (partyRedemptionOutcome). Nothing is written for a party code here:
        // the seat is only taken when the player taps Join on /invited (join_party_by_code), so an
        // abandoned sign-up never holds it.
        const party = await supabase.rpc(PARTY_LFG_RPC.resolve, { p_code: code });
        if (!stillWaiting()) return;
        const partyOutcome = partyRedemptionOutcome({ error: party.error, rows: party.data, code, onboarded });
        if (partyOutcome.kind === "arrival") {
          settleRedemption(partyOutcome.arrival);
          return;
        }
        if (partyOutcome.kind === "refused") {
          settleRedemption(null, partyOutcome.notice);
          say(partyOutcome.notice);
          return;
        }

        const { data, error } = await supabase.rpc("redeem_invite_code", { p_code: code });
        if (!stillWaiting()) return;

        const row = ((data ?? []) as InviteRedemption[])[0];
        const answer = { errored: !!error, row, onboarded };
        // An empty answer can be a Duo Call that ended between the front door and now (one duo per
        // Queue up closes a call at its first duo). One more read says whether that is what
        // happened, so the player is told instead of left wondering where the invite went.
        let callEnded = false;
        if (needsCallEndedCheck(answer)) {
          const ended = await supabase.rpc("call_code_ended", { p_code: code });
          if (!stillWaiting()) return;
          callEnded = !ended.error && ended.data === true;
        }

        // `connected` means this account has already been through the arrival screen, most
        // likely on a previous install. The attribution row stands; the celebration does not
        // repeat, so that settles with no arrival (duoRedemptionOutcome).
        const outcome = duoRedemptionOutcome({ ...answer, callEnded });
        settleRedemption(outcome.arrival, outcome.notice);
        say(outcome.notice);
      } catch {
        // A thrown request (supabase-js reports most failures as `error`, not by throwing).
        if (stillWaiting()) settleRedemption(null);
      }
    })();
  }, [status, profileStatus, pendingCode, redemption, markRedeeming, settleRedemption]);
}

/**
 * Whether a code is a party LFG post's (resolve_party_code, readable signed out, like
 * resolve_invite_code). Asked by the invite field only once resolve_invite_code has said the code
 * is nobody's invite, and by Matches > "Have a party code?".
 *
 *  - undefined while that one question is being asked, so the field keeps saying it is checking;
 *  - null when the code is not a party code: zero rows, or ANY error (PGRST202 before 0089, the
 *    kill switch, offline), so the field falls back to its old lines;
 *  - the row ("live", "full" or "ended") otherwise.
 */
export function useResolvePartyCode(code: string | null, enabled: boolean): ResolvedPartyCode | null | undefined {
  const normalized = normalizeInviteCode(code);
  const asked = enabled && isInviteCodeShape(normalized);
  const query = useQuery({
    queryKey: ["party-code", normalized],
    queryFn: async (): Promise<ResolvedPartyCode | null> => {
      const { data, error } = await supabase.rpc(PARTY_LFG_RPC.resolve, { p_code: normalized });
      if (error) return null;
      const row = ((data ?? []) as ResolvedPartyCode[])[0];
      return row && (row.status === "live" || row.status === "full" || row.status === "ended") ? row : null;
    },
    enabled: asked,
    staleTime: 30_000,
    retry: false,
  });
  if (!asked) return null;
  if (query.data !== undefined) return query.data;
  return query.isError ? null : undefined;
}

/**
 * The invited person's half of the two consents: "duo with the friend who brought me".
 *
 * Invalidates the deck and the matches list on success because the inviter has just moved
 * out of one and into the other.
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<InviteAcceptance> => {
      const { data, error } = await supabase.rpc("accept_invite");
      if (error) throw error;
      const row = ((data ?? []) as InviteAcceptance[])[0];
      if (!row) throw new Error("Could not connect you two. Please try again.");
      return row;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["deck"] });
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["admirers"] });
      void queryClient.invalidateQueries({ queryKey: ["admirers-count"] });
    },
  });
}
