import { useQuery } from "@tanstack/react-query";
import type { Platform, PlaystyleTag, SkillLevel, TiltHandling } from "@duoqueue/shared-types";

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

export interface EditableVibe {
  intensity: number;
  commsStyle: number;
  coachingPref: number;
  tiltHandling: TiltHandling;
}

export interface EditablePlayWindow {
  startHour: number | null;
  endHour: number | null;
}

export interface EditableProfileDetails {
  games: EditableGame[];
  shows: EditableShow[];
  platforms: Platform[];
  playstyles: PlaystyleTag[];
  vibe: EditableVibe;
  playWindow: EditablePlayWindow;
}

async function fetchEditableProfileDetails(profileId: string): Promise<EditableProfileDetails> {
  const [gamesRes, showsRes, platformsRes, playstylesRes, vibeRes, profileRes] = await Promise.all([
    supabase
      .from("profile_games")
      .select("game_id, skill_level, rank_text, priority")
      .eq("profile_id", profileId)
      .order("priority"),
    supabase.from("profile_shows").select("show_id, priority").eq("profile_id", profileId).order("priority"),
    supabase.from("profile_platforms").select("platform").eq("profile_id", profileId),
    supabase.from("profile_playstyles").select("tag").eq("profile_id", profileId),
    supabase
      .from("profile_vibe")
      .select("intensity, comms_style, coaching_pref, tilt_handling")
      .eq("profile_id", profileId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("usual_play_start_hour, usual_play_end_hour")
      .eq("id", profileId)
      .maybeSingle(),
  ]);
  for (const res of [gamesRes, showsRes, platformsRes, playstylesRes, vibeRes, profileRes]) {
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
    vibe: {
      intensity: (vibeRes.data?.intensity as number | undefined) ?? 50,
      commsStyle: (vibeRes.data?.comms_style as number | undefined) ?? 50,
      coachingPref: (vibeRes.data?.coaching_pref as number | undefined) ?? 50,
      tiltHandling: (vibeRes.data?.tilt_handling as TiltHandling | undefined) ?? "stays_calm",
    },
    playWindow: {
      startHour: (profileRes.data?.usual_play_start_hour as number | null | undefined) ?? null,
      endHour: (profileRes.data?.usual_play_end_hour as number | null | undefined) ?? null,
    },
  };
}

export function useEditableProfileDetails(profileId: string | undefined) {
  return useQuery({
    queryKey: ["editable-profile-details", profileId],
    queryFn: () => fetchEditableProfileDetails(profileId!),
    enabled: !!profileId,
  });
}
