import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SendMessageResponse } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

import { MATCHES_QUERY_KEY } from "./useMatches";

export class ConversationLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationLockedError";
  }
}

export function useSendMessage(matchId: string) {
  const queryClient = useQueryClient();

  return useMutation({
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MATCHES_QUERY_KEY });
    },
  });
}
