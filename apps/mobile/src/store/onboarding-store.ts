import { create } from "zustand";
import type { Gender, LanguageCode, Platform, PlaystyleTag, Region, SkillLevel } from "@duoqueue/shared-types";
import { PROMPT_COUNT } from "@duoqueue/shared-types";

import { uploadProfilePhoto } from "@/features/profile/usePhotoUpload";
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

export interface SelectedPrompt {
  promptId: string;
  question: string;
  answer: string;
}

interface OnboardingState {
  displayName: string;
  profilePhotoUri: string | null;
  headerPhotoUri: string | null;
  gender: Gender | null;
  region: Region | null;
  languages: LanguageCode[];
  platforms: Platform[];
  games: SelectedGame[];
  shows: SelectedShow[];
  playstyles: PlaystyleTag[];
  prompts: (SelectedPrompt | null)[];
  discordUsername: string;
  submitting: boolean;
  submitError: string | null;

  setDisplayName: (value: string) => void;
  setProfilePhotoUri: (uri: string | null) => void;
  setHeaderPhotoUri: (uri: string | null) => void;
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
  setPromptAt: (index: number, prompt: { promptId: string; question: string }) => void;
  setPromptAnswerAt: (index: number, answer: string) => void;
  clearPromptAt: (index: number) => void;
  setDiscordUsername: (value: string) => void;
  submit: () => Promise<void>;
}

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  displayName: "",
  profilePhotoUri: null,
  headerPhotoUri: null,
  gender: null,
  region: null,
  languages: [],
  platforms: [],
  games: [],
  shows: [],
  playstyles: [],
  prompts: Array.from({ length: PROMPT_COUNT }, () => null),
  discordUsername: "",
  submitting: false,
  submitError: null,

  setDisplayName: (value) => set({ displayName: value }),
  setProfilePhotoUri: (uri) => set({ profilePhotoUri: uri }),
  setHeaderPhotoUri: (uri) => set({ headerPhotoUri: uri }),
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

  setPromptAt: (index, prompt) =>
    set((s) => ({
      prompts: s.prompts.map((p, i) => (i === index ? { ...prompt, answer: "" } : p)),
    })),
  setPromptAnswerAt: (index, answer) =>
    set((s) => ({
      prompts: s.prompts.map((p, i) => (i === index && p ? { ...p, answer } : p)),
    })),
  clearPromptAt: (index) => set((s) => ({ prompts: s.prompts.map((p, i) => (i === index ? null : p)) })),
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

      if (state.profilePhotoUri) await uploadProfilePhoto(profileId, state.profilePhotoUri, "profile");
      if (state.headerPhotoUri) await uploadProfilePhoto(profileId, state.headerPhotoUri, "header");

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
        {
          table: "profile_prompts",
          rows: state.prompts.flatMap((p, i) =>
            p ? [{ profile_id: profileId, prompt_id: p.promptId, answer: p.answer, position: i }] : [],
          ),
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
