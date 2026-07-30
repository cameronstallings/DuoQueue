import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Platform, PlaystyleTag, SkillLevel } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";
import type { EditablePlayWindow, EditableVibe } from "./useEditableProfileDetails";

export interface SaveProfileDetailsInput {
  games: { gameId: string; skillLevel: SkillLevel; rankText: string }[];
  shows: { showId: string }[];
  platforms: Platform[];
  playstyles: PlaystyleTag[];
  vibe: EditableVibe;
  playWindow: EditablePlayWindow;
}

export function useSaveProfileDetails(profileId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveProfileDetailsInput) => {
      if (!profileId) throw new Error("No profile loaded.");

      const tablesToReplace: { table: string; rows: Record<string, unknown>[] }[] = [
        {
          table: "profile_games",
          rows: input.games.map((g, i) => ({
            profile_id: profileId,
            game_id: g.gameId,
            skill_level: g.skillLevel,
            rank_text: g.rankText || null,
            priority: i,
          })),
        },
        {
          table: "profile_shows",
          rows: input.shows.map((s, i) => ({ profile_id: profileId, show_id: s.showId, priority: i })),
        },
        {
          table: "profile_platforms",
          rows: input.platforms.map((platform) => ({ profile_id: profileId, platform })),
        },
        {
          table: "profile_playstyles",
          rows: input.playstyles.map((tag) => ({ profile_id: profileId, tag })),
        },
      ];

      for (const { table, rows } of tablesToReplace) {
        const { error: deleteError } = await supabase.from(table).delete().eq("profile_id", profileId);
        if (deleteError) throw deleteError;
        if (rows.length > 0) {
          const { error: insertError } = await supabase.from(table).insert(rows);
          if (insertError) throw insertError;
        }
      }

      const { error: vibeError } = await supabase
        .from("profile_vibe")
        .update({
          intensity: input.vibe.intensity,
          comms_style: input.vibe.commsStyle,
          coaching_pref: input.vibe.coachingPref,
          tilt_handling: input.vibe.tiltHandling,
        })
        .eq("profile_id", profileId);
      if (vibeError) throw vibeError;

      const { error: playWindowError } = await supabase
        .from("profiles")
        .update({
          usual_play_start_hour: input.playWindow.startHour,
          usual_play_end_hour: input.playWindow.endHour,
        })
        .eq("id", profileId);
      if (playWindowError) throw playWindowError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["editable-profile-details", profileId] });
      void queryClient.invalidateQueries({ queryKey: ["own-profile-details", profileId] });
    },
  });
}
