/**
 * What the Appearance screen and the Settings row are allowed to say about the theme.
 *
 * Same shape `deckQueue.ts`, `emptyDeckDecisions.ts`, `notificationRouting.ts` and
 * `invite.ts` established: the part that can be WRONG without a component being involved,
 * lifted out where a test can reach it.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS AT ALL, WHEN THE LOGIC IS `===`
 * ============================================================================
 *
 * "System" is a real stored preference and `useTheme` still resolves it against the phone
 * exactly as it always did. What changed is that it is no longer NAMED anywhere in the UI:
 * it is the invisible default, and Light and Dark are overrides.
 *
 * That makes ONE mistake possible, and it is a quiet one. If either surface goes back to
 * reading the STORED preference instead of the RESOLVED scheme, a user on "system" sees no
 * row ticked on a screen whose whole job is to tell them what they are looking at, and the
 * Settings row prints a word for a state that is supposed to have no word. Nothing crashes
 * and no test fails, because the two states everyone actually tests -- explicitly pinned
 * light, explicitly pinned dark -- keep working.
 *
 * So the guard is the TYPE, not a comment and not a test. `ResolvedScheme` is deliberately
 * narrower than `ThemePreference`, and every function here takes it. Passing
 * `useThemeStore(s => s.preference)` into any of them is a compile error rather than a bug
 * somebody notices in a screenshot six weeks later. The `===` is the excuse; the signature
 * is the point.
 */

/**
 * What the app currently LOOKS LIKE. Never what is on disk.
 *
 * `useTheme().scheme` is the only correct source: it has already collapsed "system" against
 * the phone. Note there is no "system" member here on purpose, so the narrowing is enforced
 * at every call site.
 */
export type ResolvedScheme = "light" | "dark";

export interface AppearanceOption {
  readonly value: ResolvedScheme;
  readonly label: string;
}

/**
 * Two rows, and nothing else. Dark first because Volt is dark-first, so the common case is
 * the one your thumb lands on.
 *
 * There are no per-option hints, and their absence is load-bearing rather than an oversight.
 * The old copy read "Always dark, whatever your phone is set to", which is a FALSE sentence
 * to show a user on "system" whose phone happens to be dark: the row they see ticked would
 * be claiming to override something it is not overriding. With System unnamed, two one-word
 * rows need no explanation anyway.
 */
export const APPEARANCE_OPTIONS: readonly AppearanceOption[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

/**
 * Whether a row shows its tick. The argument is the RESOLVED scheme, which is why somebody
 * on "system" with a dark phone sees Dark ticked: it is simply true, the app is dark. They
 * are never told a third state exists, and they never need to know.
 */
export function isAppearanceOptionSelected(scheme: ResolvedScheme, value: ResolvedScheme): boolean {
  return scheme === value;
}

/**
 * The value printed on the Settings row, to the right of "Appearance".
 *
 * It is the same word the Appearance screen ticks, and that is a requirement rather than a
 * coincidence: a row that says one thing and a screen that ticks another is the exact bug
 * this indirection exists to prevent. A test pins the two together.
 */
export function appearanceSummary(scheme: ResolvedScheme): string {
  return scheme === "dark" ? "Dark" : "Light";
}
