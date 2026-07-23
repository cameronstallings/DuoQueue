import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

export function usePrivacyToggles() {
  const profile = useSessionStore((s) => s.profile);
  const refreshProfile = useSessionStore((s) => s.refreshProfile);

  const setIsActive = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!profile) throw new Error("No profile loaded.");
      const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => void refreshProfile(),
  });

  const setHideLastActive = useMutation({
    mutationFn: async (hideLastActive: boolean) => {
      if (!profile) throw new Error("No profile loaded.");
      const { error } = await supabase
        .from("profiles")
        .update({ hide_last_active: hideLastActive })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => void refreshProfile(),
  });

  return { profile, setIsActive, setHideLastActive };
}
