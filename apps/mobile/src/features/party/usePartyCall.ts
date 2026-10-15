import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

import {
  isPartyLfgUnavailable,
  PARTY_LFG_RPC,
  type PartyCallRow,
  type PartyCodePreviewRow,
  type PartyJoinRow,
  type StartedPartyCall,
} from "./partyCall";
import {
  MY_PARTIES_QUERY_KEY,
  PARTY_INVITES_QUERY_KEY,
  PARTY_POLL_MS,
  partyCallQueryKey,
  partyMembersQueryKey,
} from "./useParty";

/**
 * The party LFG post's server calls (0089). The decisions live in partyCall.ts, with tests; this
 * file is queries. Every name is in PARTY_LFG_RPC, and every read fails soft: before 0089 is live
 * (PGRST202), or under its kill switch (42501), the post's row is hidden and the party screen is
 * exactly build 19's.
 */

/** A read of the party's live post: unavailable (hide everything), or the row (null for none). */
export type PartyCallRead = { available: false } | { available: true; call: PartyCallRow | null };

/**
 * The party's live post, as a member sees it (get_party_call). Polled at the party screen's own
 * cadence while it is mounted, like its member list: the other member starting or stopping a post,
 * and a stranger taking the seat, happen on other phones. A party push, a resume or Matches
 * gaining focus refresh it sooner (refreshParties).
 */
export function usePartyCall(partyId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: partyCallQueryKey(partyId),
    queryFn: async (): Promise<PartyCallRead> => {
      const { data, error } = await supabase.rpc(PARTY_LFG_RPC.get, { p_party_id: partyId });
      if (error) {
        if (isPartyLfgUnavailable(error)) return { available: false };
        throw error;
      }
      return { available: true, call: ((data ?? []) as PartyCallRow[])[0] ?? null };
    },
    enabled: enabled && !!partyId,
    refetchInterval: PARTY_POLL_MS,
  });
}

/**
 * Start (or reuse) the party's post: start_party_call. Two members tapping at once, or the second
 * member sharing after the first, get the same live row (`already_live`). The first new post also
 * writes a note into the party chat from the sharer, server side, so the other member is told.
 */
export function useStartPartyCall(partyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<StartedPartyCall> => {
      const { data, error } = await supabase.rpc(PARTY_LFG_RPC.start, { p_party_id: partyId });
      if (error) throw error;
      const row = ((data ?? []) as StartedPartyCall[])[0];
      if (!row) throw new Error("start_party_call returned no row");
      return row;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: partyCallQueryKey(partyId) });
    },
  });
}

/** Stop the post (end_party_call): either member, idempotent. Its code stops working at once. */
export function useEndPartyCall(partyId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc(PARTY_LFG_RPC.end, { p_party_id: partyId });
      if (error) throw error;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: partyCallQueryKey(partyId) });
    },
  });
}

/** A code no party can have (all zeros), asked only to learn whether 0089 is there at all. */
const PROBE_CODE = "0000000000";

/**
 * Whether the server has the party LFG post (0089) and it is switched on: one read of
 * resolve_party_code with a code that cannot exist, kept for 10 minutes. False on PGRST202 (not
 * live), 42501 (the kill switch) and on any failure, so Matches > "Have a party code?" only shows
 * when a code could work; before 0089 Matches is exactly build 19's.
 */
export function usePartyLfgAvailable(): boolean {
  const query = useQuery({
    queryKey: ["party-lfg-available"],
    queryFn: async (): Promise<boolean> => {
      const { error } = await supabase.rpc(PARTY_LFG_RPC.resolve, { p_code: PROBE_CODE });
      return !error;
    },
    staleTime: 10 * 60_000,
    retry: false,
  });
  return query.data === true;
}

/**
 * The party behind a code, for the arrival screen (preview_party_code): its members with their
 * ages while live and this player may join, otherwise why not. Read-only and side-effect free on
 * the server, so a player who looks and walks away holds nothing.
 */
export function usePreviewPartyCode(code: string | null) {
  return useQuery({
    queryKey: ["party-code-preview", code],
    queryFn: async (): Promise<PartyCodePreviewRow[]> => {
      const { data, error } = await supabase.rpc(PARTY_LFG_RPC.preview, { p_code: code });
      if (error) throw error;
      return (data ?? []) as PartyCodePreviewRow[];
    },
    enabled: !!code,
    staleTime: 0,
    retry: 1,
  });
}

/**
 * Take the party's last seat (join_party_by_code): one atomic step under the party's lock, which
 * adds the member, fills the post, declines the party's other pending invites and tells the
 * members. Every refusal is a row (full, ended, unavailable); only the rate limit, a ban, a
 * not-onboarded profile or the network throw.
 */
export function useJoinPartyByCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<PartyJoinRow | null> => {
      const { data, error } = await supabase.rpc(PARTY_LFG_RPC.join, { p_code: code });
      if (error) throw error;
      return ((data ?? []) as PartyJoinRow[])[0] ?? null;
    },
    onSuccess: (row) => {
      void queryClient.invalidateQueries({ queryKey: MY_PARTIES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PARTY_INVITES_QUERY_KEY });
      if (row?.party_id) void queryClient.invalidateQueries({ queryKey: partyMembersQueryKey(row.party_id.toLowerCase()) });
    },
  });
}
