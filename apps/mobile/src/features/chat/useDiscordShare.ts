import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

/** Consent-gated: only resolves to a username if `sharedBy` has an active (non-revoked)
 * share in this match — enforced server-side by get_shared_discord_username, not just
 * hidden client-side. */
export function useSharedDiscordUsername(matchId: string, sharedBy: string, enabled: boolean) {
  return useQuery({
    queryKey: ["shared-discord-username", matchId, sharedBy],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("get_shared_discord_username", {
        p_match_id: matchId,
        p_shared_by: sharedBy,
      });
      if (error) throw error;
      return data as string | null;
    },
    enabled,
  });
}

export function useDiscordShare(matchId: string) {
  const queryClient = useQueryClient();
  const myId = useSessionStore((s) => s.session?.user.id);

  return useMutation({
    mutationFn: async () => {
      if (!myId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("discord_shares")
        .insert({ match_id: matchId, shared_by: myId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["chat-messages", matchId] });
    },
  });
}
