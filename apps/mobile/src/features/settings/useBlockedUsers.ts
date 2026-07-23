import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export interface BlockedUser {
  blocked_id: string;
  display_name: string;
}

const BLOCKED_USERS_QUERY_KEY = ["blocked-users"] as const;

export function useBlockedUsers() {
  return useQuery({
    queryKey: BLOCKED_USERS_QUERY_KEY,
    queryFn: async (): Promise<BlockedUser[]> => {
      const { data, error } = await supabase.rpc("get_blocked_users");
      if (error) throw error;
      return (data ?? []) as BlockedUser[];
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await supabase.from("blocks").delete().eq("blocked_id", blockedId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: BLOCKED_USERS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["deck"] });
    },
  });
}
