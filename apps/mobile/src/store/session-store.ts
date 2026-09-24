import type { Session } from "@supabase/supabase-js";
import type { ProfileRow } from "@duoqueue/shared-types";
import { create } from "zustand";

import { clearPendingDisplayName } from "@/features/auth/pendingDisplayName";
import {
  nextProfileState,
  profileLoad,
  UNCONFIRMED_READ_MESSAGE,
  type ProfileLoad,
  type ProfileStatus,
  type SessionStatus,
} from "@/features/auth/sessionRouting";
import { supabase } from "@/lib/supabase";
import { registerForPushNotifications } from "@/lib/notifications";
import { queryClient } from "@/lib/query-client";
import { configurePurchases, logOutPurchases } from "@/lib/revenuecat";
import { useOnboardingStore } from "@/store/onboarding-store";

export type { ProfileStatus, SessionStatus };

export interface CompleteSignupInput {
  /** YYYY-MM-DD, in the user's own local calendar. See `toIsoDate`. */
  dob: string;
  timezone: string;
  /** Optional prefill. Null is normal: the wizard's first step asks for a display name anyway. */
  displayName?: string | null;
}

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  profile: ProfileRow | null;
  /**
   * What we actually know about the profile, which `profile: null` alone could never say.
   * Only "missing" means "this account has no profile row" — every other null is a read that
   * has not landed or has failed. Routing reads this; see features/auth/sessionRouting.ts.
   */
  profileStatus: ProfileStatus;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /**
   * Creates the profile (and its preferences, notification settings and vibe rows) for an
   * account that authenticated without one — the Sign in with Apple path. Throws whatever
   * `complete_signup` raised; callers map it with `completeSignupOutcome`.
   */
  completeSignup: (input: CompleteSignupInput) => Promise<void>;
  signOut: () => Promise<void>;
}

/**
 * `.maybeSingle()`, not `.single()`.
 *
 * `.single()` reports zero rows as an ERROR (PGRST116), which is why the old shape collapsed
 * "this account has no profile" and "the request failed" into the same `return null` and made
 * the difference unrepresentable. `.maybeSingle()` gives `{ data: null, error: null }` for zero
 * rows, so "missing" needs no magic string and ANY error is honestly "we do not know".
 *
 * The distinction is only trustworthy because `profiles_select_own` (0001_init.sql) is
 * `auth.uid() = id` with no join back to profiles: a session with no profile row gets a clean
 * empty result set rather than a permission denial. That fact is load-bearing for the whole
 * post-auth age gate.
 *
 * ============================================================================
 * WHY AN EMPTY RESULT IS NOT ENOUGH ON ITS OWN
 * ============================================================================
 *
 * An empty result set means "this user has no profile row" only if the request was actually
 * sent AS this user, and there is one ordinary situation where it is not. When the access
 * token has expired and the refresh POST fails with a retryable network error, auth-js
 * deliberately does NOT clear the session and emits no SIGNED_OUT -- but its internal
 * `__loadSession` still answers `{ session: null }`, and supabase-js's `fetchWithAuth` then
 * falls back to `Authorization: Bearer <anon key>`. PostgREST runs the select as `anon`,
 * `auth.uid()` is null, `profiles_select_own` matches nothing, and the answer is a perfectly
 * ordinary HTTP 200 with `[]`. `.maybeSingle()` turns that into `{ data: null, error: null }`,
 * which is byte for byte what a genuinely profile-less Apple account looks like.
 *
 * The consequence is the worst one this store can produce: `nextProfileState` treats "missing"
 * as authoritative, so it CLEARS a good cached profile, `sessionRoute` answers
 * "complete-signup", and a user with a three-month-old account is thrown out of the app and
 * onto "Confirm your age". Nothing retries a "missing" read, so they stay there; and if they
 * answer, `complete_signup` is revoked from anon, so the age gate fails too. The trigger is
 * mundane -- background the app past the token's lifetime (RootLayout stops auto-refresh),
 * foreground it somewhere with no signal, and auth-js then caches that failure for a full
 * minute before it will even try again.
 *
 * So "missing" is only returned when the session is confirmed to be this user's on BOTH sides
 * of the read. Either check alone would be very nearly enough and neither is quite: the one
 * before is what makes the request go out authenticated at all (`getSession()` refreshes
 * proactively inside the expiry margin, so a success there means the very next call has a live
 * token), and the one after catches a token that lapsed while the request was in flight. Two
 * local reads of an already-persisted session is a cheap price for never again telling a
 * three-month-old account that it does not exist.
 *
 * `getSession()` is not an approximation of what the request does, it is LITERALLY the call the
 * request makes: `SupabaseClient._getSessionToken` is `(await this.auth.getSession()).data
 * .session?.access_token ?? null`, and `_getAccessToken` substitutes the anon key when that is
 * null. Asking the same question is what makes the answer trustworthy, and it is why this adds
 * no new locking or refresh behaviour -- it is a second call to something the select already
 * calls once.
 *
 * A mismatch on either side is "error", not "missing": it keeps the held profile and puts the
 * read on the retry timer, which is exactly what a transient token failure deserves.
 */
async function loadProfile(userId: string): Promise<ProfileLoad<ProfileRow>> {
  // Before: if there is no live session, the request would go out under the anon key and come
  // back empty, so there is no point making it.
  if (!(await hasSessionFor(userId))) {
    console.warn("Skipping a profile read with no live session — this is not evidence of a missing row.");
    return { kind: "error", message: UNCONFIRMED_READ_MESSAGE };
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) console.warn("Failed to load profile:", error.message);

  // After, and ONLY on the empty path: a row or an error is already an answer about this user,
  // so neither pays for the second check. An empty result is the one reading that a lapsed
  // token can forge, so it is the one that has to be corroborated.
  const sessionConfirmed = data !== null || error !== null ? true : await hasSessionFor(userId);
  if (!sessionConfirmed) {
    console.warn("Empty profile read with no live session — treating as unknown, not missing.");
  }

  return profileLoad<ProfileRow>({ data: (data ?? null) as ProfileRow | null, error }, sessionConfirmed);
}

async function hasSessionFor(userId: string): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user.id === userId;
  } catch (err) {
    // getSession does not normally throw. If it ever does, "we do not know" is the only honest
    // answer, and it is the one that cannot eject somebody from their account.
    console.warn("getSession failed while checking a profile read:", err);
    return false;
  }
}

/** Runs the moment a session exists. Nothing here may touch `profiles` — there may not be one. */
function onAuthenticated(userId: string): void {
  configurePurchases(userId);
}

/**
 * Runs the first time a profile row is confirmed for this user in this JS runtime.
 *
 * Both of these used to fire on the auth-state change instead, which was fine while a session
 * implied a profile and is wrong now. `push_tokens.profile_id` references `profiles(id)`, so
 * for an Apple session the upsert failed with a foreign-key violation that `notifications.ts`
 * swallows as a console.warn — the user finished signup with no push token, and
 * `get_new_player_alert_batch` requires one before a recipient is eligible at all, so they were
 * silently excluded from every new-player sweep until the next cold start. Registering here
 * instead also stops the iOS permission prompt (which the OS shows exactly once per install)
 * from being spent before the user has even confirmed their age.
 *
 * It is also where the name Apple shared at sign-in is dropped from the phone. That value is
 * written on EVERY Apple sign-in, before the token exchange, because a brand-new account needs
 * it on the age gate. But an Apple sign-in that lands on an account which already has a profile
 * (a returning user, or one linked to an existing email account) never shows the age gate, so
 * nothing on that path ever spent or cleared it, and a name sat in AsyncStorage indefinitely. A
 * profile existing means the one screen that reads it can no longer be reached, so this is the
 * moment it stops having a reason to exist.
 */
let profileReadyFor: string | null = null;

function onProfileReady(userId: string): void {
  if (profileReadyFor === userId) return;
  profileReadyFor = userId;
  void clearPendingDisplayName();
  void registerForPushNotifications(userId);
  void supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId)
    .then(({ error }) => {
      if (error) console.warn("Failed to update last_active_at:", error.message);
    });
}

/**
 * A failed read leaves the app holding a frame (see `sessionRoute`), and a held frame with
 * nothing behind it is a blank screen until the app is force-quit. This is what makes it
 * self-healing: come back from a tunnel and the profile resolves itself.
 */
const PROFILE_RETRY_MS = 3000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleProfileRetry(run: () => void): void {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    run();
  }, PROFILE_RETRY_MS);
}

function cancelProfileRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: "loading",
  session: null,
  profile: null,
  profileStatus: "unknown",

  initialize: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      // Read the profile BEFORE flipping status, so there is no frame where the app is
      // signed in with an unknown profile and every guard has to guess.
      const load = await loadProfile(session.user.id);
      set({ session, status: "signed_in", ...nextProfileState(load, null) });
      onAuthenticated(session.user.id);
      if (load.kind === "loaded") onProfileReady(session.user.id);
      if (load.kind === "error") scheduleProfileRetry(() => void get().refreshProfile());
    } else {
      set({ session: null, profile: null, profileStatus: "unknown", status: "signed_out" });
    }

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (nextSession) {
        // A different account on the same JS runtime must not inherit the last one's profile
        // for even a frame — routing would run for the wrong user.
        const switched = get().session?.user.id !== nextSession.user.id;
        if (switched) {
          cancelProfileRetry();
          profileReadyFor = null;
          set({ session: nextSession, status: "signed_in", profile: null, profileStatus: "unknown" });
        } else {
          set({ session: nextSession, status: "signed_in" });
        }
        onAuthenticated(nextSession.user.id);
        void get().refreshProfile();
      } else {
        cancelProfileRetry();
        profileReadyFor = null;
        set({ session: null, profile: null, profileStatus: "unknown", status: "signed_out" });
      }
    });
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session) return;
    const load = await loadProfile(session.user.id);

    // The account can change while a read is in flight (a sign-out, or a second account signing
    // in). Applying a stale answer would hand one user's routing another user's profile.
    const current = get().session;
    if (!current || current.user.id !== session.user.id) return;

    set(nextProfileState(load, get().profile));

    if (load.kind === "error") {
      scheduleProfileRetry(() => void get().refreshProfile());
      return;
    }
    cancelProfileRetry();
    if (load.kind === "loaded") onProfileReady(session.user.id);
  },

  completeSignup: async ({ dob, timezone, displayName }) => {
    const { session } = get();
    if (!session) throw new Error("Not signed in.");

    // SECURITY DEFINER, and the only client-reachable thing that can write profiles.dob:
    // `profiles` has no INSERT policy and its UPDATE allow-list excludes dob, so the client
    // genuinely cannot create or age-rewrite its own row. Everything it needs beyond these
    // three arguments (the email for the ban check, the caller's id) it derives server-side.
    const { error } = await supabase.rpc("complete_signup", {
      p_dob: dob,
      p_timezone: timezone,
      p_display_name: displayName ?? null,
    });
    if (error) throw error;

    // Not optional: this is what flips profileStatus to "loaded", which is what lets routing
    // leave the age gate, and what finally runs the push-token registration that had no
    // profile row to hang off earlier.
    await get().refreshProfile();
  },

  signOut: async () => {
    // Reset local state even if the server-side calls fail (e.g. after account
    // deletion, the user no longer exists server-side to sign out).
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("supabase.auth.signOut failed:", err);
    }
    try {
      await logOutPurchases();
    } catch (err) {
      console.warn("logOutPurchases failed:", err);
    }
    cancelProfileRetry();
    profileReadyFor = null;
    set({ session: null, profile: null, profileStatus: "unknown", status: "signed_out" });
    // Account-scoped query cache (matches, deck, standouts, admirers, etc.) must not
    // leak to whoever signs in next on this same JS runtime.
    queryClient.clear();
    // Leftover onboarding wizard state (photos, games, prompts) shouldn't resurface
    // if this device onboards a different account next.
    useOnboardingStore.getState().reset();
  },
}));
