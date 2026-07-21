import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DeckCandidate, Platform, SkillLevel } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

import type { DeckCard } from "./types";

const DECK_PAGE_SIZE = 20;
const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

interface PublicProfileMediaRow {
  profile_id: string;
  storage_path: string;
  position: number;
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

async function signPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from("profile-photos")
    .createSignedUrls(paths, PHOTO_SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const map = new Map<string, string>();
  for (const entry of data) {
    if (entry.signedUrl && entry.path) map.set(entry.path, entry.signedUrl);
  }
  return map;
}

async function fetchDeckCards(): Promise<DeckCard[]> {
  const { data: candidates, error: deckError } = await supabase.rpc("get_deck", {
    p_limit: DECK_PAGE_SIZE,
  });
  if (deckError) throw deckError;
  const rows = (candidates ?? []) as DeckCandidate[];
  if (rows.length === 0) return [];

  const ids = rows.map((c) => c.profile_id);

  const [mediaRes, gamesRes, showsRes, platformsRes, languagesRes, playstylesRes] = await Promise.all([
    supabase.from("public_profile_media").select("*").in("profile_id", ids).order("position"),
    supabase.from("public_profile_games").select("*").in("profile_id", ids).order("priority"),
    supabase.from("public_profile_shows").select("*").in("profile_id", ids).order("priority"),
    supabase.from("public_profile_platforms").select("*").in("profile_id", ids),
    supabase.from("public_profile_languages").select("*").in("profile_id", ids),
    supabase.from("public_profile_playstyles").select("*").in("profile_id", ids),
  ]);
  for (const res of [mediaRes, gamesRes, showsRes, platformsRes, languagesRes, playstylesRes]) {
    if (res.error) throw res.error;
  }

  const media = (mediaRes.data ?? []) as PublicProfileMediaRow[];
  const games = (gamesRes.data ?? []) as PublicProfileGameRow[];
  const shows = (showsRes.data ?? []) as PublicProfileShowRow[];
  const platforms = (platformsRes.data ?? []) as PublicProfilePlatformRow[];
  const languages = (languagesRes.data ?? []) as PublicProfileLanguageRow[];
  const playstyles = (playstylesRes.data ?? []) as PublicProfilePlaystyleRow[];

  const signedUrls = await signPhotoUrls(media.map((m) => m.storage_path));

  return rows.map((candidate) => {
    const photoUrls = media
      .filter((m) => m.profile_id === candidate.profile_id)
      .map((m) => signedUrls.get(m.storage_path))
      .filter((url): url is string => !!url);

    const topGames = games
      .filter((g) => g.profile_id === candidate.profile_id)
      .slice(0, 3)
      .map((g) => ({ name: g.game_name, skillLevel: g.skill_level }));

    const topShows = shows
      .filter((s) => s.profile_id === candidate.profile_id)
      .slice(0, 3)
      .map((s) => s.show_name);

    return {
      ...candidate,
      photoUrls,
      topGames,
      topShows,
      platforms: platforms.filter((p) => p.profile_id === candidate.profile_id).map((p) => p.platform),
      languages: languages
        .filter((l) => l.profile_id === candidate.profile_id)
        .map((l) => l.language_code),
      playstyles: playstyles.filter((p) => p.profile_id === candidate.profile_id).map((p) => p.tag),
    };
  });
}

export function useDeck() {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<DeckCard[]>([]);

  const query = useQuery({
    queryKey: ["deck"],
    queryFn: fetchDeckCards,
    staleTime: 0,
  });

  const popTop = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  // Render-time sync (not an effect) so swipes can pop the local queue optimistically
  // without waiting on a refetch — see the useState docs on storing info from previous
  // renders. Guarded by reference equality so it only re-syncs when react-query hands
  // back a genuinely new page (e.g. after popTop's slice(), query.data no longer equals
  // queue but we don't want to re-sync until the underlying query result itself changes).
  const [syncedData, setSyncedData] = useState<DeckCard[] | null>(null);
  if (query.data && query.data !== syncedData) {
    setSyncedData(query.data);
    setQueue(query.data);
  }

  const refetch = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["deck"] });
  }, [queryClient]);

  return {
    cards: queue,
    isLoading: query.isLoading,
    error: query.error,
    popTop,
    refetch,
  };
}
