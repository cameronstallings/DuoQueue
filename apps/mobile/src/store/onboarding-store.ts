import * as base64js from "base64-js";
import * as FileSystem from "expo-file-system/legacy";
import { create } from "zustand";
import type { Gender, LanguageCode, Platform, PlaystyleTag, Region, SkillLevel } from "@duoqueue/shared-types";
import { BIO_MAX_LENGTH } from "@duoqueue/shared-types";

import { supabase } from "@/lib/supabase";

export interface SelectedGame {
  gameId: string;
  name: string;
  skillLevel: SkillLevel;
  rankText: string;
}

export interface SelectedShow {
  showId: string;
  name: string;
}

interface OnboardingState {
  displayName: string;
  photoUris: string[];
  gender: Gender | null;
  region: Region | null;
  languages: LanguageCode[];
  platforms: Platform[];
  games: SelectedGame[];
  shows: SelectedShow[];
  playstyles: PlaystyleTag[];
  bio: string;
  discordUsername: string;
  submitting: boolean;
  submitError: string | null;

  setDisplayName: (value: string) => void;
  setPhotoUris: (uris: string[]) => void;
  setGender: (value: Gender) => void;
  setRegion: (value: Region) => void;
  toggleLanguage: (value: LanguageCode) => void;
  togglePlatform: (value: Platform) => void;
  togglePlaystyle: (value: PlaystyleTag) => void;
  addGame: (game: { gameId: string; name: string }) => void;
  removeGame: (gameId: string) => void;
  updateGameSkill: (gameId: string, skillLevel: SkillLevel) => void;
  updateGameRank: (gameId: string, rankText: string) => void;
  addShow: (show: { showId: string; name: string }) => void;
  removeShow: (showId: string) => void;
  setBio: (value: string) => void;
  setDiscordUsername: (value: string) => void;
  submit: () => Promise<void>;
}

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  displayName: "",
  photoUris: [],
  gender: null,
  region: null,
  languages: [],
  platforms: [],
  games: [],
  shows: [],
  playstyles: [],
  bio: "",
  discordUsername: "",
  submitting: false,
  submitError: null,

  setDisplayName: (value) => set({ displayName: value }),
  setPhotoUris: (uris) => set({ photoUris: uris }),
  setGender: (value) => set({ gender: value }),
  setRegion: (value) => set({ region: value }),
  toggleLanguage: (value) => set((s) => ({ languages: toggleInArray(s.languages, value) })),
  togglePlatform: (value) => set((s) => ({ platforms: toggleInArray(s.platforms, value) })),
  togglePlaystyle: (value) => set((s) => ({ playstyles: toggleInArray(s.playstyles, value) })),

  addGame: (game) =>
    set((s) =>
      s.games.some((g) => g.gameId === game.gameId)
        ? s
        : { games: [...s.games, { ...game, skillLevel: "casual", rankText: "" }] },
    ),
  removeGame: (gameId) => set((s) => ({ games: s.games.filter((g) => g.gameId !== gameId) })),
  updateGameSkill: (gameId, skillLevel) =>
    set((s) => ({ games: s.games.map((g) => (g.gameId === gameId ? { ...g, skillLevel } : g)) })),
  updateGameRank: (gameId, rankText) =>
    set((s) => ({ games: s.games.map((g) => (g.gameId === gameId ? { ...g, rankText } : g)) })),

  addShow: (show) =>
    set((s) => (s.shows.some((sh) => sh.showId === show.showId) ? s : { shows: [...s.shows, show] })),
  removeShow: (showId) => set((s) => ({ shows: s.shows.filter((sh) => sh.showId !== showId) })),

  setBio: (value) => set({ bio: value.slice(0, BIO_MAX_LENGTH) }),
  setDiscordUsername: (value) => set({ discordUsername: value }),

  submit: async () => {
    const state = get();
    set({ submitting: true, submitError: null });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No signed-in user.");
      const profileId = user.id;

      for (const [position, uri] of state.photoUris.entries()) {
        const extension = uri.split(".").pop()?.toLowerCase() ?? "jpg";
        const storagePath = `${profileId}/${Date.now()}-${position}.${extension}`;
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
        const contentType = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";

        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(storagePath, base64js.toByteArray(base64).buffer, { contentType, upsert: true });
        if (uploadError) throw uploadError;

        const { data: mediaRow, error: mediaError } = await supabase
          .from("profile_media")
          .insert({ profile_id: profileId, storage_path: storagePath, position })
          .select("id")
          .single();
        if (mediaError) throw mediaError;

        // Best-effort, non-blocking: a failed moderation check just leaves the photo
        // "pending" (invisible to other users) rather than failing onboarding.
        supabase.functions.invoke("moderate-photo", { body: { mediaId: mediaRow.id } }).catch((err: unknown) => {
          console.warn("moderate-photo invocation failed:", err);
        });
      }

      const tablesToReplace: { table: string; rows: Record<string, unknown>[] }[] = [
        {
          table: "profile_platforms",
          rows: state.platforms.map((platform) => ({ profile_id: profileId, platform })),
        },
        {
          table: "profile_languages",
          rows: state.languages.map((language_code) => ({ profile_id: profileId, language_code })),
        },
        {
          table: "profile_playstyles",
          rows: state.playstyles.map((tag) => ({ profile_id: profileId, tag })),
        },
        {
          table: "profile_games",
          rows: state.games.map((g, i) => ({
            profile_id: profileId,
            game_id: g.gameId,
            skill_level: g.skillLevel,
            rank_text: g.rankText || null,
            priority: i,
          })),
        },
        {
          table: "profile_shows",
          rows: state.shows.map((s, i) => ({ profile_id: profileId, show_id: s.showId, priority: i })),
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

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          display_name: state.displayName,
          gender: state.gender,
          region: state.region,
          bio: state.bio || null,
          discord_username: state.discordUsername || null,
          onboarding_completed: true,
        })
        .eq("id", profileId);
      if (profileError) throw profileError;

      set({ submitting: false });
    } catch (err) {
      set({
        submitting: false,
        submitError: err instanceof Error ? err.message : "Something went wrong finishing your profile.",
      });
      throw err;
    }
  },
}));
