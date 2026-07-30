import { useQuery } from "@tanstack/react-query";
import type { Platform, PlaystyleTag, SkillLevel } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export interface EditableGame {
  gameId: string;
  name: string;
  skillLevel: SkillLevel;
  rankText: string;
}

export interface EditableShow {
  showId: string;
  name: string;
}

export interface EditableProfileDetails {
  games: EditableGame[];
  shows: EditableShow[];
  platforms: Platform[];
  playstyles: PlaystyleTag[];
}

async function fetchEditableProfileDetails(profileId: string): Promise<EditableProfileDetails> {
  const [gamesRes, showsRes, platformsRes, playstylesRes] = await Promise.all([
    supabase
      .from("profile_games")
      .select("game_id, skill_level, rank_text, priority")
      .eq("profile_id", profileId)
      .order("priority"),
    supabase.from("profile_shows").select("show_id, priority").eq("profile_id", profileId).order("priority"),
    supabase.from("profile_platforms").select("platform").eq("profile_id", profileId),
    supabase.from("profile_playstyles").select("tag").eq("profile_id", profileId),
  ]);
  for (const res of [gamesRes, showsRes, platformsRes, playstylesRes]) {
    if (res.error) throw res.error;
  }

  const gameRows = gamesRes.data ?? [];
  const showRows = showsRes.data ?? [];

  const [gameNamesRes, showNamesRes] = await Promise.all([
    gameRows.length > 0
      ? supabase
          .from("games")
          .select("id, name")
          .in(
            "id",
            gameRows.map((r) => r.game_id as string),
          )
      : Promise.resolve({ data: [], error: null }),
    showRows.length > 0
      ? supabase
          .from("shows")
          .select("id, name")
          .in(
            "id",
            showRows.map((r) => r.show_id as string),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (gameNamesRes.error) throw gameNamesRes.error;
  if (showNamesRes.error) throw showNamesRes.error;

  const gameNameById = new Map((gameNamesRes.data ?? []).map((g) => [g.id as string, g.name as string]));
  const showNameById = new Map((showNamesRes.data ?? []).map((s) => [s.id as string, s.name as string]));

  return {
    games: gameRows.map((r) => ({
      gameId: r.game_id as string,
      name: gameNameById.get(r.game_id as string) ?? "Unknown game",
      skillLevel: r.skill_level as SkillLevel,
      rankText: (r.rank_text as string | null) ?? "",
    })),
    shows: showRows.map((r) => ({
      showId: r.show_id as string,
      name: showNameById.get(r.show_id as string) ?? "Unknown show",
    })),
    platforms: (platformsRes.data ?? []).map((p) => p.platform as Platform),
    playstyles: (playstylesRes.data ?? []).map((p) => p.tag as PlaystyleTag),
  };
}

export function useEditableProfileDetails(profileId: string | undefined) {
  return useQuery({
    queryKey: ["editable-profile-details", profileId],
    queryFn: () => fetchEditableProfileDetails(profileId!),
    enabled: !!profileId,
  });
}
