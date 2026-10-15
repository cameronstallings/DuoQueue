import { CXA, CY, R, VB_W, VB_X, VB_Y, W } from "../../theme/logo-geometry";

/**
 * The match moment's rules. Pure, relative imports only (matchMoment.test.ts).
 *
 * No RPC returns pair facts for a match (lol_solo_duo_eligible is revoked from clients, and
 * build 12 adds no server work), so the screen that made the match passes what it knows as
 * route params: "duo" when get_deck said the pair can duo, "common" when it knows the count.
 */

/** How far each ring starts from its locked place, in the mark's own viewBox units. The
 * duoqueue.io match card slides the same distance, so the site and the app tell one moment. */
export const RING_TRAVEL_UNITS = 190;

export function ringTravel(markWidth: number): number {
  return RING_TRAVEL_UNITS * (markWidth / VB_W);
}

/** How long the rings take to slide together in DUO LOCKED. (The launch intro rushes them on a
 * spring instead: launchTiming.ts.) */
export const RINGS_MS = 520;
/** DUO LOCKED's ring curve, as Easing.bezier's four arguments: ease-in-out with no overshoot, so
 * there the brackets carry all the overshoot. Matches the site. The weave only reads right while
 * the rings' centres are 1.3R to 1.52R apart, which is the limit on any overshoot: the launch
 * intro's spring does rebound past the lock, to 1.32R at its deepest, and settles back through
 * 1.52R no further out than 1.517R (launchTiming.test.ts holds it to both). */
export const RING_BEZIER = [0.65, 0, 0.35, 1] as const;

/** The weave's limits: the rings' centres, in ring radii, while the weave is drawn. */
export const WEAVE_MIN_CENTRES_R = 1.3;
export const WEAVE_MAX_CENTRES_R = 1.52;

// DUO LOCKED's brackets, which the launch intro also draws (scaled to its mark by
// LAUNCH_MARK_W / MATCH_MARK_W), so the two moments close the same "[ ]".

/** The rings' width on the match screen, in points. */
export const MATCH_MARK_W = 168;
/** The "[" and "]": IBM Plex Mono SemiBold at this size, in volt, drawn from the font's outlines
 * (LockBrackets.tsx), not set as Text. */
export const BRACKET_SIZE = 96;
/** Room each side of the rings for a bracket glyph. Measured from the Plex Mono SemiBold outlines
 * against the mark's geometry: at 36 the "]" lower arm crosses the Q's tail (the nub) by ~6pt at
 * rest and ~10pt at the spring's peak (10% of BRACKET_TRAVEL). 52 leaves ~9.6pt at rest and
 * ~5.5pt at the peak, and the 272pt box still fits a 320pt-wide iPhone inside the 24pt gutters. */
export const BRACKET_SIDE = 52;
/** How far out each bracket starts, in points. */
export const BRACKET_TRAVEL = 40;
/** Full config on purpose: Reanimated 4 merges a partial config over mass 4 / stiffness 900,
 * which turned the old { damping: 14 } into a five-second wobble with a late flash. This one is
 * a damping ratio of ~0.59: ~10% overshoot, settled in under a second. */
export const BRACKET_SPRING = { mass: 1, stiffness: 420, damping: 24 } as const;
/** The brackets fade in over this long (withTiming's default ease) as they set off. */
export const BRACKET_FADE_MS = 140;

// Type aliases, not interfaces: expo-router's params want index-signature-compatible objects.
// `popped` is a Duo Pop's popped-in time in whole seconds, as a string (parsePoppedSeconds).
export type MatchRouteParams = {
  matchId: string;
  name?: string;
  photo?: string;
  duo?: string;
  common?: string;
  popped?: string;
};
export type MatchPushParams = { matchId: string; name: string; photo: string; duo?: "1"; common?: string; popped?: string };

export interface MatchFacts {
  matchId: string;
  name: string;
  /** Their picture (cardPicture), or null. */
  photo: string | null;
  /** showsDuoLabel(card). Only get_deck rows can make this true. */
  canDuo: boolean;
  /** Games you both play where the screen knows it; null where it does not. */
  sharedGames: number | null;
  /** How long a Duo Pop took to be answered, in whole seconds (1 to 600), when this match came
   * from one (the sender's DUO LOCKED). Optional, so every other caller is unchanged. */
  poppedInSeconds?: number | null;
}

/** A Duo Pop lasts ten minutes, so it can never have popped in longer than this. */
export const POPPED_IN_MAX_SECONDS = 600;

function isPoppedSeconds(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= POPPED_IN_MAX_SECONDS;
}

export function matchParams(f: MatchFacts): MatchPushParams {
  return {
    matchId: f.matchId,
    name: f.name,
    photo: f.photo ?? "",
    ...(f.canDuo ? { duo: "1" as const } : {}),
    ...(f.sharedGames !== null && f.sharedGames > 0 ? { common: String(Math.trunc(f.sharedGames)) } : {}),
    // The server sends whole seconds clamped to 1..600; anything else is dropped rather than
    // stamped on the screen.
    ...(isPoppedSeconds(f.poppedInSeconds) ? { popped: String(f.poppedInSeconds) } : {}),
  };
}

/**
 * A popped-in time from a route param or a push's data, or null. Takes `unknown` because the
 * push routing (notificationRouting.ts) hands it raw notification data. Accepts only a string of
 * digits or a whole number, from 1 to 600: "41" and 41, never "4.1", " 41", "1e2" or 0.
 */
export function parsePoppedSeconds(raw: unknown): number | null {
  if (typeof raw === "number") return isPoppedSeconds(raw) ? raw : null;
  if (typeof raw !== "string" || !/^\d{1,3}$/.test(raw)) return null;
  const n = Number(raw);
  return isPoppedSeconds(n) ? n : null;
}

/** m:ss, for the ring's time left and the Popped-in stamp. Floors, and never goes below 0:00. */
export function formatClock(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest < 10 ? "0" : ""}${rest}`;
}

/** The stamp under DUO LOCKED after a Duo Pop ("Popped in 0:41"; type.label uppercases it). */
export function poppedInLabel(seconds: number): string {
  return `Popped in ${formatClock(seconds)}`;
}

/** "1 minute 15 seconds", "41 seconds", "10 minutes", "0 seconds". */
function spokenDuration(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  const minutes = m === 1 ? "1 minute" : `${m} minutes`;
  const secs = rest === 1 ? "1 second" : `${rest} seconds`;
  if (m === 0) return secs;
  if (rest === 0) return minutes;
  return `${minutes} ${secs}`;
}

/** What VoiceOver reads for the Popped-in stamp ("Popped in 1 minute 15 seconds"). */
export function poppedInSpoken(seconds: number): string {
  return `Popped in ${spokenDuration(seconds)}`;
}

/** What VoiceOver reads for the Duo Pop ring ("9 minutes 41 seconds left"). */
export function timeLeftSpoken(seconds: number): string {
  return `${spokenDuration(seconds)} left`;
}

/** One place in the rolling Popped-in digits: a digit column that rolls `cells` steps down a
 * strip of 0 to 9 twice (so it lands on `digit`), or a character that stands still. */
export type RollColumn = { kind: "digit"; digit: number; cells: number } | { kind: "static"; text: string };

/**
 * The Popped-in time as rolling columns. Every digit column starts on 0 and rolls to its digit;
 * the last one rolls a whole extra turn (10 more cells), so even "0:40" visibly spins before it
 * settles, the way a counter clicks into place.
 */
export function rollColumns(seconds: number): RollColumn[] {
  const chars = formatClock(seconds).split("");
  const lastDigit = chars.length - 1;
  return chars.map((char, i) => {
    if (char < "0" || char > "9") return { kind: "static", text: char };
    const digit = Number(char);
    return { kind: "digit", digit, cells: i === lastDigit ? digit + 10 : digit };
  });
}

/** How much of the Duo Pop ring is left: secondsLeft over totalSeconds, clamped to 0..1. */
export function countdownFraction(secondsLeft: number, totalSeconds: number): number {
  if (!(totalSeconds > 0)) return 0;
  return Math.min(1, Math.max(0, secondsLeft / totalSeconds));
}

// THE DUO POP RING. On the Pop card the countdown is drawn as the mark's own O ring: it sits in
// the middle of the mark while it drains, and when someone taps I'm in it closes and slides 31.5pt
// left into its place in the logo as the Q flies in from the right. These are the distances, at
// any mark width, from the mark's geometry (logo-geometry.ts).

/** The O ring's centre inside the mark's box, in points. */
export function oRingCentre(markWidth: number): { x: number; y: number } {
  const scale = markWidth / VB_W;
  return { x: (CXA - VB_X) * scale, y: (CY - VB_Y) * scale };
}

/** The O ring's hole, in points: where the ring's m:ss has to fit (64.7pt at 168). */
export function oRingInnerDiameter(markWidth: number): number {
  return (2 * R - W) * (markWidth / VB_W);
}

/** How far right of its locked place the O starts on the Pop card: the middle of the mark. */
export function popOFrom(markWidth: number): number {
  return markWidth / 2 - oRingCentre(markWidth).x;
}

/** How far right of its place the Q starts when the ring closes, in viewBox units. */
export const POP_Q_FROM_UNITS = 600;

export function popQFrom(markWidth: number): number {
  return POP_Q_FROM_UNITS * (markWidth / VB_W);
}

/** The sentence under the players: how the duo happened. */
export function lockSentence(name: string, popped: boolean): string {
  return popped ? `You and ${name} teamed up from a Duo Pop.` : `You and ${name} both queued up.`;
}

export const MATCH_REASON_COPY = { duo: "You can queue Ranked Solo/Duo" } as const;

export interface MatchReason {
  kind: "duo" | "common";
  text: string;
}

/** Facts only, never a score: "You can queue Ranked Solo/Duo", else "3 games in common", else nothing. */
export function matchReason(params: Pick<MatchRouteParams, "duo" | "common">): MatchReason | null {
  if (params.duo === "1") return { kind: "duo", text: MATCH_REASON_COPY.duo };
  const raw = params.common ?? "";
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (n <= 0) return null;
  return { kind: "common", text: n === 1 ? "1 game in common" : `${n} games in common` };
}

export type MatchExit = "keep-swiping" | "message";
export type MatchExitStep = "back" | "replace-with-tabs" | "replace-with-chat" | "push-chat";

/**
 * Where the two buttons go. The match screen is normally a sheet over the Deck, Requests or
 * Online now, so "Keep swiping" is a plain back and "Send a message" swaps the sheet for the chat.
 *
 * After an invite it is not over anything. invited.tsx replaces itself with this screen, and a new
 * player's stack holds nothing else (the onboarding wizard and the invite screen were replaced on
 * the way), so the match screen is the whole stack: back had nowhere to go, and the chat that
 * replaced it had no way out to the tabs. With nothing underneath, both go through the tabs.
 * expo-router queues the two steps and runs them in order.
 */
export function matchExitSteps(exit: MatchExit, canGoBack: boolean): MatchExitStep[] {
  if (exit === "keep-swiping") return canGoBack ? ["back"] : ["replace-with-tabs"];
  return canGoBack ? ["replace-with-chat"] : ["replace-with-tabs", "push-chat"];
}
