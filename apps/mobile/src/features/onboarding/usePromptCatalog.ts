import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export interface PromptCatalogItem {
  id: string;
  question: string;
}

export function usePromptCatalog() {
  return useQuery({
    queryKey: ["prompt-catalog"],
    queryFn: async (): Promise<PromptCatalogItem[]> => {
      const { data, error } = await supabase.from("prompts").select("id, question").order("question");
      if (error) throw error;
      return (data ?? []) as PromptCatalogItem[];
    },
    staleTime: Infinity,
  });
}
