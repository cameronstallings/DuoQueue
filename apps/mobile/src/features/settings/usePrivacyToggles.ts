import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

export function usePrivacyToggles() {
  const profile = useSessionStore((s) => s.profile);
  const refreshProfile = useSessionStore((s) => s.refreshProfile);

  const setIsActive = useMutation({
    mutationFn: async (isActive: boolean) => {
      if (!profile) throw new Error("No profile loaded.");
      const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: (_data, isActive) => {
      void refreshProfile();
      useToastStore.getState().showToast(isActive ? "Profile active again" : "Profile paused");
    },
    onError: () => useToastStore.getState().showToast("Couldn't save. Try again.", "error"),
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
    onSuccess: () => {
      void refreshProfile();
      useToastStore.getState().showToast("Settings saved");
    },
    onError: () => useToastStore.getState().showToast("Couldn't save. Try again.", "error"),
  });

  return { profile, setIsActive, setHideLastActive };
}
