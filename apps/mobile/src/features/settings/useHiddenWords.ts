import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HIDDEN_WORD_MAX_LENGTH } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

const HIDDEN_WORDS_QUERY_KEY = ["hidden-words"] as const;

export function useHiddenWords() {
  return useQuery({
    queryKey: HIDDEN_WORDS_QUERY_KEY,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from("hidden_words").select("word").order("created_at");
      if (error) throw error;
      return (data ?? []).map((row) => row.word as string);
    },
  });
}

export function useAddHiddenWord() {
  const profileId = useSessionStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (word: string) => {
      if (!profileId) throw new Error("Not authenticated");
      const trimmed = word.trim().toLowerCase();
      if (!trimmed) return;
      // Mirrors hidden_words.hidden_word_max_length (0049_input_constraints.sql) so a
      // too-long word fails with a clean message here instead of a raw DB error.
      if (trimmed.length > HIDDEN_WORD_MAX_LENGTH) {
        throw new Error(`Hidden words must be ${HIDDEN_WORD_MAX_LENGTH} characters or fewer.`);
      }
      const { error } = await supabase.from("hidden_words").insert({ profile_id: profileId, word: trimmed });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HIDDEN_WORDS_QUERY_KEY });
    },
  });
}

export function useRemoveHiddenWord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (word: string) => {
      const { error } = await supabase.from("hidden_words").delete().eq("word", word);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HIDDEN_WORDS_QUERY_KEY });
    },
  });
}

export function containsHiddenWord(text: string, hiddenWords: string[]): boolean {
  const lower = text.toLowerCase();
  return hiddenWords.some((word) => lower.includes(word));
}
