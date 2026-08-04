import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PartyMessageRow } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

function partyMessagesQueryKey(partyId: string) {
  return ["party-messages", partyId] as const;
}

function makeTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function usePartyMessages(partyId: string | undefined) {
  const queryClient = useQueryClient();
  const myId = useSessionStore((s) => s.session?.user.id);
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
          const incoming = payload.new as PartyMessageRow;
          // Mirrors useChatMessages' own-send reconciliation: the echo for a message
          // I just sent can arrive before useSendPartyMessage's onSuccess does, so
          // dedupe here too — by id first (covers onSuccess winning the race), then
          // by content for my own temp- row (covers the reverse race). Unlike 1:1
          // chat, send_party_message doesn't rewrite content, so content matching is
          // reliable here.
          queryClient.setQueryData<PartyMessageRow[]>(partyMessagesQueryKey(partyId), (old) => {
            if (!old) return [incoming];
            if (old.some((m) => m.id === incoming.id)) return old;

            let messages = old;
            if (myId && incoming.sender_id === myId) {
              const tempIndex = messages.findIndex(
                (m) => m.id.startsWith("temp-") && m.content === incoming.content,
              );
              if (tempIndex !== -1) {
                messages = [...messages.slice(0, tempIndex), ...messages.slice(tempIndex + 1)];
              }
            }

            return [...messages, incoming];
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [partyId, queryClient, myId]);

  return { messages: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

interface SendPartyMessageContext {
  tempId: string | null;
}

/**
 * Compact version of useSendMessage's optimistic-send pattern (see that file for the
 * full "30 seconds before it pops up" writeup): append a temp row in onMutate so the
 * sender sees their own message immediately, reconcile it with the RPC's returned row
 * (send_party_message already `returns public.party_messages`) on success, and drop it
 * on failure so a rejected send never strands a phantom bubble.
 */
export function useSendPartyMessage(partyId: string | undefined) {
  const queryClient = useQueryClient();
  const myId = useSessionStore((s) => s.session?.user.id);
  const queryKey = partyMessagesQueryKey(partyId ?? "");

  return useMutation<PartyMessageRow, Error, string, SendPartyMessageContext>({
    mutationFn: async (content: string) => {
      if (!partyId) throw new Error("No party loaded.");
      const { data, error } = await supabase.rpc("send_party_message", {
        p_party_id: partyId,
        p_content: content,
      });
      if (error) throw error;
      return data as PartyMessageRow;
    },
    onMutate: async (content: string) => {
      if (!myId || !partyId) return { tempId: null };

      const existing = queryClient.getQueryData<PartyMessageRow[]>(queryKey);
      if (!existing) return { tempId: null };

      const tempId = makeTempId();
      const optimisticMessage: PartyMessageRow = {
        id: tempId,
        party_id: partyId,
        sender_id: myId,
        content,
        created_at: new Date().toISOString(),
      };

      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<PartyMessageRow[]>(queryKey, (old) =>
        old ? [...old, optimisticMessage] : [optimisticMessage],
      );

      return { tempId };
    },
    onSuccess: (message, _content, context) => {
      if (!context?.tempId) {
        void queryClient.invalidateQueries({ queryKey });
        return;
      }
      queryClient.setQueryData<PartyMessageRow[]>(queryKey, (old) => {
        if (!old) return old;
        const withoutTemp = old.filter((m) => m.id !== context.tempId);
        // The Realtime echo may have already landed and added the real row.
        const withoutDupe = withoutTemp.filter((m) => m.id !== message.id);
        return [...withoutDupe, message];
      });
    },
    onError: (_err, _content, context) => {
      if (!context?.tempId) return;
      queryClient.setQueryData<PartyMessageRow[]>(queryKey, (old) =>
        old ? old.filter((m) => m.id !== context.tempId) : old,
      );
    },
  });
}
