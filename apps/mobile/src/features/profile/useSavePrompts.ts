import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PROMPT_COUNT } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export interface PromptSlot {
  promptId: string;
  question: string;
  answer: string;
}

export function useSavePrompts(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slots: (PromptSlot | null)[]) => {
      if (!profileId) throw new Error("No profile loaded.");
      if (slots.filter((s) => s).length !== PROMPT_COUNT) {
        throw new Error(`Answer exactly ${PROMPT_COUNT} prompts.`);
      }

      const { error: deleteError } = await supabase.from("profile_prompts").delete().eq("profile_id", profileId);
      if (deleteError) throw deleteError;

      const rows = slots.flatMap((slot, position) =>
        slot ? [{ profile_id: profileId, prompt_id: slot.promptId, answer: slot.answer, position }] : [],
      );
      const { error: insertError } = await supabase.from("profile_prompts").insert(rows);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["own-prompts", profileId] });
    },
  });
}
