import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InviteAcceptance, InviteRedemption, ResolvedInviter } from "@duoqueue/shared-types";

import { inviteUrl, isInviteCodeShape, normalizeInviteCode } from "@/lib/invite";
import { supabase } from "@/lib/supabase";
import { useInviteStore } from "@/store/invite-store";
import { useSessionStore } from "@/store/session-store";

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
 * Redeems a pending code the moment there is a session to attach it to.
 *
 * Mounted once, from `RootLayout`, and deliberately NOT at the point of sign-up. The
 * attribution row has to be written as early as it possibly can be: the invited person is
 * about to walk through a ten-step wizard, and if they abandon it halfway the fact that an
 * invite brought them is exactly the thing the growth loop most needs to have recorded.
 * `redeem_invite_code` is idempotent, so running this on every session change is safe.
 *
 * FAILURE IS A NORMAL OUTCOME, NOT AN ERROR TO SURFACE. The window closed, they were
 * already invited by somebody else, the code was revoked. None of those are worth an alert
 * on top of a sign-up flow; they simply mean there is no arrival to show, and
 * `inviteRouteAction` reads "failed" as "carry on into the app".
 */
export function useInviteRedemption(): void {
  const status = useSessionStore((s) => s.status);
  const pendingCode = useInviteStore((s) => s.pendingCode);
  const redemption = useInviteStore((s) => s.redemption);
  const markRedeeming = useInviteStore((s) => s.markRedeeming);
  const settleRedemption = useInviteStore((s) => s.settleRedemption);

  useEffect(() => {
    if (status !== "signed_in") return;
    if (!pendingCode || redemption !== "idle") return;

    let cancelled = false;
    markRedeeming();

    void (async () => {
      const { data, error } = await supabase.rpc("redeem_invite_code", { p_code: pendingCode });
      if (cancelled) return;

      const row = ((data ?? []) as InviteRedemption[])[0];
      if (error || !row) {
        settleRedemption(null);
        return;
      }

      // `connected` means this account has already been through the arrival screen, most
      // likely on a previous install. The attribution row stands; the celebration does not
      // repeat, so this settles with no arrival.
      settleRedemption(
        row.connected ? null : { inviterId: row.inviter_id, inviterName: row.display_name },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [status, pendingCode, redemption, markRedeeming, settleRedemption]);
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
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      void queryClient.invalidateQueries({ queryKey: ["admirers"] });
      void queryClient.invalidateQueries({ queryKey: ["admirers-count"] });
    },
  });
}
