import { useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

/** Reads/writes the "I'm free to duo right now" toggle. The flag lives on the caller's
 * own profile row and self-expires server-side (set_looking_now), so this hook only
 * needs to send the on/off intent and resync the session's cached profile after. */
export function useLookingNow() {
  const profile = useSessionStore((s) => s.profile);
  const refreshProfile = useSessionStore((s) => s.refreshProfile);
  const queryClient = useQueryClient();

  const setLookingNow = useMutation({
    mutationFn: async (looking: boolean) => {
      const { error } = await supabase.rpc("set_looking_now", { p_looking: looking });
      if (error) throw error;
    },
    onSuccess: () => {
      void refreshProfile();
      void queryClient.invalidateQueries({ queryKey: ["online-now"] });
    },
  });

  return {
    isLookingNow: profile?.is_looking_now ?? false,
    setLookingNow,
  };
}
