import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { notificationSettingsQueryKey, useNotificationSettings } from "@/features/settings/useNotificationSettings";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

import { readQueuePop } from "./duoPopsOptIn";

/**
 * The Duo Pops setting (`notification_settings.queue_pop`), read from the one settings cache the
 * Settings screen also uses. `queuePop` is undefined until the row has loaded AND the column
 * exists (0085), which hides the opt-in card instead of guessing.
 *
 * `enable()` writes it directly rather than through the Settings screen's optimistic update,
 * because the card needs its own failure line ("Couldn't turn on Duo Pops...") and must not claim
 * "Duo Pops are on." for a write that changed nothing: the update asks for the row back, and no
 * row (a profile with no settings row) is a failure.
 */
export function useDuoPopsSetting() {
  const { settings } = useNotificationSettings();
  const profileId = useSessionStore((s) => s.session?.user.id);
  const queryClient = useQueryClient();

  const enable = useCallback(async () => {
    if (!profileId) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("notification_settings")
      .update({ queue_pop: true })
      .eq("profile_id", profileId)
      .select("profile_id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No notification settings row to update");
    await queryClient.invalidateQueries({ queryKey: notificationSettingsQueryKey(profileId) });
  }, [profileId, queryClient]);

  return { queuePop: readQueuePop(settings), enable };
}
