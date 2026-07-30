import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Platform, PlaystyleTag, SkillLevel } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export interface SaveProfileDetailsInput {
  games: { gameId: string; skillLevel: SkillLevel; rankText: string }[];
  shows: { showId: string }[];
  platforms: Platform[];
  playstyles: PlaystyleTag[];
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
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["editable-profile-details", profileId] });
      void queryClient.invalidateQueries({ queryKey: ["own-profile-details", profileId] });
    },
  });
}
