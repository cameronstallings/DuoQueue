/**
 * The party LFG post, decided without React: what the party screen draws for a party of two
 * (nothing, a skeleton, Share LFG post, or the live post with Stop), what a code's preview says,
 * and where a join leads. Pure and tested (partyCall.test.ts); usePartyCall.ts only feeds it rows.
 *
 * THE FEATURE IN ONE PARAGRAPH. A party of two (a matched duo who started a party) can share a
 * plain-text LFG post with a code (0089's party_calls, minted from the same generator and alphabet
 * as invite and Duo Call codes). The code works for 2 hours, plus 15 minutes for anyone already
 * signing up. A new player enters it at the front door; an existing one in Matches. Whoever joins
 * first takes the last seat (join_party_by_code, under the party's row lock), and the code stops
 * working at once. Either member can stop the post. Nothing is ever posted by the app itself.
 *
 * SERVER NAMES, BEHIND ONE CONSTANT. 0089 is written in parallel with this client and applied
 * before build 20 goes to review, so every name below may not exist yet (PostgREST PGRST202) or
 * may be switched off (0089's kill switch revokes execute: 42501). Both hide the feature
 * (isPartyLfgUnavailable): the party screen is then exactly build 19's.
 */

export const PARTY_LFG_RPC = {
  /** start_party_call(p_party_id) returns (code, expires_at, game_id, game_name, already_live). */
  start: "start_party_call",
  /** get_party_call(p_party_id) returns (code, expires_at, game_id, game_name, sharer_id, sharer_name, mine). */
  get: "get_party_call",
  /** end_party_call(p_party_id) returns void. */
  end: "end_party_call",
  /** resolve_party_code(p_code) returns (status, sharer_name, game_name). Anon too. */
  resolve: "resolve_party_code",
  /** preview_party_code(p_code) returns (status, sharer_name, game_name, member_name, member_age). */
  preview: "preview_party_code",
  /** join_party_by_code(p_code) returns (result, party_id). */
  join: "join_party_by_code",
} as const;

/** 0089's PARTY_CALL_TTL: how long a party post's code works (plus CODE_GRACE for sign-ups). */
export const PARTY_CALL_TTL_MS = 2 * 60 * 60 * 1000;

/** A party code's state, as anyone can read it (resolve_party_code). */
export type PartyCodeStatus = "live" | "full" | "ended";

/** One row of get_party_call: the party's live post, as a member sees it. */
export interface PartyCallRow {
  code: string;
  expires_at: string;
  game_id: string | null;
  game_name: string | null;
  sharer_id: string;
  sharer_name: string | null;
  /** The viewer shared it. */
  mine: boolean;
}

/** One row of start_party_call. `already_live`: the party already had a live post (the other
 * member's, or a double tap), returned unchanged so both members share one code. */
export interface StartedPartyCall {
  code: string;
  expires_at: string;
  game_id: string | null;
  game_name: string | null;
  already_live: boolean;
}

/** One row of resolve_party_code. The sharer and the game come back only while live. */
export interface ResolvedPartyCode {
  status: PartyCodeStatus;
  sharer_name: string | null;
  game_name: string | null;
}

/** One row of preview_party_code: one per member while live and the caller may join, otherwise a
 * single row with only the status ("member" when the caller is already in the party). AGES STAY:
 * member_age is shown. */
export interface PartyCodePreviewRow {
  status: PartyCodeStatus | "unavailable" | "member";
  sharer_name: string | null;
  game_name: string | null;
  member_name: string | null;
  member_age: number | null;
}

export type PartyJoinResult = "joined" | "member" | "full" | "ended" | "unavailable";

/** One row of join_party_by_code. */
export interface PartyJoinRow {
  result: PartyJoinResult;
  party_id: string | null;
}

/** Why a party code has no seat for this player. */
export type PartyClosedStatus = "full" | "ended" | "unavailable";

/**
 * PGRST202 (0089 not live) or 42501 (its kill switch revoked execute): hide the feature. Anything
 * else (offline, a refusal) is an ordinary error the caller handles.
 */
export function isPartyLfgUnavailable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "PGRST202" || code === "42501";
}

export type PartyLfgView =
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "idle" }
  | {
      kind: "live";
      mine: boolean;
      /** Trimmed, or null when the server named nobody. */
      sharerName: string | null;
      code: string;
      gameId: string | null;
      gameName: string | null;
      untilMs: number;
    };

/**
 * What the party screen's LFG row shows.
 *  - hidden: the feature is unavailable or not known to be available yet (before 0089 the
 *    screen is build 19's exactly, with no skeleton that comes and goes), the members could not
 *    be read, the party is not exactly two (a full party has no seat to offer, and one player
 *    alone is not a party looking for a third), or there is no live post and the two cannot
 *    make one (partyPairCanPost: a Share that the server refuses every time is a dead button);
 *  - loading: the feature is known to be there and the members, the first read or the pair
 *    check are still coming (a skeleton the height of the button, never a spinner);
 *  - idle: no live post, so "Share LFG post";
 *  - live: the post, whose it is and until when, with Stop. A post whose time has passed on this
 *    phone's clock reads idle until the next read drops it.
 */
export function partyLfgView(input: {
  /** True or false once a read or the probe (usePartyLfgAvailability) has answered; null before. */
  available: boolean | null;
  pending: boolean;
  memberCount: number | null;
  /** The member list's read failed (and there is no earlier one). */
  membersFailed: boolean;
  /** partyPairCanPost: null while it cannot be told yet. */
  pairCanPost: boolean | null;
  call: PartyCallRow | null;
  nowMs: number;
}): PartyLfgView {
  if (input.available === false) return { kind: "hidden" };
  if (input.memberCount === null) {
    return input.membersFailed || input.available !== true ? { kind: "hidden" } : { kind: "loading" };
  }
  if (input.memberCount !== 2 || input.available !== true) return { kind: "hidden" };
  if (input.pending) return { kind: "loading" };
  const call = input.call;
  const untilMs = call ? Date.parse(call.expires_at) : Number.NaN;
  if (!call || !Number.isFinite(untilMs) || untilMs <= input.nowMs) {
    // No live post: Share only for a pair the server will let post. A live post (below) is
    // always shown, whatever this phone's pair check says, so its Stop is never out of reach.
    if (input.pairCanPost === false) return { kind: "hidden" };
    if (input.pairCanPost === null) return { kind: "loading" };
    return { kind: "idle" };
  }
  const name = call.sharer_name?.trim();
  return {
    kind: "live",
    mine: call.mine === true,
    sharerName: name ? name : null,
    code: call.code,
    gameId: call.game_id,
    gameName: call.game_name,
    untilMs,
  };
}

/**
 * Whether this party of two can make a post, as far as this phone can tell: 0089's
 * start_party_call only lets two players post who share a LIVE 1:1 match and are both ready
 * (active, onboarded, not banned or suspended). A party of two can be neither: a founder who
 * blocked the other founder after a third joined from the deck leaves the founder and the third,
 * who were never matched; the founders can unmatch; a member can pause their account. Without
 * this check Share was a button that failed every time.
 *
 *  - false: a member is hidden from this viewer (public_profiles drops exactly the not-ready
 *    accounts), or the match list has loaded and the other member is not in it (it lists live
 *    matches only, unmatched_at null);
 *  - true: both visible and the other member is a live match, or the match list failed (the
 *    server decides, and its refusal now reads true: partyLfgErrorMessage);
 *  - null: not known yet (the viewer, the members or the match list are still loading).
 */
export function partyPairCanPost(input: {
  myId: string | null | undefined;
  memberIds: readonly string[] | null;
  visibleCount: number;
  /** Every live match's other player, or null while the match list loads. */
  matchedIds: readonly string[] | null;
  matchesFailed: boolean;
}): boolean | null {
  if (!input.myId || !input.memberIds) return null;
  if (input.memberIds.length !== 2) return false;
  if (input.visibleCount < input.memberIds.length) return false;
  const other = input.memberIds.find((id) => id !== input.myId);
  if (!other) return false;
  if (input.matchedIds) return input.matchedIds.includes(other);
  return input.matchesFailed ? true : null;
}

/**
 * Matches > "Have a party code?": what resolve_party_code said about the typed code. An error is
 * its own answer, never "not found": offline or a timeout says nothing about the code, so the
 * field must not tell the player the code did not work (nor buzz an error), and the error is not
 * cached as an answer (the query throws, so the same code is asked again).
 *  - idle: no whole code typed;
 *  - checking: the question is out (including a retry after an error);
 *  - error: it could not be asked (failed, or paused because the phone is offline);
 *  - not-found: zero rows, or a status this app does not know;
 *  - found: live, full or ended.
 */
export type PartyCodeLookup =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "error" }
  | { kind: "not-found" }
  | { kind: "found"; row: ResolvedPartyCode };

export function partyCodeLookupState(input: {
  asked: boolean;
  /** The query's data: the row, null for not a party code, undefined before any answer. */
  data: ResolvedPartyCode | null | undefined;
  isError: boolean;
  isFetching: boolean;
  isPaused: boolean;
}): PartyCodeLookup {
  if (!input.asked) return { kind: "idle" };
  if (input.data !== undefined) {
    const row = input.data;
    return row && (row.status === "live" || row.status === "full" || row.status === "ended")
      ? { kind: "found", row }
      : { kind: "not-found" };
  }
  if (input.isPaused) return { kind: "error" };
  if (input.isFetching) return { kind: "checking" };
  return input.isError ? { kind: "error" } : { kind: "checking" };
}

export type PartyPreview =
  | {
      kind: "live";
      sharerName: string | null;
      gameName: string | null;
      members: { name: string; age: number | null }[];
    }
  /** Already in it (a member typed their own party's code): the arrival opens the chat. */
  | { kind: "member" }
  | { kind: "closed"; status: PartyClosedStatus };

/**
 * preview_party_code's rows, as the arrival screen draws them: the members (name and age) while
 * the post is live and this player may join, otherwise why not. Zero rows or a status this app
 * does not know reads as unavailable: the arrival only exists because the code resolved, so an
 * empty preview means it no longer applies to this player.
 */
export function partyPreviewOf(rows: readonly PartyCodePreviewRow[] | null | undefined): PartyPreview {
  const first = rows?.[0];
  if (!first) return { kind: "closed", status: "unavailable" };
  if (first.status === "member") return { kind: "member" };
  if (first.status === "full" || first.status === "ended" || first.status === "unavailable") {
    return { kind: "closed", status: first.status };
  }
  if (first.status !== "live") return { kind: "closed", status: "unavailable" };
  const sharer = first.sharer_name?.trim();
  const members = (rows ?? []).flatMap((r) => {
    const name = r.member_name?.trim();
    return name ? [{ name, age: r.member_age ?? null }] : [];
  });
  return { kind: "live", sharerName: sharer ? sharer : null, gameName: first.game_name ?? null, members };
}

export type PartyJoinOutcome = { kind: "open-chat"; partyId: string } | { kind: "closed"; status: PartyClosedStatus };

/**
 * join_party_by_code's answer: "joined" (the seat is theirs) and "member" (they already were) both
 * open the party chat; everything else says why there was no seat. A chat is only ever opened
 * with the id the server returned, lowercased as every party id in the app is.
 */
export function partyJoinOutcome(row: PartyJoinRow | null | undefined): PartyJoinOutcome {
  if (!row) return { kind: "closed", status: "unavailable" };
  if (row.result === "joined" || row.result === "member") {
    return row.party_id ? { kind: "open-chat", partyId: row.party_id.toLowerCase() } : { kind: "closed", status: "unavailable" };
  }
  if (row.result === "full" || row.result === "ended") return { kind: "closed", status: row.result };
  return { kind: "closed", status: "unavailable" };
}
