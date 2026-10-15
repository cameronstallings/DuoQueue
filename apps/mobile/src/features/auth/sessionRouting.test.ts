import { describe, expect, it } from "vitest";

import {
  type DraftRouteState,
  nextProfileState,
  profileLoad,
  sessionRoute,
  UNCONFIRMED_READ_MESSAGE,
  type ProfileStatus,
  type SessionRoute,
  type SessionRouteInput,
  type SessionStatus,
} from "./sessionRouting";

/** Hydrated, no draft, nothing pending: 1.0.1's world, where every old rule must still hold. */
const NO_DRAFT: DraftRouteState = { hydrated: true, ageConfirmed: false, commitPending: false };

const SIGNED_IN: SessionRouteInput = {
  status: "signed_in",
  profileStatus: "loaded",
  onboardingCompleted: true,
  draft: NO_DRAFT,
};

const STATUSES: SessionStatus[] = ["loading", "signed_out", "signed_in"];
const PROFILE_STATUSES: ProfileStatus[] = ["unknown", "loaded", "missing", "error"];
const ONBOARDING: (boolean | undefined)[] = [true, false, undefined];
const BOOLS = [true, false];

const DRAFTS: DraftRouteState[] = BOOLS.flatMap((hydrated) =>
  BOOLS.flatMap((ageConfirmed) => BOOLS.map((commitPending) => ({ hydrated, ageConfirmed, commitPending }))),
);

/** Every input the router can be handed: 3 x 4 x 3 x 8. */
function everyInput(): SessionRouteInput[] {
  return STATUSES.flatMap((status) =>
    PROFILE_STATUSES.flatMap((profileStatus) =>
      ONBOARDING.flatMap((onboardingCompleted) =>
        DRAFTS.map((draft) => ({ status, profileStatus, onboardingCompleted, draft })),
      ),
    ),
  );
}

/** The 1.0.1 inputs: draft hydrated, empty, nothing pending. */
function plain(status: SessionStatus, profileStatus: ProfileStatus, onboardingCompleted: boolean | undefined) {
  return sessionRoute({ status, profileStatus, onboardingCompleted, draft: NO_DRAFT });
}

describe("sessionRoute", () => {
  it("holds while the session is still being restored", () => {
    expect(plain("loading", "unknown", undefined)).toBe("hold");
  });

  it("sends a signed-out visitor with no draft to the front door", () => {
    expect(sessionRoute({ ...SIGNED_IN, status: "signed_out" })).toBe("start");
  });

  it("sends a signed-out visitor whose age is confirmed back into their draft", () => {
    expect(sessionRoute({ ...SIGNED_IN, status: "signed_out", draft: { ...NO_DRAFT, ageConfirmed: true } })).toBe(
      "draft",
    );
  });

  it("sends an authenticated session with no profile row to the age gate", () => {
    expect(plain("signed_in", "missing", undefined)).toBe("complete-signup");
  });

  it("routes a loaded profile on its own onboarding flag", () => {
    expect(sessionRoute({ ...SIGNED_IN, onboardingCompleted: false })).toBe("onboarding");
    expect(sessionRoute({ ...SIGNED_IN, onboardingCompleted: true })).toBe("app");
  });

  // The whole reason the store carries four states. `profile?.onboarding_completed` was falsy
  // for a missing profile too, so both went to the wizard, which then failed on a foreign key
  // ten screens later.
  it("does not confuse a missing profile with an unfinished one", () => {
    expect(plain("signed_in", "missing", undefined)).toBe("complete-signup");
    expect(plain("signed_in", "loaded", false)).toBe("onboarding");
  });

  // The failure this function exists to prevent: a user of six months, one dropped request,
  // and a screen asking them to prove they are 18 again.
  it("never routes a failed or unfinished read to the age gate", () => {
    for (const profileStatus of ["unknown", "error"] as ProfileStatus[]) {
      expect(plain("signed_in", profileStatus, undefined)).toBe("hold");
      expect(plain("signed_in", profileStatus, true)).toBe("app");
      expect(plain("signed_in", profileStatus, false)).toBe("onboarding");
    }
  });

  it("keeps somebody on the screen they are already on when a refresh fails", () => {
    expect(plain("signed_in", "error", true)).toBe("app");
  });

  it("holds rather than guessing when there is nothing to route on", () => {
    expect(plain("signed_in", "unknown", undefined)).toBe("hold");
  });

  it("asks about the session before it asks about the profile", () => {
    // A sign-out clears the session before the store resets profileStatus in the same call, and
    // an auth-state change for a different account arrives with the last account's answers still
    // in memory. Either way, "signed out" is the only true thing on screen at that moment.
    for (const profileStatus of PROFILE_STATUSES) {
      for (const onboardingCompleted of ONBOARDING) {
        expect(plain("signed_out", profileStatus, onboardingCompleted)).toBe("start");
        expect(plain("loading", profileStatus, onboardingCompleted)).toBe("hold");
      }
    }
  });
});

describe("sessionRoute with the draft (1.0.2)", () => {
  it("always holds until the draft has been read back from the phone", () => {
    // A guard that answered before the draft hydrated would send a player with a half-built
    // card to the front door, and its redirect would be the answer they see.
    for (const input of everyInput()) {
      if (!input.draft.hydrated) expect(sessionRoute(input)).toBe("hold");
    }
  });

  it("gives a signed-out visitor the draft iff their age is confirmed, whatever is pending", () => {
    for (const input of everyInput()) {
      if (input.status !== "signed_out" || !input.draft.hydrated) continue;
      expect(sessionRoute(input)).toBe(input.draft.ageConfirmed ? "draft" : "start");
    }
  });

  it("reaches the post-auth age gate iff signed in, missing, and no draft is on its way in", () => {
    // Stated as a property rather than a list, because this is the one answer that is expensive
    // in both directions: withholding it lets an age-unverified session into the app, and
    // volunteering it asks an existing user (or a draft that already holds a DOB) for it again.
    for (const input of everyInput()) {
      const expected =
        input.draft.hydrated &&
        input.status === "signed_in" &&
        input.profileStatus === "missing" &&
        !input.draft.commitPending;
      expect(sessionRoute(input) === "complete-signup").toBe(expected);
    }
  });

  it("never lets a profile-less session reach the app or the wizard", () => {
    for (const input of everyInput()) {
      if (input.status !== "signed_in" || input.profileStatus !== "missing") continue;
      // A missing row with a stale `onboardingCompleted: true` in memory and a pending commit is
      // the one combination that answers "app": it cannot happen (missing clears the profile),
      // and "app" is what lets the commit's cleanup discard the draft.
      if (input.draft.commitPending && input.onboardingCompleted === true) continue;
      expect(["app", "onboarding"]).not.toContain(sessionRoute(input));
    }
  });

  it("sends a pending commit to the commit screen until the card is finished, then to the app", () => {
    for (const input of everyInput()) {
      if (input.status !== "signed_in" || !input.draft.hydrated || !input.draft.commitPending) continue;
      expect(sessionRoute(input)).toBe(input.onboardingCompleted === true ? "app" : "commit-draft");
    }
  });

  it("never sends a draft's DOB to a second age gate", () => {
    // Save with a new Apple ID: signed in, no profile row yet, commit pending. The commit hands
    // `complete_signup` the draft's DOB itself.
    expect(
      sessionRoute({
        status: "signed_in",
        profileStatus: "missing",
        onboardingCompleted: undefined,
        draft: { hydrated: true, ageConfirmed: true, commitPending: true },
      }),
    ).toBe("commit-draft");
  });

  it("only ever answers with a destination the callers know", () => {
    // app/index.tsx renders or redirects once per answer. An eighth answer would fall through to
    // the tabs, which for an unknown state is the wrong default.
    const known: SessionRoute[] = ["hold", "start", "draft", "complete-signup", "commit-draft", "onboarding", "app"];
    for (const input of everyInput()) {
      expect(known).toContain(sessionRoute(input));
    }
  });

  it("answers app only for a finished card", () => {
    // Which is what makes discarding the draft there safe.
    for (const input of everyInput()) {
      if (sessionRoute(input) === "app") expect(input.onboardingCompleted).toBe(true);
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
    expect(plain("signed_in", next.profileStatus, next.profile?.onboarding_completed)).not.toBe("complete-signup");
  });

  it("still finds a genuinely profile-less account, which is the state the age gate exists for", () => {
    const next = nextProfileState(profileLoad({ data: null, error: null }, true), null);
    expect(plain("signed_in", next.profileStatus, undefined)).toBe("complete-signup");
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
      expect(plain("signed_in", next.profileStatus, next.profile?.onboarding_completed)).not.toBe("complete-signup");
    }
  });
});
