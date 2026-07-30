import type { DeckCandidate, PhotoRole, Platform, SkillLevel, TiltHandling } from "@duoqueue/shared-types";

import { formatPlayWindow } from "@/features/onboarding/profile-labels";
import { supabase } from "@/lib/supabase";
import { signPhotoUrls } from "@/lib/storage";

import type { DeckCard } from "./types";

interface PublicProfileMediaRow {
  profile_id: string;
  storage_path: string;
  photo_role: PhotoRole;
}
interface PublicProfileGameRow {
  profile_id: string;
  game_name: string;
  skill_level: SkillLevel;
  priority: number;
}
interface PublicProfileShowRow {
  profile_id: string;
  show_name: string;
  priority: number;
}
interface PublicProfilePlatformRow {
  profile_id: string;
  platform: Platform;
}
interface PublicProfileLanguageRow {
  profile_id: string;
  language_code: string;
}
interface PublicProfilePlaystyleRow {
  profile_id: string;
  tag: string;
}
interface PublicProfilePromptRow {
  profile_id: string;
  position: number;
  question: string;
  answer: string;
}
interface PublicProfileActivityRow {
  profile_id: string;
  is_recently_active: boolean;
}
interface PublicProfileVibeRow {
  profile_id: string;
  intensity: number;
  comms_style: number;
  coaching_pref: number;
  tilt_handling: TiltHandling;
}
interface PublicProfileScheduleRow {
  profile_id: string;
  usual_play_start_hour: number | null;
  usual_play_end_hour: number | null;
}

/** Fetches the shared per-profile detail (photos/games/shows/prompts/etc.) for a set of
 * candidate rows and joins them client-side — used by both the main deck and Standouts,
 * which differ only in which RPC produced the base candidate rows. */
export async function enrichCandidates(rows: DeckCandidate[]): Promise<DeckCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((c) => c.profile_id);

  const [mediaRes, gamesRes, showsRes, platformsRes, languagesRes, playstylesRes, promptsRes, activityRes, vibeRes, scheduleRes] =
    await Promise.all([
      supabase.from("public_profile_media").select("*").in("profile_id", ids),
      supabase.from("public_profile_games").select("*").in("profile_id", ids).order("priority"),
      supabase.from("public_profile_shows").select("*").in("profile_id", ids).order("priority"),
      supabase.from("public_profile_platforms").select("*").in("profile_id", ids),
      supabase.from("public_profile_languages").select("*").in("profile_id", ids),
      supabase.from("public_profile_playstyles").select("*").in("profile_id", ids),
      supabase.from("public_profile_prompts").select("*").in("profile_id", ids).order("position"),
      supabase.from("public_profile_activity").select("*").in("profile_id", ids),
      supabase.from("public_profile_vibe").select("*").in("profile_id", ids),
      supabase.from("public_profile_schedule").select("*").in("profile_id", ids),
    ]);
  for (const res of [
    mediaRes,
    gamesRes,
    showsRes,
    platformsRes,
    languagesRes,
    playstylesRes,
    promptsRes,
    activityRes,
    vibeRes,
    scheduleRes,
  ]) {
    if (res.error) throw res.error;
  }

  const media = (mediaRes.data ?? []) as PublicProfileMediaRow[];
  const games = (gamesRes.data ?? []) as PublicProfileGameRow[];
  const shows = (showsRes.data ?? []) as PublicProfileShowRow[];
  const platforms = (platformsRes.data ?? []) as PublicProfilePlatformRow[];
  const languages = (languagesRes.data ?? []) as PublicProfileLanguageRow[];
  const playstyles = (playstylesRes.data ?? []) as PublicProfilePlaystyleRow[];
  const prompts = (promptsRes.data ?? []) as PublicProfilePromptRow[];
  const activity = (activityRes.data ?? []) as PublicProfileActivityRow[];
  const vibes = (vibeRes.data ?? []) as PublicProfileVibeRow[];
  const schedules = (scheduleRes.data ?? []) as PublicProfileScheduleRow[];

  const signedUrls = await signPhotoUrls(media.map((m) => m.storage_path));

  return rows.map((candidate) => {
    const ownMedia = media.filter((m) => m.profile_id === candidate.profile_id);
    const profilePhotoUrl = ownMedia.find((m) => m.photo_role === "profile");
    const headerPhotoUrl = ownMedia.find((m) => m.photo_role === "header");

    const topGames = games
      .filter((g) => g.profile_id === candidate.profile_id)
      .slice(0, 3)
      .map((g) => ({ name: g.game_name, skillLevel: g.skill_level }));

    const topShows = shows
      .filter((s) => s.profile_id === candidate.profile_id)
      .slice(0, 3)
      .map((s) => s.show_name);

    const cardPrompts = prompts
      .filter((p) => p.profile_id === candidate.profile_id)
      .sort((a, b) => a.position - b.position)
      .map((p) => ({ question: p.question, answer: p.answer }));

    return {
      ...candidate,
      profilePhotoUrl: profilePhotoUrl ? (signedUrls.get(profilePhotoUrl.storage_path) ?? null) : null,
      headerPhotoUrl: headerPhotoUrl ? (signedUrls.get(headerPhotoUrl.storage_path) ?? null) : null,
      topGames,
      topShows,
      prompts: cardPrompts,
      platforms: platforms.filter((p) => p.profile_id === candidate.profile_id).map((p) => p.platform),
      languages: languages
        .filter((l) => l.profile_id === candidate.profile_id)
        .map((l) => l.language_code),
      playstyles: playstyles.filter((p) => p.profile_id === candidate.profile_id).map((p) => p.tag),
      isRecentlyActive: activity.find((a) => a.profile_id === candidate.profile_id)?.is_recently_active ?? false,
      vibe: (() => {
        const v = vibes.find((row) => row.profile_id === candidate.profile_id);
        return v
          ? { intensity: v.intensity, commsStyle: v.comms_style, coachingPref: v.coaching_pref, tiltHandling: v.tilt_handling }
          : null;
      })(),
      playWindowLabel: (() => {
        const s = schedules.find((row) => row.profile_id === candidate.profile_id);
        return s ? formatPlayWindow(s.usual_play_start_hour, s.usual_play_end_hour) : null;
      })(),
    };
  });
}
