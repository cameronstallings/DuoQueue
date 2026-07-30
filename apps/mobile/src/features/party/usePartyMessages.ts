import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PartyMessageRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

function partyMessagesQueryKey(partyId: string) {
  return ["party-messages", partyId] as const;
}

export function usePartyMessages(partyId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = partyMessagesQueryKey(partyId ?? "");

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_messages")
        .select("*")
        .eq("party_id", partyId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as PartyMessageRow[];
    },
    enabled: !!partyId,
  });

  useEffect(() => {
    if (!partyId) return;

    const channel = supabase
      .channel(`party-chat:${partyId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "party_messages", filter: `party_id=eq.${partyId}` },
        (payload) => {
          queryClient.setQueryData<PartyMessageRow[]>(partyMessagesQueryKey(partyId), (old) =>
            old ? [...old, payload.new as PartyMessageRow] : [payload.new as PartyMessageRow],
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [partyId, queryClient]);

  return { messages: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

export function useSendPartyMessage(partyId: string | undefined) {
  return useMutation({
    mutationFn: async (content: string) => {
      if (!partyId) throw new Error("No party loaded.");
      const { error } = await supabase.rpc("send_party_message", { p_party_id: partyId, p_content: content });
      if (error) throw error;
    },
  });
}
