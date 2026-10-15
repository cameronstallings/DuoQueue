import { describe, expect, it } from "vitest";

import {
  isPartyLfgUnavailable,
  PARTY_CALL_TTL_MS,
  PARTY_LFG_RPC,
  partyCodeLookupState,
  partyJoinOutcome,
  partyLfgView,
  partyPairCanPost,
  partyPreviewOf,
  type PartyCallRow,
  type PartyCodePreviewRow,
  type ResolvedPartyCode,
} from "./partyCall";

const NOW = Date.parse("2026-10-15T22:00:00.000Z");
const HOUR = 60 * 60_000;

function call(over: Partial<PartyCallRow> = {}): PartyCallRow {
  return {
    code: "K7Q2M9XA4P",
    expires_at: new Date(NOW + HOUR).toISOString(),
    game_id: "1f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b",
    game_name: "League of Legends",
    sharer_id: "a",
    sharer_name: "Sam",
    mine: true,
    ...over,
  };
}

const base = {
  available: true as boolean | null,
  pending: false,
  memberCount: 2 as number | null,
  membersFailed: false,
  pairCanPost: true as boolean | null,
  call: null as PartyCallRow | null,
  nowMs: NOW,
};

describe("the server names this feature depends on", () => {
  it("names every 0089 RPC in one place", () => {
    expect(PARTY_LFG_RPC).toEqual({
      start: "start_party_call",
      get: "get_party_call",
      end: "end_party_call",
      resolve: "resolve_party_code",
      preview: "preview_party_code",
      join: "join_party_by_code",
    });
    expect(PARTY_CALL_TTL_MS).toBe(2 * HOUR);
  });

  it("hides the feature for a missing function or a revoked grant (the kill switch), nothing else", () => {
    expect(isPartyLfgUnavailable({ code: "PGRST202", message: "Could not find the function" })).toBe(true);
    expect(isPartyLfgUnavailable({ code: "42501", message: "permission denied for function get_party_call" })).toBe(
      true,
    );
    expect(isPartyLfgUnavailable({ code: "P0001", message: "Not a party member" })).toBe(false);
    expect(isPartyLfgUnavailable(new TypeError("Network request failed"))).toBe(false);
    expect(isPartyLfgUnavailable(null)).toBe(false);
  });
});

describe("partyLfgView", () => {
  it("is hidden while unavailable, and unless the party is exactly two", () => {
    expect(partyLfgView({ ...base, available: false })).toEqual({ kind: "hidden" });
    expect(partyLfgView({ ...base, memberCount: 3 })).toEqual({ kind: "hidden" });
    expect(partyLfgView({ ...base, memberCount: 1 })).toEqual({ kind: "hidden" });
    expect(partyLfgView({ ...base, memberCount: 0, call: call() })).toEqual({ kind: "hidden" });
  });

  it("waits (a skeleton) while the members, the first read or the pair check are pending", () => {
    expect(partyLfgView({ ...base, memberCount: null })).toEqual({ kind: "loading" });
    expect(partyLfgView({ ...base, pending: true })).toEqual({ kind: "loading" });
    expect(partyLfgView({ ...base, pairCanPost: null })).toEqual({ kind: "loading" });
  });

  it("draws nothing, not a skeleton, until the feature is known to be there", () => {
    // Before 0089: no skeleton that comes and goes, so the screen is build 19's exactly.
    expect(partyLfgView({ ...base, available: null, memberCount: null })).toEqual({ kind: "hidden" });
    expect(partyLfgView({ ...base, available: null, pending: true })).toEqual({ kind: "hidden" });
    expect(partyLfgView({ ...base, available: null })).toEqual({ kind: "hidden" });
  });

  it("hides when the members could not be read, instead of a skeleton that never goes", () => {
    expect(partyLfgView({ ...base, memberCount: null, membersFailed: true })).toEqual({ kind: "hidden" });
  });

  it("hides Share for a pair the server will not let post", () => {
    expect(partyLfgView({ ...base, pairCanPost: false })).toEqual({ kind: "hidden" });
    expect(
      partyLfgView({ ...base, pairCanPost: false, call: call({ expires_at: new Date(NOW).toISOString() }) }),
    ).toEqual({ kind: "hidden" });
  });

  it("still shows a live post, and its Stop, whatever the pair check says", () => {
    expect(partyLfgView({ ...base, pairCanPost: false, call: call() })).toMatchObject({ kind: "live" });
    expect(partyLfgView({ ...base, pairCanPost: null, call: call() })).toMatchObject({ kind: "live" });
  });

  it("is idle with no live post", () => {
    expect(partyLfgView(base)).toEqual({ kind: "idle" });
  });

  it("is live, mine or the other member's, with when it stops", () => {
    expect(partyLfgView({ ...base, call: call() })).toEqual({
      kind: "live",
      mine: true,
      sharerName: "Sam",
      code: "K7Q2M9XA4P",
      gameId: "1f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b",
      gameName: "League of Legends",
      untilMs: NOW + HOUR,
    });
    expect(partyLfgView({ ...base, call: call({ mine: false, sharer_name: "  " }) })).toMatchObject({
      kind: "live",
      mine: false,
      sharerName: null,
    });
  });

  it("reads a post past its time, or with a broken time, as idle", () => {
    expect(partyLfgView({ ...base, call: call({ expires_at: new Date(NOW).toISOString() }) })).toEqual({
      kind: "idle",
    });
    expect(partyLfgView({ ...base, call: call({ expires_at: "garbage" }) })).toEqual({ kind: "idle" });
  });
});

describe("partyPairCanPost (0089's who can post, as far as the phone can tell)", () => {
  const pair = { myId: "me", memberIds: ["me", "them"], visibleCount: 2, matchedIds: ["them", "x"], matchesFailed: false };

  it("lets two visible players who are a live match post", () => {
    expect(partyPairCanPost(pair)).toBe(true);
  });

  it("refuses a pair that is not a live match (a founder and a deck third left after a block, or an unmatch)", () => {
    expect(partyPairCanPost({ ...pair, matchedIds: ["x"] })).toBe(false);
    expect(partyPairCanPost({ ...pair, matchedIds: [] })).toBe(false);
  });

  it("refuses a pair with a member this viewer cannot see (paused, banned, suspended, not set up)", () => {
    expect(partyPairCanPost({ ...pair, visibleCount: 1 })).toBe(false);
  });

  it("refuses anything but two", () => {
    expect(partyPairCanPost({ ...pair, memberIds: ["me"] })).toBe(false);
    expect(partyPairCanPost({ ...pair, memberIds: ["me", "them", "x"], visibleCount: 3 })).toBe(false);
  });

  it("does not know yet while the viewer, the members or the match list are loading", () => {
    expect(partyPairCanPost({ ...pair, myId: undefined })).toBeNull();
    expect(partyPairCanPost({ ...pair, memberIds: null })).toBeNull();
    expect(partyPairCanPost({ ...pair, matchedIds: null })).toBeNull();
  });

  it("leaves it to the server when the match list failed", () => {
    expect(partyPairCanPost({ ...pair, matchedIds: null, matchesFailed: true })).toBe(true);
  });
});

describe("partyCodeLookupState (Matches > Have a party code?)", () => {
  const idle = { asked: true, data: undefined, isError: false, isFetching: false, isPaused: false };
  const row = (status: ResolvedPartyCode["status"]): ResolvedPartyCode => ({
    status,
    sharer_name: "Sam",
    game_name: "League of Legends",
  });

  it("is idle until a whole code is typed", () => {
    expect(partyCodeLookupState({ ...idle, asked: false })).toEqual({ kind: "idle" });
  });

  it("is checking while the question is out, a retry after an error included", () => {
    expect(partyCodeLookupState({ ...idle, isFetching: true })).toEqual({ kind: "checking" });
    expect(partyCodeLookupState({ ...idle, isFetching: true, isError: true })).toEqual({ kind: "checking" });
    expect(partyCodeLookupState(idle)).toEqual({ kind: "checking" });
  });

  it("keeps an error apart from not found: offline or a timeout says nothing about the code", () => {
    expect(partyCodeLookupState({ ...idle, isError: true })).toEqual({ kind: "error" });
    expect(partyCodeLookupState({ ...idle, isPaused: true })).toEqual({ kind: "error" });
  });

  it("is not found only for zero rows or a status this app does not know", () => {
    expect(partyCodeLookupState({ ...idle, data: null })).toEqual({ kind: "not-found" });
    expect(partyCodeLookupState({ ...idle, data: row("weird" as never) })).toEqual({ kind: "not-found" });
  });

  it("finds live, full and ended codes", () => {
    for (const status of ["live", "full", "ended"] as const) {
      expect(partyCodeLookupState({ ...idle, data: row(status) })).toEqual({ kind: "found", row: row(status) });
    }
  });
});

function member(name: string, age: number | null): PartyCodePreviewRow {
  return { status: "live", sharer_name: "Sam", game_name: "League of Legends", member_name: name, member_age: age };
}

describe("partyPreviewOf (preview_party_code)", () => {
  it("lists the members with their ages while the post is live (AGES STAY)", () => {
    expect(partyPreviewOf([member("Sam", 24), member("Alex", 27)])).toEqual({
      kind: "live",
      sharerName: "Sam",
      gameName: "League of Legends",
      members: [
        { name: "Sam", age: 24 },
        { name: "Alex", age: 27 },
      ],
    });
  });

  it("drops a nameless row rather than drawing a blank", () => {
    expect(partyPreviewOf([member("Sam", 24), member(" ", 30)])).toMatchObject({ members: [{ name: "Sam", age: 24 }] });
  });

  it("says why there is no seat", () => {
    const only = (status: PartyCodePreviewRow["status"]) => [
      { status, sharer_name: null, game_name: null, member_name: null, member_age: null },
    ];
    expect(partyPreviewOf(only("full"))).toEqual({ kind: "closed", status: "full" });
    expect(partyPreviewOf(only("ended"))).toEqual({ kind: "closed", status: "ended" });
    expect(partyPreviewOf(only("unavailable"))).toEqual({ kind: "closed", status: "unavailable" });
  });

  it("knows a player who is already in the party (0089 answers one row, status member)", () => {
    expect(
      partyPreviewOf([{ status: "member", sharer_name: null, game_name: null, member_name: null, member_age: null }]),
    ).toEqual({ kind: "member" });
  });

  it("reads nothing at all, or an unknown status, as unavailable", () => {
    expect(partyPreviewOf([])).toEqual({ kind: "closed", status: "unavailable" });
    expect(partyPreviewOf(null)).toEqual({ kind: "closed", status: "unavailable" });
    expect(
      partyPreviewOf([{ status: "weird" as never, sharer_name: null, game_name: null, member_name: null, member_age: null }]),
    ).toEqual({ kind: "closed", status: "unavailable" });
  });
});

describe("partyJoinOutcome (join_party_by_code)", () => {
  const PARTY = "5e2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";

  it("opens the party chat when joined, or already in", () => {
    expect(partyJoinOutcome({ result: "joined", party_id: PARTY })).toEqual({ kind: "open-chat", partyId: PARTY });
    expect(partyJoinOutcome({ result: "member", party_id: PARTY.toUpperCase() })).toEqual({
      kind: "open-chat",
      partyId: PARTY,
    });
  });

  it("says why it could not", () => {
    expect(partyJoinOutcome({ result: "full", party_id: null })).toEqual({ kind: "closed", status: "full" });
    expect(partyJoinOutcome({ result: "ended", party_id: null })).toEqual({ kind: "closed", status: "ended" });
    expect(partyJoinOutcome({ result: "unavailable", party_id: null })).toEqual({ kind: "closed", status: "unavailable" });
  });

  it("never opens a chat it has no id for", () => {
    expect(partyJoinOutcome({ result: "joined", party_id: null })).toEqual({ kind: "closed", status: "unavailable" });
    expect(partyJoinOutcome(null)).toEqual({ kind: "closed", status: "unavailable" });
    expect(partyJoinOutcome({ result: "weird" as never, party_id: PARTY })).toEqual({
      kind: "closed",
      status: "unavailable",
    });
  });
});
