import type { ProfileStatus } from "@/features/auth/sessionRouting";

/**
 * What tapping a push should do, decided without React, expo-notifications or a router.
 *
 * The one import is type-only and erased at build, so this module still needs nothing at
 * runtime. `ProfileStatus` is shared with the session store rather than restated here,
 * because a second copy of that union is a copy that drifts.
 *
 * Same shape `deckQueue.ts` and `emptyDeckDecisions.ts` established: the part that can be
 * wrong is pure and tested, and the hook around it (`useNotificationTapRouting`) is a
 * listener, a ref and one `router.navigate`.
 *
 * WHY THIS IS NOT JUST `if (category === "new_player") navigate()`. There was no
 * `addNotificationResponseReceivedListener` anywhere in this app before now, so every push
 * has always resumed wherever the user left off. For the new-player ping that is wrong — the
 * entire promise of the notification is "open your deck and they are in it". But a tap can
 * arrive at a moment when navigating is the wrong move, and there are four of them:
 *
 *  1. NO NAVIGATOR YET. `RootLayout` renders null until the fonts resolve, so for the first
 *     few hundred milliseconds of a cold start there is no root navigator to navigate, and
 *     expo-router says so loudly. A tap is one of the ways to reach that window, because the
 *     tap is what started the app.
 *  2. COLD START. The tap is delivered before `session-store.initialize()` has resolved a
 *     session. Navigating then races the auth redirect in `app/index.tsx`; ignoring it drops
 *     the deep link entirely. Neither is acceptable, so this returns "wait" and the hook
 *     re-asks once the session settles.
 *  3. SIGNED OUT. There is nothing to route to, and `(tabs)` would bounce straight back out.
 *  4. MID-ONBOARDING. `(tabs)/_layout.tsx` redirects an incomplete profile into the wizard;
 *     a `router.navigate` fired in the same frame is just fighting it. Finishing onboarding
 *     lands on the deck anyway.
 */

/** The subset of the notification payload this decision reads. */
export interface NotificationTapInput {
  /** `data.category` from the push payload. Unknown shape by the time it reaches here — it
   *  crossed a network and an OS. */
  category: unknown;
  /** Whether `RootLayout` is past its font gate and actually rendering the `Stack`. */
  navigatorReady: boolean;
  sessionStatus: "loading" | "signed_out" | "signed_in";
  /**
   * What the store knows about the profile row, which `onboardingCompleted` cannot say on its
   * own: `undefined` covers both "the read has not landed" and "there is no row", and only one
   * of those is worth holding a tap for.
   */
  profileStatus: ProfileStatus;
  /** `profile.onboarding_completed`, or undefined while the profile row is still loading. */
  onboardingCompleted: boolean | undefined;
}

export type NotificationTapAction =
  /** Go to the deck, and refresh it on the way. */
  | "open-deck"
  /** This tap is for us but the app is not ready to be navigated yet. Hold it. */
  | "wait"
  /** Nothing to do. Not our category, or there is no deck to send anyone to. */
  | "ignore";

/**
 * Only `new_player` is routed. Every other category carries no id in its payload, so there is
 * nothing to route to without changing `send-push-notification`, and resuming where the user
 * left off is the correct behaviour for all of them.
 */
export function notificationTapAction(input: NotificationTapInput): NotificationTapAction {
  if (input.category !== "new_player") return "ignore";

  if (!input.navigatorReady) return "wait";
  if (input.sessionStatus === "loading") return "wait";
  if (input.sessionStatus === "signed_out") return "ignore";

  // Authenticated with no profile row: an Apple signup still sitting on the age gate. There is
  // no deck to open, and the age gate is where they belong, so this is a DROP and not a hold.
  // It has to come before the line below, which would otherwise return "wait" forever: for a
  // missing profile `onboardingCompleted` is undefined permanently, so the tap would be held by
  // a hook that re-asks on every store change and never released by any of them.
  //
  // Unreachable today only by accident — such a session has no push_tokens row, so it cannot be
  // sent a notification to tap — and an accident is not a guarantee. A tap held from BEFORE the
  // account changed hands, or from a build where registration happened earlier, arrives here.
  if (input.profileStatus === "missing") return "ignore";

  // Signed in, but the profile row has not arrived yet — we cannot tell whether onboarding is
  // done, and guessing either way is a wrong screen. Hold it; `refreshProfile` is already in
  // flight.
  if (input.onboardingCompleted === undefined) return "wait";
  if (!input.onboardingCompleted) return "ignore";

  return "open-deck";
}

/**
 * Whether a tap that has already been handled should be handled again: no.
 *
 * Expo delivers the same response twice in one real situation — the app was killed, the tap
 * relaunched it, and both `getLastNotificationResponseAsync()` (cold start) and the live
 * listener see it. It can also re-deliver the launching response on a later mount. Keying on
 * the request identifier makes "handle each tap once" a property of the code rather than of
 * how many times React happens to run an effect.
 *
 * A missing identifier resolves to "handle it": an unidentifiable tap is rarer than a dropped
 * one, and dropping the tap breaks the only thing the notification promised.
 */
export function shouldHandleTap(identifier: string | undefined, handled: ReadonlySet<string>): boolean {
  if (!identifier) return true;
  return !handled.has(identifier);
}
