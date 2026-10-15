import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { PartyInviteSummary, PartyMemberRow, PartySummary } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

/**
 * A party is the duo who started it plus the one person they found together, so it holds
 * three. `PARTY_CAP` in 0070_party_invites_cap_and_pushes.sql is the rule; this copy only decides
 * what the app draws (a full party opens its chat instead of a deck with nobody left to invite).
 */
export const PARTY_CAP = 3;

/** How long an unanswered invite stays open. `INVITE_TTL` in 0070, which a daily job enforces. */
export const PARTY_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** How often the party lists re-read themselves while on screen: the match list's cadence. */
export const PARTY_POLL_MS = 15_000;

export const PARTY_INVITES_QUERY_KEY = ["party-invites"] as const;
export const MY_PARTIES_QUERY_KEY = ["my-parties"] as const;
/** The prefix of every party's member list, for refreshing them all at once. */
const PARTY_MEMBERS_KEY = "party-members";
/** The prefix of every party's "Waiting on" list. */
const PARTY_PENDING_INVITES_KEY = "party-pending-invites";

export function partyMembersQueryKey(partyId: string) {
  return [PARTY_MEMBERS_KEY, partyId] as const;
}

export function partyPendingInvitesQueryKey(partyId: string) {
  return [PARTY_PENDING_INVITES_KEY, partyId] as const;
}

/**
 * Re-reads everything the app draws about parties that is on screen right now: the invites
 * banner, "Your parties", each party's member list and its "Waiting on" line. Invalidating only
 * refetches what is mounted; the rest is marked stale and reads fresh when it next mounts.
 *
 * One function for every moment a party can have changed without this phone being told by a
 * query: the app coming back to the front, the Matches tab gaining focus or being pulled, and a
 * party push landing while the app is open. They all mean the same thing, so they all do this.
 */
export function refreshParties(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: PARTY_INVITES_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: MY_PARTIES_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: [PARTY_MEMBERS_KEY] }),
    queryClient.invalidateQueries({ queryKey: [PARTY_PENDING_INVITES_KEY] }),
  ]).then(() => undefined);
}

export interface PartyMemberProfile {
  profile_id: string;
  display_name: string;
  age: number;
}

export interface PartyMembers {
  /**
   * Every member's id, visible or not. The COUNT of a party comes from here, never from
   * `profiles`: `public_profiles` hides a member who paused their account or whom the viewer
   * blocked, and a full party counted from what is visible would reopen its deck.
   */
  ids: string[];
  /** The members `public_profiles` shows this viewer, for names. */
  profiles: PartyMemberProfile[];
}

export function useCreateParty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { data, error } = await supabase.rpc("create_party", { p_match_id: matchId });
      if (error) throw error;
      return data as string;
    },
    // A new party belongs in "Your parties" the moment the creator backs out to Matches, not
    // a poll later.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_PARTIES_QUERY_KEY });
    },
  });
}

export function usePartyMembers(partyId: string | undefined, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: partyMembersQueryKey(partyId ?? ""),
    queryFn: async (): Promise<PartyMembers> => {
      const { data: members, error } = await supabase
        .from("party_members")
        .select("profile_id")
        .eq("party_id", partyId);
      if (error) throw error;
      const ids = (members ?? []).map((m: Pick<PartyMemberRow, "profile_id">) => m.profile_id);
      if (ids.length === 0) return { ids, profiles: [] };
      const { data: profiles, error: profilesError } = await supabase
        .from("public_profiles")
        .select("id, display_name, age")
        .in("id", ids);
      if (profilesError) throw profilesError;
      return {
        ids,
        profiles: (profiles ?? []).map(
          (p) => ({ profile_id: p.id, display_name: p.display_name, age: p.age }) as PartyMemberProfile,
        ),
      };
    },
    enabled: !!partyId,
    refetchInterval: options?.refetchInterval,
  });
}

/** Somebody the party has invited and is waiting on. */
export interface PendingPartyInvite {
  target_id: string;
  display_name: string;
}

/**
 * The people this party has invited who have not answered yet, for the deck's "Waiting on"
 * line. Members can read their party's invites (`party_invites_select_member_or_target`).
 *
 * The age cut mirrors the server's 7-day expiry, which a daily job applies: between two runs an
 * invite can still say pending for most of a day after it stopped being answerable, and "waiting
 * on" somebody who can no longer say yes is a promise the party cannot keep.
 */
export function usePartyPendingInvites(partyId: string | undefined) {
  return useQuery({
    queryKey: partyPendingInvitesQueryKey(partyId ?? ""),
    queryFn: async (): Promise<PendingPartyInvite[]> => {
      const openSince = new Date(Date.now() - PARTY_INVITE_TTL_MS).toISOString();
      const { data: invites, error } = await supabase
        .from("party_invites")
        .select("target_id")
        .eq("party_id", partyId)
        .eq("status", "pending")
        .gt("created_at", openSince)
        .order("created_at");
      if (error) throw error;
      const ids = (invites ?? []).map((i: { target_id: string }) => i.target_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from("public_profiles")
        .select("id, display_name")
        .in("id", ids);
      if (profilesError) throw profilesError;
      const nameById = new Map((profiles ?? []).map((p: { id: string; display_name: string }) => [p.id, p.display_name]));
      // In the order they were invited. Somebody the viewer cannot see is left out rather than
      // named "Someone": there is nothing the party can do about them anyway.
      return ids.flatMap((id) => {
        const name = nameById.get(id);
        return name ? [{ target_id: id, display_name: name }] : [];
      });
    },
    enabled: !!partyId,
    refetchInterval: PARTY_POLL_MS,
  });
}

/** `enabled` (default true) is for the Matches tab badge, mounted in the tab layout, which must
 * not call the RPC while signed out or mid-signup. */
export function usePartyInvites(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: PARTY_INVITES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_party_invites");
      if (error) throw error;
      return (data ?? []) as PartyInviteSummary[];
    },
    // An invite is somebody waiting on this person, and it expires. Polled like the match list
    // while the banner is mounted; the other refresh moments are in `refreshParties`.
    refetchInterval: PARTY_POLL_MS,
    enabled: options?.enabled ?? true,
  });
}

export function useRespondPartyInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inviteId, accept }: { inviteId: string; partyId: string; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_party_invite", { p_invite_id: inviteId, p_accept: accept });
      if (error) throw error;
    },
    onSuccess: (_data, { partyId }) => {
      void queryClient.invalidateQueries({ queryKey: PARTY_INVITES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: MY_PARTIES_QUERY_KEY });
      // The cached member list was read through the invited-target policy, before this person
      // was in it. The party chat they are about to open names senders from it.
      void queryClient.invalidateQueries({ queryKey: partyMembersQueryKey(partyId) });
    },
    onError: () => {
      // A refused invite (expired, party full, already answered, its party gone) is dead. The
      // banner says why (see `partyInviteErrorMessage`); refetching makes the card go away
      // instead of staying tappable forever.
      void queryClient.invalidateQueries({ queryKey: PARTY_INVITES_QUERY_KEY });
    },
  });
}

/** Exported for `useNotificationTapRouting`, which asks this list whether a tapped party push's
 * party is still this account's before it opens the party (see `partyPush` in
 * notificationRouting.ts). */
export async function fetchMyParties(): Promise<PartySummary[]> {
  const { data, error } = await supabase.rpc("get_my_parties");
  if (error) throw error;
  return (data ?? []) as PartySummary[];
}

/** Parties the caller already belongs to (see `get_my_parties`, 0026_parties.sql) —
 * previously dead: the RPC existed and was granted but nothing in the app called it, so
 * there was no way back into a party once you navigated away from it. */
export function useMyParties() {
  return useQuery({
    queryKey: MY_PARTIES_QUERY_KEY,
    queryFn: fetchMyParties,
    refetchInterval: PARTY_POLL_MS,
  });
}
