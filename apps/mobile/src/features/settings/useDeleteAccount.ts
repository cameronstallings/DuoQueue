import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        "delete-account",
        { body: {} },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
  });
}
