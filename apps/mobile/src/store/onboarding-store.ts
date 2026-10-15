import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { LanguageCode, Platform, PlaystyleTag, Region, SkillLevel } from "@duoqueue/shared-types";
import { PROMPT_COUNT } from "@duoqueue/shared-types";

import { getLeagueGameId } from "@/features/league/leagueGame";
import { type LeagueRankValue, toProfileGameRow, withTypedRankText } from "@/features/league/rankPickerState";
import { resolveCustomGame } from "@/features/onboarding/customGames";
import { displayNameSeed } from "@/features/onboarding/displayNameSeed";
import { clearDraftPhotos, currentDraftPhotoUri, draftPhotoExists } from "@/features/onboarding/draftPhoto";
import { uploadPicture } from "@/features/profile/usePhotoUpload";
import { supabase } from "@/lib/supabase";
import { toUserMessage } from "@/lib/userMessage";

// Relative, so the store's tests run these pure modules as themselves with no mock.
import { isPendingCustomGame, normalizeCustomName, pendingCustomGameId } from "../features/onboarding/catalogSearch";
import {
  type DraftAnswers,
  sanitizeDraft,
  type SelectedGame,
  type SelectedPrompt,
  type SelectedShow,
} from "../features/onboarding/commitDraft";
import type { DraftStep } from "../features/onboarding/steps";

export type { SelectedGame, SelectedPrompt, SelectedShow };

/**
 * THE SIGNUP DRAFT. Since 1.0.2 the card is built before the account exists (D1: a local draft,
 * not an anonymous Supabase session), so this store is no longer a few minutes of wizard state:
 * it holds every answer from the age gate to "Save your card", persisted on the phone, and the
 * commit writes it onto the new account. The rules it applies (what a relaunch may restore, when
 * the card is complete) are pure and tested in features/onboarding/commitDraft.ts.
 *
 * PERSISTED with zustand `persist` under "duoqueue.onboarding-draft", version 1, in plain
 * AsyncStorage (open question Q4: a draft holds a DOB and some answers, never a credential). A
 * draft expires after 7 days and is cleared on Save, sign-out and Start over (`discardDraft`).
 *
 * NOTHING WRITTEN BEFORE THE READ-BACK MAY REACH STORAGE. `persist` writes on every `set`, and a
 * set that lands before rehydration (a screen mounting, the fallback timer) would overwrite the
 * stored draft with an empty one. `draftStorage` therefore drops every write until
 * `persistReady`, which only the rehydration callback sets.
 *
 * `hydrated` IS FOR ROUTING. `sessionRoute` holds until it is true, because a guard that answered
 * from an empty draft about to be read back would send a half-built card to the front door. A
 * forever-false `hydrated` is a blank app, so a 2 s fallback sets it anyway; that launch's draft
 * is then simply not persisted (`persistReady` stays false).
 *
 * A READ-BACK THAT ANSWERS AFTER THE FALLBACK IS IGNORED (`hydrationFallbackFired`). By then the
 * routes have answered from an empty draft and the player may have started a new card; merging
 * the stored one over it would mix two cards (somebody else's DOB, on a shared phone) and switch
 * persistence on for the mix. So this launch keeps what it has and saves nothing, and the stored
 * draft stays on the phone, untouched, for the next launch to read in time.
 */

const STORAGE_KEY = "duoqueue.onboarding-draft";
const HYDRATION_FALLBACK_MS = 2000;

/** When this JS runtime started: a draft started before it came from an earlier launch. */
export const LAUNCH_STARTED_AT = Date.now();

let persistReady = false;
/** The 2 s fallback answered routing before the read-back did. See the header. */
let hydrationFallbackFired = false;

const draftStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch (err) {
      console.warn("Could not read the signup draft:", err);
      return null;
    }
  },
  setItem: async (name, value) => {
    if (!persistReady) return;
    try {
      await AsyncStorage.setItem(name, value);
    } catch (err) {
      console.warn("Could not save the signup draft:", err);
    }
  },
  removeItem: async (name) => {
    if (!persistReady) return;
    try {
      await AsyncStorage.removeItem(name);
    } catch (err) {
      console.warn("Could not clear the signup draft:", err);
    }
  },
};

export interface SubmitResult {
  /** The optional picture failed to upload (or its file is gone). Onboarding still finished. */
  pictureUploadFailed: boolean;
}

/** `submit()` against a profile that already finished onboarding. The commit takes the returning path. */
export class ProfileAlreadySetUpError extends Error {
  constructor() {
    super("Your profile is already set up.");
    this.name = "ProfileAlreadySetUpError";
  }
}

interface OnboardingState extends DraftAnswers {
  /** The persisted draft has been read back (or the fallback fired). Never reset. */
  hydrated: boolean;
  submitting: boolean;
  submitError: string | null;

  setDisplayName: (value: string) => void;
  /**
   * Prefills the display name from the profile (the name Apple shared, stored by
   * `complete_signup`) into an empty field, once per pass. Typed input always wins.
   */
  seedDisplayName: (suggestion: string | null | undefined) => void;
  setProfilePhotoUri: (uri: string | null) => void;
  setRegion: (value: Region) => void;
  toggleLanguage: (value: LanguageCode) => void;
  togglePlatform: (value: Platform) => void;
  togglePlaystyle: (value: PlaystyleTag) => void;
  addGame: (game: { gameId: string; name: string }) => void;
  /** A game not in the catalog, picked signed out: held under a pending id until `submit`. */
  addCustomGame: (name: string) => void;
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

  /** The age gate passed: the DOB goes into the draft, and the 7-day clock starts. */
  setAgeConfirmedDob: (dob: string) => void;
  /** Where the draft resumes. Ignored until the stored draft has been read back. */
  setLastStep: (step: DraftStep) => void;
  setReadyToSave: (value: boolean) => void;
  setCommitPending: (value: boolean) => void;
  /** The phone's guesses, once per draft, never over an answer already chosen. Ignored before hydration. */
  prefillFromDevice: (guess: { region: Region | null; languages: LanguageCode[] }) => void;
  /** Start over: every answer, the DOB and the kept picture, gone. `hydrated` stays. */
  discardDraft: () => void;
  /** Sign-out's name for `discardDraft` (session-store.ts calls it). */
  reset: () => void;

  submit: () => Promise<SubmitResult>;
}

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Every field but `hydrated`, fresh each call so no array is ever shared between drafts. */
function initialState(): DraftAnswers & { submitting: boolean; submitError: string | null } {
  return {
    ageConfirmedDob: null,
    draftStartedAt: null,
    lastStep: null,
    readyToSave: false,
    commitPending: false,
    devicePrefilled: false,
    displayName: "",
    displayNameSeeded: false,
    profilePhotoUri: null,
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

/** What is written to the phone: the draft, never `hydrated`, `submitting` or `submitError`. */
function partializeDraft(s: OnboardingState): DraftAnswers {
  return {
    ageConfirmedDob: s.ageConfirmedDob,
    draftStartedAt: s.draftStartedAt,
    lastStep: s.lastStep,
    readyToSave: s.readyToSave,
    commitPending: s.commitPending,
    devicePrefilled: s.devicePrefilled,
    displayName: s.displayName,
    displayNameSeeded: s.displayNameSeeded,
    profilePhotoUri: s.profilePhotoUri,
    region: s.region,
    languages: s.languages,
    platforms: s.platforms,
    games: s.games,
    shows: s.shows,
    playstyles: s.playstyles,
    prompts: s.prompts,
    discordUsername: s.discordUsername,
  };
}

function hasHydrated(): boolean {
  return useOnboardingStore.persist.hasHydrated();
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...initialState(),

      setDisplayName: (value) => set({ displayName: value }),
      seedDisplayName: (suggestion) => {
        const patch = displayNameSeed(get(), suggestion);
        if (patch) set(patch);
      },
      setProfilePhotoUri: (uri) => set({ profilePhotoUri: uri }),
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
      addCustomGame: (name) => {
        const gameId = pendingCustomGameId(name);
        set((s) =>
          s.games.some((g) => g.gameId === gameId)
            ? s
            : {
                games: [
                  ...s.games,
                  {
                    gameId,
                    name: normalizeCustomName(name),
                    skillLevel: "casual",
                    rankText: "",
                    lolTier: null,
                    lolDivision: null,
                  },
                ],
              },
        );
      },
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

      setAgeConfirmedDob: (dob) => set((s) => ({ ageConfirmedDob: dob, draftStartedAt: s.draftStartedAt ?? Date.now() })),
      setLastStep: (step) => {
        if (!hasHydrated()) return;
        // An Apple-first player never passes the age gate, so their first step starts the clock.
        set((s) => ({ lastStep: step, draftStartedAt: s.draftStartedAt ?? Date.now() }));
      },
      setReadyToSave: (value) => set({ readyToSave: value }),
      setCommitPending: (value) => set({ commitPending: value }),
      prefillFromDevice: ({ region, languages }) => {
        if (!hasHydrated()) return;
        set((s) =>
          s.devicePrefilled
            ? s
            : {
                devicePrefilled: true,
                region: s.region ?? region,
                languages: s.languages.length > 0 ? s.languages : languages,
              },
        );
      },
      discardDraft: () => {
        set(initialState());
        void clearDraftPhotos();
      },
      reset: () => get().discardDraft(),

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
          // here. Fail loudly instead of silently destroying someone's profile. The commit
          // (commit-store.ts) catches this one by class and treats it as a returning player.
          const { data: existing } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", profileId)
            .single();
          if (existing?.onboarding_completed) throw new ProfileAlreadySetUpError();

          // Null when it cannot be read, and then League is written like any other game (its rank as
          // text, which the server's trigger parses). See features/league/leagueGame.ts.
          const leagueGameId = await getLeagueGameId();

          // The picture is optional, so a failed upload (too large, a dropped connection) must not
          // strand someone on the last step with an error about a choice they made on the first.
          // Finish the profile and say so. A draft can wait days for Save, so the kept file may be
          // gone (a reinstall, a purge): that is the same outcome, without trying.
          let pictureUploadFailed = false;
          if (state.profilePhotoUri) {
            if (!(await draftPhotoExists(state.profilePhotoUri))) {
              pictureUploadFailed = true;
            } else {
              try {
                await uploadPicture(profileId, state.profilePhotoUri);
              } catch (err) {
                console.warn("Picture upload failed during onboarding:", err);
                pictureUploadFailed = true;
              }
            }
          }

          // Custom games picked signed out exist only as pending ids until there is an account to
          // own them. Created here, before any row names them; a name the catalog already has
          // resolves to that row (customGames.ts), and two picks that land on one row stay one.
          const games: SelectedGame[] = [];
          for (const g of state.games) {
            const row = isPendingCustomGame(g.gameId)
              ? { ...g, gameId: (await resolveCustomGame(g.name, profileId)).id }
              : g;
            if (!games.some((x) => x.gameId === row.gameId)) games.push(row);
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
              rows: games.map((g, i) => toProfileGameRow(g, leagueGameId, { profileId, priority: i })),
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

          // Trimmed here, where it is written: the steps validate the trimmed value, and a stray
          // space after a Discord name made it a different (and unfindable) name.
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              display_name: state.displayName.trim(),
              region: state.region,
              discord_username: state.discordUsername.trim() || null,
              onboarding_completed: true,
            })
            .eq("id", profileId);
          if (profileError) throw profileError;

          set({ submitting: false });
          return { pictureUploadFailed };
        } catch (err) {
          const message = toUserMessage(err, "Something went wrong finishing your profile.");
          set({ submitting: false, submitError: message });
          // An Error is rethrown AS ITSELF (the commit tells ProfileAlreadySetUpError apart by
          // class, and reads a P0001 hint off a PostgrestError), anything else as an Error with
          // the mapped line. Either way a caller shows `toUserMessage(err, ...)`, never
          // `err.message`: PostgrestError extends Error, and its message is Postgres's own text.
          throw err instanceof Error ? err : new Error(message);
        }
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => draftStorage),
      partialize: partializeDraft,
      // Too late to use once the fallback has answered routing (see the header): keep this launch.
      // The kept picture's uri is re-anchored on this launch's documents folder, which an app
      // update can move (draftPhotoPath.ts); the next write stores the new path.
      merge: (persisted, current) => {
        if (hydrationFallbackFired) return current;
        const draft = sanitizeDraft(persisted, Date.now());
        if (draft.profilePhotoUri) draft.profilePhotoUri = currentDraftPhotoUri(draft.profilePhotoUri);
        return { ...current, ...draft };
      },
      // Runs on success AND on a failed read: either way the stored draft can no longer be
      // overwritten by accident, and routing may answer. After the fallback, persistence stays
      // off for the rest of the launch, as the fallback promised.
      onRehydrateStorage: () => () => {
        if (!hydrationFallbackFired) persistReady = true;
        useOnboardingStore.setState({ hydrated: true });
      },
    },
  ),
);

// ROUTING ONLY. If the read-back never answers, the app must still render; `persistReady` stays
// false, so this launch's answers are simply not saved rather than written over the stored ones,
// and a read-back that answers later is ignored (merge, above).
setTimeout(() => {
  if (useOnboardingStore.getState().hydrated) return;
  hydrationFallbackFired = true;
  useOnboardingStore.setState({ hydrated: true });
}, HYDRATION_FALLBACK_MS);
