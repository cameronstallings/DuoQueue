import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MessageRow, SendMessageResponse } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

import { chatQueryKey, type ChatData } from "./useChatMessages";
import { MATCHES_QUERY_KEY } from "./useMatches";

export class ConversationLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationLockedError";
  }
}

function makeTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface SendMessageContext {
  tempId: string | null;
}

/**
 * Sending used to be silent on the client: the mutation only invalidated the matches
 * list, so the message the sender just sent didn't show up in their own chat until the
 * Realtime INSERT event round-tripped back — which, whenever the socket had gone idle,
 * only happens on Realtime's own heartbeat-driven reconnect cycle (~25-30s default).
 * That's the "30 seconds before it pops up" complaint. Fix: append an optimistic row to
 * the chat cache immediately (onMutate), then reconcile it with the server row on
 * success/failure. useChatMessages' Realtime handler dedupes by id, so the event that
 * echoes back for this same send (Realtime broadcasts to every participant, sender
 * included) never doubles it up.
 */
export function useSendMessage(matchId: string) {
  const queryClient = useQueryClient();
  const myId = useSessionStore((s) => s.session?.user.id);
  const queryKey = chatQueryKey(matchId);

  return useMutation<MessageRow | undefined, Error, string, SendMessageContext>({
    mutationFn: async (content: string) => {
      const { data, error } = await supabase.functions.invoke<SendMessageResponse>("send-message", {
        body: { matchId, content },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === "conversation_locked") {
          throw new ConversationLockedError(data.details ?? "This conversation is locked.");
        }
        throw new Error(data.details ?? data.error);
      }
      return data?.message;
    },
    onMutate: async (content: string) => {
      if (!myId) return { tempId: null };

      const tempId = makeTempId();
      const optimisticMessage: MessageRow = {
        id: tempId,
        match_id: matchId,
        sender_id: myId,
        content,
        is_flagged: false,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ChatData>(queryKey, (old) =>
        old
          ? { ...old, messages: [...old.messages, optimisticMessage] }
          : { messages: [optimisticMessage], shares: [] },
      );

      return { tempId };
    },
    onSuccess: (message, _content, context) => {
      if (context?.tempId) {
        queryClient.setQueryData<ChatData>(queryKey, (old) => {
          if (!old) return old;
          const withoutTemp = old.messages.filter((m) => m.id !== context.tempId);
          if (!message) return { ...old, messages: withoutTemp };
          // The Realtime echo for this same insert may have already landed and added
          // the real row — don't duplicate it.
          const withoutDupe = withoutTemp.filter((m) => m.id !== message.id);
          return { ...old, messages: [...withoutDupe, message] };
        });
      }
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    },
    onError: (_err, _content, context) => {
      if (context?.tempId) {
        queryClient.setQueryData<ChatData>(queryKey, (old) =>
          old ? { ...old, messages: old.messages.filter((m) => m.id !== context.tempId) } : old,
        );
      }
    },
  });
}
