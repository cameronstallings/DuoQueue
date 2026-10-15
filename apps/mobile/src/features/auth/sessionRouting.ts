/**
 * Where a session belongs, resolved to exactly one destination, plus the rule for what a
 * profile read is allowed to change.
 *
 * Extracted from the layouts that ask it (app/index.tsx, (tabs)/_layout.tsx,
 * (onboarding)/_layout.tsx, and since 1.0.2 every guard through `useSessionRoute()`, which is the
 * only caller outside tests) for the same reason `deckQueue.ts` and `invite.ts` were pulled
 * out of their hooks: this is a decision that can be WRONG in a way a user notices, and none
 * of it needs React, a session, or a Supabase project to be wrong.
 *
 * WHY IT GOT HARD. Until Sign in with Apple, a session implied a profile: `handle_new_user`
 * refused to create an account without a date of birth, and the only way to supply one was the
 * age gate that ran before sign-up. Apple's identity token carries no birthdate, so an Apple
 * account now arrives authenticated with nothing behind it, and the age gate runs after
 * authentication instead. "Signed in, no profile" is a real state, and it belongs on the age
 * gate.
 *
 * WHAT IT MUST NEVER BE CONFUSED WITH is a profile that failed to LOAD. Routing that one to
 * the age gate asks somebody who has been here for months to prove their age again, and hands
 * `complete_signup` a second date of birth for an account that already has one. A nullable
 * profile cannot tell those apart, which is why the store carries four states rather than a
 * row or null.
 */

export type SessionStatus = "loading" | "signed_out" | "signed_in";

export type ProfileStatus =
  /** No answer yet: the first read is in flight, or a new session has not been read at all. */
  | "unknown"
  /** The row came back. */
  | "loaded"
  /**
   * The read SUCCEEDED and there is no row. The only state allowed to reach the age gate.
   * It is trustworthy because `profiles_select_own` (0001_init.sql) is `auth.uid() = id` with
   * no join, so a session with no profile gets a clean empty result rather than a denial.
   */
  | "missing"
  /** The read failed: offline, an expired token, anything. Says nothing about whether a row exists. */
  | "error";

/** What one attempt to read the caller's own profile row came back with. */
export type ProfileLoad<P> =
  | { kind: "loaded"; profile: P }
  | { kind: "missing" }
  | { kind: "error"; message: string };

/** The two fields of a PostgREST `.maybeSingle()` answer that this decision reads. */
export interface ProfileRead<P> {
  data: P | null;
  error: { message: string } | null;
}

/** What "we could not confirm this read belonged to this user" is reported as. */
export const UNCONFIRMED_READ_MESSAGE = "Could not confirm the session for this read.";

/**
 * Turns one profile read into one verdict, and it is the second half of the rule that matters.
 *
 * The first half is obvious: an error is "we do not know", a row is "loaded", nothing is
 * "missing". The second half is not, and it is the whole reason this is a function rather than
 * three lines inside the store: AN EMPTY RESULT IS ONLY AUTHORITATIVE IF THE REQUEST WAS SENT
 * AS THIS USER.
 *
 * It is not always. When the access token has expired and the refresh POST fails with a
 * retryable network error, auth-js keeps the session and emits no SIGNED_OUT, but answers
 * `{ session: null }` internally -- and supabase-js's `_getAccessToken` then substitutes the
 * anon key. PostgREST runs the select as `anon`, `profiles_select_own` (`auth.uid() = id`)
 * matches nothing, and the reply is an ordinary 200 with `[]`, indistinguishable from a real
 * profile-less account.
 *
 * Believing it costs a real user their account for as long as it lasts: "missing" clears the
 * held profile, `sessionRoute` answers "complete-signup", and somebody who has been here for
 * months is shown "Confirm your age" -- on a screen whose only two buttons are an RPC that is
 * revoked from anon and a sign-out. `sessionConfirmed` is what stands between those two
 * readings, and false means "error", which keeps the profile and retries.
 */
export function profileLoad<P>(read: ProfileRead<P>, sessionConfirmed: boolean): ProfileLoad<P> {
  if (read.error) return { kind: "error", message: read.error.message };
  if (read.data !== null) return { kind: "loaded", profile: read.data };
  if (!sessionConfirmed) return { kind: "error", message: UNCONFIRMED_READ_MESSAGE };
  return { kind: "missing" };
}

/**
 * The three facts about the signed-out draft that routing needs (onboarding-store.ts holds the
 * draft; `useSessionRoute` reads these off it).
 */
export interface DraftRouteState {
  /** The persisted draft has been read back from the phone (or the 2 s fallback fired). */
  hydrated: boolean;
  /** The age gate has been passed: the draft holds a DOB. */
  ageConfirmed: boolean;
  /** Save (or sign-in) has asked for an account; the draft is to be committed to it. */
  commitPending: boolean;
}

export interface SessionRouteInput {
  status: SessionStatus;
  profileStatus: ProfileStatus;
  /**
   * `profile?.onboarding_completed`. `undefined` means no profile is held in memory —
   * either none was ever read, or the last read said there is none.
   */
  onboardingCompleted: boolean | undefined;
  /** Required, so no caller can route without asking about the draft. */
  draft: DraftRouteState;
}

export type SessionRoute =
  /** Nothing is known yet. Hold the frame. Never a redirect: a redirect is an answer. */
  | "hold"
  /** No session and no draft. The front door, (auth)/start. */
  | "start"
  /** No session, age confirmed: the card being built, resumed at its last step. */
  | "draft"
  /** Authenticated with no profile row: the age gate, which is the only thing that can make one. */
  | "complete-signup"
  /** Authenticated after Save: the draft is being written onto the account. Rendered at "/". */
  | "commit-draft"
  /** Profile exists, wizard unfinished. */
  | "onboarding"
  /** Onboarded. The app proper. */
  | "app";

/**
 * The single branch every entry point shares.
 *
 * 1.0.2: THE CARD IS BUILT SIGNED OUT. The age gate, the intro and all eight wizard steps run
 * with no session, every answer persisted on the phone (onboarding-store.ts), and the account is
 * created only at "Save your card" (D1). So a signed-out visitor is no longer one state: with no
 * draft they get the front door ("start"), and once the age gate has put a DOB in the draft they
 * belong in the draft ("draft"), wherever they left it.
 *
 * WHY commitPending EXISTS AND IS SET BEFORE THE AUTH CALL. `onAuthStateChange` fires INSIDE
 * `signInWithIdToken`, `signUp` and `verifyOtp`, before any of them resolve, and every guard
 * re-routes on that event. If the "this session is for the draft" flag were set after the call
 * returned, the guards would already have routed a brand new Apple account (no profile row) to a
 * second age gate, and an email account to the empty wizard. So Save sets it first, and it is
 * checked BEFORE "missing": a draft that already holds a DOB never meets the age gate twice; the
 * commit hands that DOB to `complete_signup` itself.
 *
 * "app" ALWAYS MEANS `onboarding_completed === true`, a pending commit included. That is what
 * makes discarding a left-over draft there safe: the account's card is finished, so nothing the
 * draft holds can still be needed.
 *
 * ORDER MATTERS. The draft must be hydrated before anything is answered, because a redirect made
 * from an empty draft that is about to be read back is an answer the player sees. "missing" is
 * checked before onboarding, because `profile?.onboarding_completed` is falsy for a missing
 * profile too, and the old shape sent both to the wizard. And a held profile still routes on an
 * "error" read: a blip during a refresh must not eject somebody from the screen they are on.
 */
export function sessionRoute(input: SessionRouteInput): SessionRoute {
  if (input.status === "loading") return "hold";
  if (!input.draft.hydrated) return "hold";
  if (input.status === "signed_out") return input.draft.ageConfirmed ? "draft" : "start";

  if (input.draft.commitPending) return input.onboardingCompleted === true ? "app" : "commit-draft";

  if (input.profileStatus === "missing") return "complete-signup";

  // "unknown" and "error" with nothing cached: we genuinely do not know which screen is
  // right, and both guesses are wrong for somebody. Hold, and let a retry answer it.
  if (input.onboardingCompleted === undefined) return "hold";

  return input.onboardingCompleted ? "app" : "onboarding";
}

/**
 * What a finished profile read is allowed to write into the store.
 *
 * A FAILED READ MUST NOT CLEAR A GOOD PROFILE. `refreshProfile` used to `set({ profile })` with
 * whatever came back, so one failed fetch — fired by the looking-now toggle, the privacy
 * screen, the welcome screen, or the auth listener — replaced a perfectly good profile with
 * null, and every guard in the app then believed the user had no account. `held` is returned
 * untouched on "error" for exactly that reason; only an authoritative "missing" clears it.
 */
export function nextProfileState<P>(
  load: ProfileLoad<P>,
  held: P | null,
): { profile: P | null; profileStatus: ProfileStatus } {
  switch (load.kind) {
    case "loaded":
      return { profile: load.profile, profileStatus: "loaded" };
    case "missing":
      return { profile: null, profileStatus: "missing" };
    case "error":
      return { profile: held, profileStatus: "error" };
  }
}
