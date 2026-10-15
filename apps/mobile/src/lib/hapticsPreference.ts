/**
 * How the Settings > Appearance > Haptics switch is stored on the phone. Pure, zero imports, so
 * the one rule that matters is tested in node: haptics are ON unless the player explicitly turned
 * them off. A missing value (a fresh install, everyone upgrading from 1.0.1), an empty string or
 * anything unrecognised reads as on; only the exact string "off" reads as off. That way a
 * corrupted or future value can never quietly take away something nobody switched off.
 *
 * The store that reads and writes it is `src/store/haptics-store.ts`; every haptic in the app
 * checks it through `src/lib/haptics.ts`.
 */

export const HAPTICS_STORAGE_KEY = "duoqueue.haptics-enabled";

/** The switch's words (Settings > Appearance) and the Appearance row's hint on the Settings tab.
 * Here, beside the rule, so the copy sweep in the test covers them. The Settings tab writes
 * `settingsHint` as a literal; the test reads that file and holds the two together. */
export const HAPTICS_COPY = {
  label: "Haptics",
  hint: "Small taps when you swipe, lock a duo or flip a switch.",
  settingsHint: "Light or dark, and haptics",
} as const;

export function parseHapticsPreference(raw: string | null | undefined): boolean {
  return raw !== "off";
}

export function serializeHapticsPreference(enabled: boolean): "on" | "off" {
  return enabled ? "on" : "off";
}
