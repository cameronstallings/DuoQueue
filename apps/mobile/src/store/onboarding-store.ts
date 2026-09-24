import { create } from "zustand";
import type {
  Gender,
  LanguageCode,
  LolDivision,
  LolTierChoice,
  Platform,
  PlaystyleTag,
  Region,
  SkillLevel,
} from "@duoqueue/shared-types";
import { PROMPT_COUNT } from "@duoqueue/shared-types";

import { getLeagueGameId } from "@/features/league/leagueGame";
import { type LeagueRankValue, toProfileGameRow, withTypedRankText } from "@/features/league/rankPickerState";
import { displayNameSeed } from "@/features/onboarding/displayNameSeed";
import { uploadProfilePhoto } from "@/features/profile/usePhotoUpload";
import { supabase } from "@/lib/supabase";
import { toUserMessage } from "@/lib/userMessage";

export interface SelectedGame {
  gameId: string;
  name: string;
  skillLevel: SkillLevel;
  /** Free text for every game but League. For League it holds the picked rank's label, or the
   * unparseable legacy text the picker's note shows. See features/league/rankPickerState.ts. */
  rankText: string;
  /** League of Legends only; null on every other game when it is sent (toProfileGameRow). */
  lolTier: LolTierChoice | null;
  lolDivision: LolDivision | null;
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
  /** Whether `seedDisplayName` has already had its one chance this pass. See displayNameSeed.ts. */
  displayNameSeeded: boolean;
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
  /**
   * Prefills the display name from the profile (the name Apple shared, stored by
   * `complete_signup`) into an empty field, once per pass. Typed input always wins.
   */
  seedDisplayName: (suggestion: string | null | undefined) => void;
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
  /** The League rank picker's change. */
  setGameLeagueRank: (gameId: string, rank: LeagueRankValue) => void;
  addShow: (show: { showId: string; name: string }) => void;
  removeShow: (showId: string) => void;
  setPromptAt: (index: number, prompt: { promptId: string; question: string }) => void;
  setPromptAnswerAt: (index: number, answer: string) => void;
  clearPromptAt: (index: number) => void;
  setDiscordUsername: (value: string) => void;
  submit: () => Promise<void>;
  reset: () => void;
}

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Re-called on every reset() so a fresh array is created each time, rather than
 * sharing one `prompts` array reference across every onboarding pass. */
function initialState() {
  return {
    displayName: "",
    displayNameSeeded: false,
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
  };
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...initialState(),

  setDisplayName: (value) => set({ displayName: value }),
  seedDisplayName: (suggestion) => {
    const patch = displayNameSeed(get(), suggestion);
    if (patch) set(patch);
  },
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
        : { games: [...s.games, { ...game, skillLevel: "casual", rankText: "", lolTier: null, lolDivision: null }] },
    ),
  removeGame: (gameId) => set((s) => ({ games: s.games.filter((g) => g.gameId !== gameId) })),
  updateGameSkill: (gameId, skillLevel) =>
    set((s) => ({ games: s.games.map((g) => (g.gameId === gameId ? { ...g, skillLevel } : g)) })),
  updateGameRank: (gameId, rankText) =>
    set((s) => ({ games: s.games.map((g) => (g.gameId === gameId ? withTypedRankText(g, rankText) : g)) })),
  setGameLeagueRank: (gameId, rank) =>
    set((s) => ({
      games: s.games.map((g) =>
        g.gameId === gameId ? { ...g, lolTier: rank.lolTier, lolDivision: rank.lolDivision, rankText: rank.rankText } : g,
      ),
    })),

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
  reset: () => set(initialState()),

  submit: async () => {
    const state = get();
    set({ submitting: true, submitError: null });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No signed-in user.");
      const profileId = user.id;

      // The writes below are delete-then-insert, so running the wizard against a profile
      // that's already set up would wipe the real games/shows/platforms and replace them
      // with whatever this (possibly empty) store holds. 0028's trigger only guards the
      // false -> true transition of onboarding_completed, so it offers no protection
      // here. Fail loudly instead of silently destroying someone's profile.
      const { data: existing } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", profileId)
        .single();
      if (existing?.onboarding_completed) throw new Error("Your profile is already set up.");

      // Null when it cannot be read, and then League is written like any other game (its rank as
      // text, which the server's trigger parses). See features/league/leagueGame.ts.
      const leagueGameId = await getLeagueGameId();

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
          rows: state.games.map((g, i) => toProfileGameRow(g, leagueGameId, { profileId, priority: i })),
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
      const message = toUserMessage(err, "Something went wrong finishing your profile.");
      set({ submitting: false, submitError: message });
      // Rethrow as a real Error so the screen's `err instanceof Error` branch holds and
      // shows this message rather than falling back to its own generic string.
      throw err instanceof Error ? err : new Error(message);
    }
  },
}));
