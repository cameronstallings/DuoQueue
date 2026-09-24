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
