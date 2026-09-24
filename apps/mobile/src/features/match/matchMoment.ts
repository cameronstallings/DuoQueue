import { VB_W } from "../../theme/logo-geometry";

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
export type MatchRouteParams = { matchId: string; name?: string; photo?: string; duo?: string; common?: string };
export type MatchPushParams = { matchId: string; name: string; photo: string; duo?: "1"; common?: string };

export interface MatchFacts {
  matchId: string;
  name: string;
  /** Their picture (cardPicture), or null. */
  photo: string | null;
  /** showsDuoLabel(card). Only get_deck rows can make this true. */
  canDuo: boolean;
  /** Games you both play where the screen knows it; null where it does not. */
  sharedGames: number | null;
}

export function matchParams(f: MatchFacts): MatchPushParams {
  return {
    matchId: f.matchId,
    name: f.name,
    photo: f.photo ?? "",
    ...(f.canDuo ? { duo: "1" as const } : {}),
    ...(f.sharedGames !== null && f.sharedGames > 0 ? { common: String(Math.trunc(f.sharedGames)) } : {}),
  };
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
