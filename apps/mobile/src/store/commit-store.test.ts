import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock calls below are hoisted above these imports, so the store sees the doubles.
import { AUTH_COPY } from "../features/auth/authErrors";
import { COMMIT_COPY, DISCORD_COPY } from "../features/auth/frontDoorCopy";
import { abortAccountEntry, beginAccountEntry, useCommitStore } from "./commit-store";

/**
 * The commit: what happens between "Save your card" creating an account and the welcome tour.
 *
 * The decisions it applies (commitStartDecision, firstIncompleteStep, commitDestination,
 * completeSignupOutcome) are pure and tested on their own; the store imports them relatively, so
 * they run here as themselves. Everything with a side effect is a hand-written double: the
 * session, onboarding, invite and toast stores (getState and subscribe), React Native's Alert and
 * expo-localization. Each double appends to one `events` log, which is how the order is checked.
 */
const mocks = vi.hoisted(() => {
  type Listener<T> = (state: T) => void;

  function fakeStore<T extends object>(initial: T) {
    let state = initial;
    const listeners = new Set<Listener<T>>();
    return {
      getState: () => state,
      setState: (patch: Partial<T>) => {
        state = { ...state, ...patch };
        for (const l of listeners) l(state);
      },
      subscribe: (l: Listener<T>) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      replace: (next: T) => {
        state = next;
      },
    };
  }

  class ProfileAlreadySetUpError extends Error {}

  const events: string[] = [];
  const control = {
    completeSignupError: null as unknown,
    submitError: null as unknown,
    pictureUploadFailed: false,
    /** The session leaves while submit is in flight (a sign-out, an expired session). */
    signOutDuringSubmit: false,
    alerts: [] as { title: string; message: string; buttons: { text: string; onPress?: () => void }[] }[],
    toasts: [] as { message: string; status: string }[],
  };

  const session = fakeStore({
    status: "signed_in" as "signed_in" | "signed_out" | "loading",
    profileStatus: "loaded" as "unknown" | "loaded" | "missing" | "error",
    profile: { onboarding_completed: false } as { onboarding_completed: boolean } | null,
    completeSignup: async (input: { dob: string; timezone: string; displayName?: string | null }) => {
      events.push(`completeSignup:${input.dob}:${input.timezone}:${input.displayName}`);
      if (control.completeSignupError) throw control.completeSignupError;
      session.setState({ profileStatus: "loaded", profile: { onboarding_completed: false } });
    },
    refreshProfile: async () => {
      events.push("refreshProfile");
    },
    // Like the real one, the session is gone by the time sign-out has run.
    signOut: async () => {
      events.push("signOut");
      session.setState({ status: "signed_out", profileStatus: "unknown", profile: null });
    },
  });

  function draftState() {
    return {
      ageConfirmedDob: "2000-05-01" as string | null,
      readyToSave: true,
      commitPending: true,
      displayName: "Cameron Stallings",
      region: "na_east" as string | null,
      languages: ["en"],
      platforms: ["pc"],
      games: [{ gameId: "g", name: "League of Legends", skillLevel: "casual", rankText: "", lolTier: null, lolDivision: null }],
      prompts: [
        { promptId: "a", question: "q", answer: "x" },
        { promptId: "b", question: "q", answer: "x" },
        { promptId: "c", question: "q", answer: "x" },
      ] as ({ promptId: string; question: string; answer: string } | null)[],
      discordUsername: "",
      setCommitPending: (value: boolean) => {
        events.push(`setCommitPending:${value}`);
        onboarding.setState({ commitPending: value });
      },
      setLastStep: (step: string) => {
        events.push(`setLastStep:${step}`);
      },
      discardDraft: () => {
        events.push("discardDraft");
        onboarding.setState({ ageConfirmedDob: null, commitPending: false, readyToSave: false, displayName: "" });
      },
      submit: async () => {
        events.push("submit");
        if (control.signOutDuringSubmit) session.setState({ status: "signed_out", profileStatus: "unknown", profile: null });
        if (control.submitError) throw control.submitError;
        return { pictureUploadFailed: control.pictureUploadFailed };
      },
    };
  }

  const onboarding = fakeStore(draftState());

  const invite = fakeStore({
    pendingCode: null as string | null,
    arrival: null as { inviterId: string; inviterName: string } | null,
    redemption: "idle" as "idle" | "pending" | "done" | "failed",
  });

  const toast = {
    getState: () => ({
      showToast: (message: string, status = "success") => {
        events.push(`toast:${status}`);
        control.toasts.push({ message, status });
      },
    }),
  };

  function reset(): void {
    events.length = 0;
    control.completeSignupError = null;
    control.submitError = null;
    control.pictureUploadFailed = false;
    control.signOutDuringSubmit = false;
    control.alerts = [];
    control.toasts = [];
    session.setState({ status: "signed_in", profileStatus: "loaded", profile: { onboarding_completed: false } });
    onboarding.replace(draftState());
    invite.setState({ pendingCode: null, arrival: null, redemption: "idle" });
  }

  return { events, control, session, onboarding, invite, toast, reset, ProfileAlreadySetUpError };
});

vi.mock("react-native", () => ({
  Alert: {
    alert: (title: string, message: string, buttons: { text: string; onPress?: () => void }[]) => {
      mocks.events.push("alert");
      mocks.control.alerts.push({ title, message, buttons });
    },
  },
}));

vi.mock("expo-localization", () => ({
  getCalendars: () => [{ timeZone: "America/Chicago" }],
}));

vi.mock("@/store/session-store", () => ({ useSessionStore: mocks.session }));
vi.mock("@/store/onboarding-store", () => ({
  useOnboardingStore: mocks.onboarding,
  ProfileAlreadySetUpError: mocks.ProfileAlreadySetUpError,
}));
vi.mock("@/store/invite-store", () => ({ useInviteStore: mocks.invite }));
vi.mock("@/store/toast-store", () => ({ useToastStore: mocks.toast }));

const { events, control, session, onboarding, invite } = mocks;

async function runToEnd(): Promise<void> {
  const done = useCommitStore.getState().run();
  await vi.runAllTimersAsync();
  await done;
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.reset();
  useCommitStore.setState({ phase: "idle", error: null, welcomeName: "", destination: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("run: the order of a successful save", () => {
  it("submits, refreshes, discards the draft, then welcomes by first name and finishes", async () => {
    const phases: string[] = [];
    const unsubscribe = useCommitStore.subscribe((s) => phases.push(s.phase));

    await runToEnd();
    unsubscribe();

    expect(events).toEqual(["submit", "refreshProfile", "discardDraft"]);
    expect(phases).toEqual(["running", "welcome", "done"]);
    expect(useCommitStore.getState()).toMatchObject({ phase: "done", welcomeName: "Cameron", destination: "/welcome" });
  });

  it("holds the welcome for 900 ms before it is done", async () => {
    const done = useCommitStore.getState().run();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(useCommitStore.getState().phase).toBe("welcome");
    await vi.advanceTimersByTimeAsync(899);
    expect(useCommitStore.getState().phase).toBe("welcome");
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(useCommitStore.getState().phase).toBe("done");
  });

  it("goes to /invited when an invite arrived", async () => {
    invite.setState({ arrival: { inviterId: "i", inviterName: "Kai" }, redemption: "done" });
    await runToEnd();
    expect(useCommitStore.getState().destination).toBe("/invited");
  });

  it("waits for a pending invite to be redeemed before choosing where to go", async () => {
    invite.setState({ pendingCode: "ABCDE12345", redemption: "pending" });
    const done = useCommitStore.getState().run();
    await vi.advanceTimersByTimeAsync(1000);
    invite.setState({ pendingCode: null, arrival: { inviterId: "i", inviterName: "Kai" }, redemption: "done" });
    await vi.runAllTimersAsync();
    await done;
    expect(useCommitStore.getState().destination).toBe("/invited");
  });

  it("stops waiting for a redemption after 5 s", async () => {
    invite.setState({ pendingCode: "ABCDE12345", redemption: "pending" });
    await runToEnd();
    expect(useCommitStore.getState()).toMatchObject({ phase: "done", destination: "/welcome" });
  });

  it("toasts when the picture did not make it", async () => {
    control.pictureUploadFailed = true;
    await runToEnd();
    expect(control.toasts).toEqual([{ message: COMMIT_COPY.pictureFailed, status: "error" }]);
  });

  it("ignores a second run while one is running", async () => {
    const first = useCommitStore.getState().run();
    const second = useCommitStore.getState().run();
    await vi.runAllTimersAsync();
    await Promise.all([first, second]);
    expect(events.filter((e) => e === "submit")).toHaveLength(1);
  });
});

describe("run: a new Apple account (no profile row)", () => {
  beforeEach(() => {
    session.setState({ profileStatus: "missing", profile: null });
  });

  it("creates the profile with the draft's DOB, the time zone and the name, then submits", async () => {
    await runToEnd();
    expect(events.slice(0, 2)).toEqual(["completeSignup:2000-05-01:America/Chicago:Cameron Stallings", "submit"]);
    expect(useCommitStore.getState().phase).toBe("done");
  });

  it("carries on when the profile turns out to exist already", async () => {
    control.completeSignupError = { message: "This account already has a profile" };
    await runToEnd();
    expect(events).toContain("submit");
    expect(useCommitStore.getState().phase).toBe("done");
  });

  it("signs a banned account out from the alert, dropping the draft first", async () => {
    control.completeSignupError = { message: "This account has been banned and cannot be re-created." };
    await runToEnd();
    expect(events).not.toContain("submit");
    expect(control.alerts).toHaveLength(1);
    expect(control.alerts[0]?.title).toBe(COMMIT_COPY.bannedTitle);
    // The screen stays up under the alert until the session has gone.
    expect(useCommitStore.getState().phase).toBe("running");
    control.alerts[0]?.buttons[0]?.onPress?.();
    expect(events.slice(-2)).toEqual(["discardDraft", "signOut"]);
    expect(useCommitStore.getState().phase).toBe("idle");
  });

  it("drops the pending commit on a refused date, with an error toast and no submit", async () => {
    control.completeSignupError = { message: "You must be at least 18 to create an account" };
    await runToEnd();
    expect(events).not.toContain("submit");
    expect(events).toContain("setCommitPending:false");
    expect(control.toasts.map((t) => t.status)).toEqual(["error"]);
    expect(useCommitStore.getState().phase).toBe("idle");
  });

  it("shows the error state on any other failure", async () => {
    control.completeSignupError = new Error("network");
    await runToEnd();
    expect(useCommitStore.getState()).toMatchObject({ phase: "error", error: "Something went wrong. Please try again." });
  });

  it("hands over to the age gate when the draft has no DOB", async () => {
    onboarding.setState({ ageConfirmedDob: null });
    await runToEnd();
    expect(events).toEqual(["setCommitPending:false"]);
    expect(useCommitStore.getState().phase).toBe("idle");
  });
});

describe("run: a returning player", () => {
  it("keeps their card, discards the draft and says so, without creating or submitting", async () => {
    session.setState({ profile: { onboarding_completed: true } });
    await runToEnd();
    expect(events).toEqual(["discardDraft", "toast:info"]);
    expect(control.toasts[0]?.message).toBe(COMMIT_COPY.welcomeBack);
    expect(useCommitStore.getState().phase).toBe("idle");
  });

  it("takes the same path when submit finds the profile already set up", async () => {
    control.submitError = new mocks.ProfileAlreadySetUpError("Your profile is already set up.");
    await runToEnd();
    expect(events).toEqual(["submit", "discardDraft", "toast:info"]);
    expect(useCommitStore.getState().phase).toBe("idle");
  });
});

describe("run: everything else", () => {
  it("sends an incomplete draft back to its first missing step", async () => {
    onboarding.setState({ languages: [] });
    await runToEnd();
    expect(events).toEqual(["setLastStep:languages", "setCommitPending:false", "toast:info"]);
    expect(control.toasts[0]?.message).toBe(DISCORD_COPY.finishToast);
    expect(useCommitStore.getState().phase).toBe("idle");
  });

  it("shows the error state with a readable line when submit fails", async () => {
    control.submitError = { code: "P0001", hint: "Pick one of the games on your profile." };
    await runToEnd();
    expect(useCommitStore.getState()).toMatchObject({ phase: "error", error: "Pick one of the games on your profile." });
    expect(events).not.toContain("discardDraft");
  });

  it("waits up to 8 s for the profile read, then says it could not reach DuoQueue", async () => {
    session.setState({ profileStatus: "unknown", profile: null });
    await runToEnd();
    expect(useCommitStore.getState()).toMatchObject({ phase: "error", error: AUTH_COPY.network });
    expect(events).toEqual([]);
  });

  it("starts as soon as the profile read lands", async () => {
    session.setState({ profileStatus: "unknown", profile: null });
    const done = useCommitStore.getState().run();
    await vi.advanceTimersByTimeAsync(500);
    session.setState({ profileStatus: "loaded", profile: { onboarding_completed: false } });
    await vi.runAllTimersAsync();
    await done;
    expect(useCommitStore.getState().phase).toBe("done");
  });

  it("retries by refreshing the profile and running again", async () => {
    useCommitStore.setState({ phase: "error", error: "x" });
    useCommitStore.getState().retry();
    await vi.runAllTimersAsync();
    expect(events.slice(0, 2)).toEqual(["refreshProfile", "submit"]);
    expect(useCommitStore.getState().phase).toBe("done");
  });

  it("consume returns to idle", () => {
    useCommitStore.setState({ phase: "done", destination: "/welcome", welcomeName: "Cameron" });
    useCommitStore.getState().consume();
    expect(useCommitStore.getState()).toMatchObject({ phase: "idle", destination: null, welcomeName: "", error: null });
  });
});

describe("the session leaving", () => {
  it("drops a failed commit on sign-out, so the next sign-in starts from its own route", async () => {
    control.submitError = new Error("offline");
    await runToEnd();
    expect(useCommitStore.getState().phase).toBe("error");

    session.setState({ status: "signed_out", profileStatus: "unknown", profile: null });

    expect(useCommitStore.getState()).toMatchObject({ phase: "idle", error: null, destination: null, welcomeName: "" });
  });

  it("drops the welcome and done phases too", () => {
    useCommitStore.setState({ phase: "done", destination: "/welcome", welcomeName: "Cameron" });
    session.setState({ status: "signed_out" });
    expect(useCommitStore.getState()).toMatchObject({ phase: "idle", destination: null });
  });

  it("stops a run that is still waiting for the profile read when the session leaves", async () => {
    session.setState({ profileStatus: "unknown", profile: null });
    const done = useCommitStore.getState().run();
    await vi.advanceTimersByTimeAsync(500);
    session.setState({ status: "signed_out" });
    await vi.runAllTimersAsync();
    await done;
    expect(useCommitStore.getState().phase).toBe("idle");
    expect(events).toEqual([]);
  });

  it("writes nothing after a submit the session left during", async () => {
    control.signOutDuringSubmit = true;
    await runToEnd();
    expect(events).toEqual(["submit"]);
    expect(useCommitStore.getState().phase).toBe("idle");
  });

  it("does not start without a session (a Try again that landed after a sign-out)", async () => {
    session.setState({ status: "signed_out" });
    useCommitStore.getState().retry();
    await vi.runAllTimersAsync();
    expect(events).toEqual(["refreshProfile"]);
    expect(useCommitStore.getState().phase).toBe("idle");
  });
});

describe("beginAccountEntry and abortAccountEntry", () => {
  it("marks the draft for commit only when it is ready to save and has a DOB", () => {
    onboarding.setState({ commitPending: false, readyToSave: false });
    beginAccountEntry();
    expect(onboarding.getState().commitPending).toBe(false);

    onboarding.setState({ readyToSave: true, ageConfirmedDob: null });
    beginAccountEntry();
    expect(onboarding.getState().commitPending).toBe(false);

    onboarding.setState({ readyToSave: true, ageConfirmedDob: "2000-05-01" });
    beginAccountEntry();
    expect(onboarding.getState().commitPending).toBe(true);
  });

  it("clears the mark after a failed attempt, but never once a session exists", () => {
    onboarding.setState({ commitPending: true });
    session.setState({ status: "signed_in" });
    abortAccountEntry();
    expect(onboarding.getState().commitPending).toBe(true);

    session.setState({ status: "signed_out" });
    abortAccountEntry();
    expect(onboarding.getState().commitPending).toBe(false);
  });
});
