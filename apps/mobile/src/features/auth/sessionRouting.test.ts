import { describe, expect, it } from "vitest";

import {
  nextProfileState,
  profileLoad,
  sessionRoute,
  UNCONFIRMED_READ_MESSAGE,
  type ProfileStatus,
  type SessionRoute,
  type SessionRouteInput,
  type SessionStatus,
} from "./sessionRouting";

const SIGNED_IN: SessionRouteInput = {
  status: "signed_in",
  profileStatus: "loaded",
  onboardingCompleted: true,
};

const STATUSES: SessionStatus[] = ["loading", "signed_out", "signed_in"];
const PROFILE_STATUSES: ProfileStatus[] = ["unknown", "loaded", "missing", "error"];
const ONBOARDING: (boolean | undefined)[] = [true, false, undefined];

describe("sessionRoute", () => {
  it("holds while the session is still being restored", () => {
    expect(sessionRoute({ ...SIGNED_IN, status: "loading", profileStatus: "unknown", onboardingCompleted: undefined })).toBe(
      "hold",
    );
  });

  it("sends a signed-out visitor to the front door", () => {
    expect(sessionRoute({ ...SIGNED_IN, status: "signed_out" })).toBe("sign-in");
  });

  it("sends an authenticated session with no profile row to the age gate", () => {
    expect(sessionRoute({ ...SIGNED_IN, profileStatus: "missing", onboardingCompleted: undefined })).toBe(
      "complete-signup",
    );
  });

  it("routes a loaded profile on its own onboarding flag", () => {
    expect(sessionRoute({ ...SIGNED_IN, onboardingCompleted: false })).toBe("onboarding");
    expect(sessionRoute({ ...SIGNED_IN, onboardingCompleted: true })).toBe("app");
  });

  // The whole reason the store carries four states. `profile?.onboarding_completed` was falsy
  // for a missing profile too, so both went to the wizard, which then failed on a foreign key
  // ten screens later.
  it("does not confuse a missing profile with an unfinished one", () => {
    const missing = sessionRoute({ ...SIGNED_IN, profileStatus: "missing", onboardingCompleted: undefined });
    const unfinished = sessionRoute({ ...SIGNED_IN, profileStatus: "loaded", onboardingCompleted: false });
    expect(missing).toBe("complete-signup");
    expect(unfinished).toBe("onboarding");
  });

  // The failure this function exists to prevent: a user of six months, one dropped request,
  // and a screen asking them to prove they are 18 again.
  it("never routes a failed or unfinished read to the age gate", () => {
    for (const profileStatus of ["unknown", "error"] as ProfileStatus[]) {
      expect(sessionRoute({ status: "signed_in", profileStatus, onboardingCompleted: undefined })).toBe("hold");
      expect(sessionRoute({ status: "signed_in", profileStatus, onboardingCompleted: true })).toBe("app");
      expect(sessionRoute({ status: "signed_in", profileStatus, onboardingCompleted: false })).toBe("onboarding");
    }
  });

  it("keeps somebody on the screen they are already on when a refresh fails", () => {
    // Held profile, failed refresh: they stay in the app rather than being ejected.
    expect(sessionRoute({ status: "signed_in", profileStatus: "error", onboardingCompleted: true })).toBe("app");
  });

  it("holds rather than guessing when there is nothing to route on", () => {
    expect(sessionRoute({ status: "signed_in", profileStatus: "unknown", onboardingCompleted: undefined })).toBe("hold");
  });

  it("asks about the session before it asks about the profile", () => {
    // A sign-out clears the session before the store resets profileStatus in the same call, and
    // an auth-state change for a different account arrives with the last account's answers still
    // in memory. Either way, "signed out" is the only true thing on screen at that moment, and
    // routing a signed-out session to the age gate would show a birthdate wheel to nobody.
    for (const profileStatus of PROFILE_STATUSES) {
      for (const onboardingCompleted of ONBOARDING) {
        expect(sessionRoute({ status: "signed_out", profileStatus, onboardingCompleted })).toBe("sign-in");
        expect(sessionRoute({ status: "loading", profileStatus, onboardingCompleted })).toBe("hold");
      }
    }
  });

  it("reaches the age gate from exactly one state and no other", () => {
    // Stated as a property rather than a list, because this is the one answer that is expensive
    // in both directions: withholding it lets an age-unverified session into the app, and
    // volunteering it asks an existing user to prove their age again. Only an authenticated
    // session whose profile read came back empty may have it.
    for (const status of STATUSES) {
      for (const profileStatus of PROFILE_STATUSES) {
        for (const onboardingCompleted of ONBOARDING) {
          const route = sessionRoute({ status, profileStatus, onboardingCompleted });
          expect(route === "complete-signup").toBe(status === "signed_in" && profileStatus === "missing");
        }
      }
    }
  });

  it("never lets a profile-less session reach the app or the wizard", () => {
    // The two destinations that run queries against a profile that does not exist: the deck, and
    // the ten-step wizard whose first insert would die on a foreign key after two photo uploads.
    for (const onboardingCompleted of ONBOARDING) {
      const route = sessionRoute({ status: "signed_in", profileStatus: "missing", onboardingCompleted });
      expect(route).toBe("complete-signup");
    }
  });

  it("only ever answers with a destination the callers know", () => {
    // app/index.tsx renders one screen per answer and falls through to the tabs. A fifth answer
    // would arrive there as "go to the deck", which for an unknown state is the wrong default.
    const known: SessionRoute[] = ["hold", "sign-in", "complete-signup", "onboarding", "app"];
    for (const status of STATUSES) {
      for (const profileStatus of PROFILE_STATUSES) {
        for (const onboardingCompleted of ONBOARDING) {
          expect(known).toContain(sessionRoute({ status, profileStatus, onboardingCompleted }));
        }
      }
    }
  });
});

describe("profileLoad", () => {
  const row = { id: "abc", onboarding_completed: true };

  it("takes a row as a row", () => {
    expect(profileLoad({ data: row, error: null }, true)).toEqual({ kind: "loaded", profile: row });
  });

  it("treats any error as 'we do not know', never as an answer about the row", () => {
    expect(profileLoad({ data: null, error: { message: "Network request failed" } }, true)).toEqual({
      kind: "error",
      message: "Network request failed",
    });
  });

  it("reads an empty result as 'no profile' only when the read was confirmably this user's", () => {
    expect(profileLoad({ data: null, error: null }, true)).toEqual({ kind: "missing" });
  });

  it("refuses to call an unconfirmed empty read 'missing'", () => {
    // THE BLOCKER THIS PINS. A failed token refresh leaves auth-js holding the session but
    // answering `{ session: null }`, so supabase-js sends the select under the ANON key.
    // profiles_select_own is `auth.uid() = id`, so PostgREST answers 200 with `[]` -- byte for
    // byte what a real profile-less Apple account looks like. Believing it clears a good
    // profile and drops a months-old account onto "Confirm your age", where the only RPC on
    // offer is revoked from anon. "error" keeps the profile and retries instead.
    expect(profileLoad({ data: null, error: null }, false)).toEqual({
      kind: "error",
      message: UNCONFIRMED_READ_MESSAGE,
    });
  });

  it("never turns an unconfirmed read into a request for a date of birth", () => {
    // The rule, joined to the router it exists to protect.
    const load = profileLoad({ data: null, error: null }, false);
    const next = nextProfileState(load, row);
    expect(next.profile).toBe(row); // the held profile survives
    expect(
      sessionRoute({
        status: "signed_in",
        profileStatus: next.profileStatus,
        onboardingCompleted: next.profile?.onboarding_completed,
      }),
    ).not.toBe("complete-signup");
  });

  it("still finds a genuinely profile-less account, which is the state the age gate exists for", () => {
    const next = nextProfileState(profileLoad({ data: null, error: null }, true), null);
    expect(
      sessionRoute({ status: "signed_in", profileStatus: next.profileStatus, onboardingCompleted: undefined }),
    ).toBe("complete-signup");
  });
});

describe("nextProfileState", () => {
  const held = { id: "abc", onboarding_completed: true };

  it("takes the row when one comes back", () => {
    expect(nextProfileState({ kind: "loaded", profile: held }, null)).toEqual({
      profile: held,
      profileStatus: "loaded",
    });
  });

  it("replaces a stale row with the one that just landed", () => {
    const fresh = { id: "abc", onboarding_completed: false };
    expect(nextProfileState({ kind: "loaded", profile: fresh }, held)).toEqual({
      profile: fresh,
      profileStatus: "loaded",
    });
  });

  it("clears the profile only on an authoritative zero-row answer", () => {
    expect(nextProfileState({ kind: "missing" }, held)).toEqual({ profile: null, profileStatus: "missing" });
  });

  // The bug: `set({ profile })` with whatever loadProfile returned, so one failed fetch made a
  // real account look profile-less to every guard in the app.
  it("keeps a good profile when the read fails", () => {
    expect(nextProfileState({ kind: "error", message: "Network request failed" }, held)).toEqual({
      profile: held,
      profileStatus: "error",
    });
  });

  it("still reports the failure when there was nothing held to keep", () => {
    expect(nextProfileState({ kind: "error", message: "boom" }, null)).toEqual({
      profile: null,
      profileStatus: "error",
    });
  });

  it("keeps the two halves of its answer consistent with each other", () => {
    // profileStatus is what routing reads and `profile` is what twenty screens read. A state
    // that said "missing" while still holding a row, or "loaded" while holding null, would send
    // somebody to the age gate with their own profile rendered behind it.
    const loaded = nextProfileState({ kind: "loaded", profile: held }, null);
    expect(loaded.profileStatus === "loaded" && loaded.profile !== null).toBe(true);
    const missing = nextProfileState({ kind: "missing" }, held);
    expect(missing.profileStatus === "missing" && missing.profile === null).toBe(true);
  });

  it("never answers with a state that routes to the age gate on a failed read", () => {
    // The store's write and the router's read, joined up: whatever a failure does to the store,
    // sessionRoute must not turn it into a request for a date of birth.
    for (const held_ of [held, null]) {
      const next = nextProfileState({ kind: "error", message: "Network request failed" }, held_);
      expect(
        sessionRoute({
          status: "signed_in",
          profileStatus: next.profileStatus,
          onboardingCompleted: next.profile?.onboarding_completed,
        }),
      ).not.toBe("complete-signup");
    }
  });
});
