/**
 * The Duo Pop's push category and sound, and the one rule for sound while the app is open.
 *
 * In the foreground only a Duo Pop makes a sound, because its ten-minute window is the whole
 * point: a pop heard a minute late is a pop someone else grabbed. Every other push (a match, a
 * message, a new player) stays a silent banner while the app is open, as it has been since 1.0.0;
 * the player is already looking at the app, and a chime on every message is noise.
 *
 * The category is "duo_pop" (the settings column that opts in stays `queue_pop`; a push never
 * carries that name). It is exported once, from here, so the foreground rule and the tap routing
 * (Group Q) can never disagree about the spelling.
 *
 * The sound file is bundled by the expo-notifications plugin's `sounds` option in app.json and
 * named by the server push as `sound: "duo-pop.wav"`. iOS falls back to the default chime, with no
 * error anywhere, when the name and the bundled file differ, so `pushSound.test.ts` checks the two.
 *
 * Pure on purpose (no imports): vitest runs it in node.
 */

export const DUO_POP_PUSH_CATEGORY = "duo_pop";

export const DUO_POP_SOUND_FILE = "duo-pop.wav";

/** True only for a push whose data is a plain object with `category === "duo_pop"`. */
export function shouldPlayForegroundSound(data: unknown): boolean {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  return (data as { category?: unknown }).category === DUO_POP_PUSH_CATEGORY;
}
