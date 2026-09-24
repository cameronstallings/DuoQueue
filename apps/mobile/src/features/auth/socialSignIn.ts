/**
 * Which social providers are on, and the one sentence a failed Apple attempt is allowed to say.
 *
 * The flags used to be a single `SOCIAL_SIGN_IN_ENABLED` const inside sign-in.tsx. They are two
 * flags now, in a module both entry points can read, because the two providers are not one
 * decision:
 *
 * APPLE IS ON. The thing that kept it off was the age gate running BEFORE authentication:
 * Apple's identity token carries no birthdate, `handle_new_user` refused to create an account
 * without one, and an Apple signup therefore failed outright. The gate now runs after
 * authentication — an account with no profile row lands on it, and `complete_signup` is the one
 * thing that can create a profile — so the reason is gone.
 *
 * GOOGLE STAYS OFF, for two independent reasons. Guideline 4.8 is triggered by a THIRD-PARTY
 * login service, and Google Sign-In is one of the services Apple names; an app offering it must
 * also offer a qualifying equivalent, and this app's email and password form is not one, since
 * it is first-party and collects a real address. Sign in with Apple satisfies 4.8 by itself, so
 * Apple alone is compliant and Apple plus Google would make Apple mandatory rather than
 * optional. Second, and more prosaically: `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` is not set, so the
 * Google button would render disabled anyway. Turning this on means creating those credentials
 * AND giving Google's signup the same profile-less routing Apple now has, since Google's token
 * carries no birthdate either.
 *
 * Both are compile-time constants and this project has no EAS Update channel, so flipping
 * either one is a new build and a new submission. There is no way to turn Apple back off
 * remotely if it misbehaves in the wild; `app_config` would be the place to move this if that
 * ever matters more than the simplicity does.
 */
export const APPLE_SIGN_IN_ENABLED: boolean = true;
export const GOOGLE_SIGN_IN_ENABLED: boolean = false;

/**
 * Which of Apple's own button styles to draw on the current theme.
 *
 * Apple's design guidelines ask for the black button on white or light backgrounds and the
 * white button on dark ones, because a black button on a near-black screen is a hole rather than
 * a control. Volt is dark first, and its dark background is #0A0B09, so the black button this
 * used to draw everywhere was close to invisible on the default theme, which is also the theme a
 * reviewer sees first.
 *
 * Keyed on the same test `useTheme` uses to pick its palette (`scheme === "dark"`), so the button
 * can never disagree with the background it sits on. Returned as the enum's key rather than its
 * value so this module stays free of the native import and testable under vitest.
 */
export function appleButtonStyleFor(scheme: string | null | undefined): "WHITE" | "BLACK" {
  return scheme === "dark" ? "WHITE" : "BLACK";
}

/**
 * The user tapped Cancel on Apple's sheet. Not an error, and showing one for it is the fastest
 * way to make a working button look broken.
 */
export function isAppleCancellation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  return err.message.includes("ERR_REQUEST_CANCELED") || code === "ERR_REQUEST_CANCELED";
}

/**
 * What to show when Apple sign-in genuinely fails.
 *
 * The case worth naming: a raise inside `handle_new_user` — a banned identity, most likely — is
 * not passed through by GoTrue. It comes back as a generic "Database error saving new user",
 * which reads as an app bug and tells the user nothing they can act on. The message this maps
 * it to says the one useful thing instead, without confirming to a banned account that it was
 * recognised as one.
 */
export function appleSignInMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (raw.includes("Database error saving new user")) {
    return "We could not create an account for you. If you have signed up before, sign in with your email instead.";
  }
  if (raw.includes("identity token")) {
    return "Apple did not return a sign-in token. Please try again.";
  }
  return "Apple sign-in did not work. Please try again.";
}
