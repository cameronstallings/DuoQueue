import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export interface OwnPrompt {
  position: number;
  promptId: string;
  question: string;
  answer: string;
}

export function useOwnPrompts(profileId: string | undefined) {
  return useQuery({
    queryKey: ["own-prompts", profileId],
    queryFn: async (): Promise<OwnPrompt[]> => {
      const { data: rows, error } = await supabase
        .from("profile_prompts")
        .select("position, prompt_id, answer")
        .eq("profile_id", profileId as string)
        .order("position");
      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      const { data: catalog, error: catalogError } = await supabase
        .from("prompts")
        .select("id, question")
        .in(
          "id",
          rows.map((r) => r.prompt_id as string),
        );
      if (catalogError) throw catalogError;

      const questionById = new Map((catalog ?? []).map((p) => [p.id as string, p.question as string]));
      return rows.map((r) => ({
        position: r.position as number,
        promptId: r.prompt_id as string,
        answer: r.answer as string,
        question: questionById.get(r.prompt_id as string) ?? "",
      }));
    },
    enabled: !!profileId,
  });
}
