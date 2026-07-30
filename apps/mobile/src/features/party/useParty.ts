import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PartyInviteSummary, PartyMemberRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export interface PartyMemberProfile {
  profile_id: string;
  display_name: string;
  age: number;
}

export function useCreateParty() {
  return useMutation({
    mutationFn: async (matchId: string) => {
      const { data, error } = await supabase.rpc("create_party", { p_match_id: matchId });
      if (error) throw error;
      return data as string;
    },
  });
}

export function usePartyMembers(partyId: string | undefined) {
  return useQuery({
    queryKey: ["party-members", partyId],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("party_members")
        .select("profile_id")
        .eq("party_id", partyId);
      if (error) throw error;
      const ids = (members ?? []).map((m: Pick<PartyMemberRow, "profile_id">) => m.profile_id);
      if (ids.length === 0) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from("public_profiles")
        .select("id, display_name, age")
        .in("id", ids);
      if (profilesError) throw profilesError;
      return (profiles ?? []).map((p) => ({ profile_id: p.id, display_name: p.display_name, age: p.age }) as PartyMemberProfile);
    },
    enabled: !!partyId,
  });
}

export function usePartyInvites() {
  return useQuery({
    queryKey: ["party-invites"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_party_invites");
      if (error) throw error;
      return (data ?? []) as PartyInviteSummary[];
    },
  });
}

export function useRespondPartyInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inviteId, accept }: { inviteId: string; accept: boolean }) => {
      const { error } = await supabase.rpc("respond_party_invite", { p_invite_id: inviteId, p_accept: accept });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["party-invites"] });
    },
  });
}
