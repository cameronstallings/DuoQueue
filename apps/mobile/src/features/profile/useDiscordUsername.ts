import { useMutation } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/store/session-store";

/**
 * Saves (or, with null, removes) the signed-in player's Discord username, then re-reads the
 * profile so every screen that shows it (Connections, the chat's Discord chip and menu, the
 * player's own share bubble) updates at once.
 *
 * No server change was needed: `authenticated` already has column UPDATE on
 * `profiles.discord_username`, RLS limits it to the player's own row, and 0049's
 * `discord_username_format` check is the same rule as `discordUsernameSchema`. Validate with
 * `parseDiscordInput` before calling this; a check violation still comes back as 23514 and
 * `discordSaveErrorMessage` explains it.
 */
export function useSaveDiscordUsername() {
  return useMutation({
    mutationFn: async (value: string | null) => {
      const profileId = useSessionStore.getState().session?.user.id;
      if (!profileId) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update({ discord_username: value }).eq("id", profileId);
      if (error) throw error;
      await useSessionStore.getState().refreshProfile();
    },
  });
}
