import { Alert } from "react-native";
import * as Localization from "expo-localization";
import { create } from "zustand";
import { MIN_AGE } from "@duoqueue/shared-types";

import { useInviteStore } from "@/store/invite-store";
import { ProfileAlreadySetUpError, useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";

// Relative, so commit-store.test.ts runs these pure modules as themselves.
import { AUTH_COPY } from "../features/auth/authErrors";
import { completeSignupOutcome } from "../features/auth/completeSignup";
import { COMMIT_COPY, DISCORD_COPY } from "../features/auth/frontDoorCopy";
import {
  commitDestination,
  commitStartDecision,
  firstIncompleteStep,
  firstName,
} from "../features/onboarding/commitDraft";
import { toUserMessage } from "../lib/userMessage";

/**
 * THE COMMIT: "Save your card" has created (or signed into) an account, and the draft built on
 * the phone is written onto it. Rendered by app/index.tsx as CommitDraftScreen, never pushed (see
 * sessionRouting.ts, "commit-draft").
 *
 * WHY A STORE AND NOT THE SCREEN. The work outlives any one render: the profile read lands, the
 * route flips from "commit-draft" to "app" the moment `onboarding_completed` turns true, and the
 * guards re-render underneath. A run owned by a component would be cancelled or doubled by that;
 * here it runs once, guarded against re-entry, and the screen only draws its phase.
 *
 * Not persisted. A kill mid-commit relaunches with `commitPending` still set in the draft, so the
 * route is "commit-draft" again and the run starts over; every step is safe to repeat
 * (`complete_signup` answers "already has a profile", submit's delete-then-insert is idempotent,
 * and a finished card takes the returning path).
 *
 * IT BELONGS TO ONE SESSION. app/index.tsx draws the commit's phase AHEAD of the route for as long
 * as somebody is signed in, so a phase left behind by a session that has gone would greet the
 * next sign-in on this phone (any account) with "Your card isn't saved yet" instead of its own
 * screen. So the phase is dropped the moment the session leaves (the subscription at the bottom),
 * and a run still waiting on something when that happens stops at its next step (`generation`).
 *
 * It imports the session, onboarding, invite and toast stores, and none of them imports it back.
 */

export type CommitPhase = "idle" | "running" | "error" | "welcome" | "done";

interface CommitState {
  phase: CommitPhase;
  /** The line under "Your card isn't saved yet". Never a raw server message. */
  error: string | null;
  /** First name for "Welcome, {name}." */
  welcomeName: string;
  /** Where "/" goes once the phase is done. */
  destination: "/invited" | "/welcome" | null;

  run: () => Promise<void>;
  /** Try again: re-read the profile, then run. */
  retry: () => void;
  /** The destination has been taken; back to idle. */
  consume: () => void;
}

const PROFILE_WAIT_MS = 8000;
const INVITE_WAIT_MS = 5000;
const WELCOME_HOLD_MS = 900;

/**
 * Bumped whenever the commit is let go of (`consume`, which the session leaving also calls). A run
 * captures it when it starts and checks it after every await, so a run that was waiting on the
 * network when the player signed out cannot come back afterwards and write a phase, a toast or a
 * discard for an account that is no longer here.
 */
let generation = 0;

interface Subscribable<T> {
  getState: () => T;
  subscribe: (listener: (state: T) => void) => () => void;
}

/** Resolves true as soon as `ready` holds, or with its last answer after `ms`. */
function waitUntil<T>(store: Subscribable<T>, ready: (state: T) => boolean, ms: number): Promise<boolean> {
  if (ready(store.getState())) return Promise.resolve(true);
  return new Promise((resolve) => {
    let unsubscribe: () => void = () => {};
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(ready(store.getState()));
    }, ms);
    unsubscribe = store.subscribe((state) => {
      if (!ready(state)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toast(message: string, status: "success" | "error" | "info"): void {
  useToastStore.getState().showToast(message, status);
}

/**
 * Called just BEFORE an account call (Apple's onStart, sign-up, sign-in, the reset code): marks
 * the draft for commit, so the auth event that fires inside the call routes to the commit rather
 * than to a second age gate or an empty wizard (sessionRouting.ts). Only a finished draft can be
 * committed: without "ready to save" and a DOB this does nothing, and the sign-in is an ordinary
 * one (a left-over draft is then discarded at "app", app/index.tsx).
 */
export function beginAccountEntry(): void {
  const draft = useOnboardingStore.getState();
  if (draft.readyToSave && draft.ageConfirmedDob) draft.setCommitPending(true);
}

/**
 * The account call failed or was cancelled. Cleared only while signed out: once a session exists
 * the commit owns the flag, and clearing it there would drop a brand new Apple account onto the
 * post-auth age gate with the draft's DOB sitting unused.
 */
export function abortAccountEntry(): void {
  if (useSessionStore.getState().status === "signed_in") return;
  useOnboardingStore.getState().setCommitPending(false);
}

export const useCommitStore = create<CommitState>((set, get) => {
  /** A finished card already on the account: kept as it is, the draft dropped, and said so. */
  function returning(): void {
    useOnboardingStore.getState().discardDraft();
    toast(COMMIT_COPY.welcomeBack, "info");
    set({ phase: "idle" });
  }

  return {
    phase: "idle",
    error: null,
    welcomeName: "",
    destination: null,

    consume: () => {
      generation += 1;
      set({ phase: "idle", error: null, welcomeName: "", destination: null });
    },

    retry: () => {
      void (async () => {
        await useSessionStore.getState().refreshProfile();
        await get().run();
      })();
    },

    run: async () => {
      const { phase } = get();
      if (phase === "running" || phase === "welcome" || phase === "done") return;
      // A commit writes onto the signed-in account; with none (a Try again that landed after a
      // sign-out, say) there is nothing to write to.
      if (useSessionStore.getState().status !== "signed_in") return;
      set({ phase: "running", error: null });
      const started = generation;
      /** The commit was let go of while this run was waiting: stop without touching anything. */
      const abandoned = () => generation !== started;

      // (1) The new session's profile read. Until it answers there is nothing to decide on.
      await waitUntil(useSessionStore, (s) => s.profileStatus !== "unknown", PROFILE_WAIT_MS);
      if (abandoned()) return;
      const session = useSessionStore.getState();

      // (2) What the account already holds.
      const start = commitStartDecision({
        profileStatus: session.profileStatus,
        onboardingCompleted: session.profile?.onboarding_completed,
      });
      if (start === "read-failed") {
        set({ phase: "error", error: AUTH_COPY.network });
        return;
      }
      if (start === "returning") {
        returning();
        return;
      }
      if (start === "create-profile") {
        const draft = useOnboardingStore.getState();
        const dob = draft.ageConfirmedDob;
        if (!dob) {
          // Nothing to create a profile from: CompleteSignupScreen asks for the age instead.
          draft.setCommitPending(false);
          set({ phase: "idle" });
          return;
        }
        try {
          await session.completeSignup({
            dob,
            timezone: Localization.getCalendars()[0]?.timeZone ?? "UTC",
            displayName: draft.displayName.trim() || null,
          });
        } catch (err) {
          if (abandoned()) return;
          const outcome = completeSignupOutcome(err, MIN_AGE);
          if (outcome.kind === "banned") {
            // The phase stays "running" under the alert, so "/" keeps this screen up until the
            // session has gone (and the subscription below drops the phase). The draft goes
            // FIRST: sign-out flips the route to signed-out before its own reset of the draft,
            // and in that gap a draft with a DOB would route through the wizard on its way to
            // the front door.
            Alert.alert(COMMIT_COPY.bannedTitle, outcome.message, [
              {
                text: "OK",
                onPress: () => {
                  useOnboardingStore.getState().discardDraft();
                  void useSessionStore.getState().signOut();
                },
              },
            ]);
            return;
          }
          if (outcome.kind === "rejected") {
            useOnboardingStore.getState().setCommitPending(false);
            toast(outcome.message, "error");
            set({ phase: "idle" });
            return;
          }
          if (outcome.kind === "unknown") {
            set({ phase: "error", error: outcome.message });
            return;
          }
          // "already-complete": a retry after a commit that got this far. Carry on.
        }
        if (abandoned()) return;
      }

      // (3) A draft that is not finished (a stale one, or one restored with a field dropped) goes
      // back to its first gap, signed in, rather than half a card being written.
      const missing = firstIncompleteStep(useOnboardingStore.getState());
      if (missing) {
        const draft = useOnboardingStore.getState();
        draft.setLastStep(missing);
        draft.setCommitPending(false);
        toast(DISCORD_COPY.finishToast, "info");
        set({ phase: "idle" });
        return;
      }

      // (4) The card itself, exactly as 1.0.1's last wizard step wrote it.
      let pictureUploadFailed = false;
      try {
        ({ pictureUploadFailed } = await useOnboardingStore.getState().submit());
      } catch (err) {
        if (abandoned()) return;
        if (err instanceof ProfileAlreadySetUpError) {
          returning();
          return;
        }
        set({ phase: "error", error: toUserMessage(err, AUTH_COPY.generic) });
        return;
      }
      if (abandoned()) return;

      // (5) An invite code typed at the front door is redeemed by useInviteRedemption the moment
      // the profile exists; give it a moment, so the friend who sent it is the first screen.
      if (useInviteStore.getState().pendingCode) {
        await waitUntil(
          useInviteStore,
          (s) => s.pendingCode === null || s.redemption === "done" || s.redemption === "failed",
          INVITE_WAIT_MS,
        );
        if (abandoned()) return;
      }

      // (6) Chosen before the refresh, which is what lets the guards move on.
      const destination = commitDestination({ arrival: useInviteStore.getState().arrival });

      // (7) onboarding_completed is true from here, so the route answers "app".
      await useSessionStore.getState().refreshProfile();
      if (abandoned()) return;

      // (8) The draft has done its job.
      const welcomeName = firstName(useOnboardingStore.getState().displayName);
      useOnboardingStore.getState().discardDraft();
      if (pictureUploadFailed) toast(COMMIT_COPY.pictureFailed, "error");

      // (9) "Welcome, Cameron." for a moment, then app/index.tsx takes the destination.
      set({ phase: "welcome", welcomeName, destination });
      await sleep(WELCOME_HOLD_MS);
      if (abandoned()) return;
      set({ phase: "done" });
    },
  };
});

// The session leaving lets go of the commit, whatever phase it reached: Sign out on the error
// screen, the banned alert's OK, or a session that ended on its own. Without this, an "error"
// phase outlived its account and was drawn ahead of the next sign-in's route (app/index.tsx).
useSessionStore.subscribe((s) => {
  if (s.status === "signed_in") return;
  if (useCommitStore.getState().phase === "idle") return;
  useCommitStore.getState().consume();
});
