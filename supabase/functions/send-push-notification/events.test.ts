import { describe, expect, it } from "vitest";

// The app's own tap routing, read (never changed) to pin that every category this function sends
// does what the shipped app expects. apps/mobile is the 1.0.1 code today; a later build may add
// routes, and this test fails only if one of these stops working.
import { notificationTapAction } from "../../../apps/mobile/src/lib/notificationRouting";

import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  canDuoWith,
  DUO_CALL_LOCKED_LOG_EVENT,
  DUO_LOCKED_LOG_EVENT,
  DUO_POP_CATEGORY,
  DUO_POP_MIN_SECONDS_LEFT,
  DUO_POP_SOUND,
  DUO_POP_TTL_SECONDS,
  duoPopTtlSeconds,
  isAnnouncementText,
  isCallLock,
  isDuoPopOpenFor,
  isLiveMatchBetween,
  isOptedInToDuoPops,
  isStillProposed,
  isStillShared,
  isValidEvent,
  popLockFor,
  PUSH_ROUTES,
} from "./events";

const A = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
const B = "7c1d2e3f-4a5b-4c6d-9e7f-8a9b0c1d2e3f";
const C = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const MATCH = "5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9";
const ROW = "9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a";

const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

describe("isValidEvent: the bodies deployed triggers send today stay valid", () => {
  it.each([
    { type: "new_match", matchId: MATCH, userAId: A, userBId: B },
    { type: "new_message", matchId: MATCH, messageId: ROW, senderId: A },
    { type: "super_ping", senderId: A, receiverId: B },
    { type: "looking_now", matchId: MATCH, togglerId: A, recipientId: B },
    { type: "party_invite", partyId: ROW, inviteId: MATCH, targetId: A },
    { type: "party_started", partyId: ROW, creatorId: A, partnerId: B },
    { type: "party_joined", partyId: ROW, joinerId: A },
    { type: "party_message", partyId: ROW, messageId: MATCH, senderId: A },
  ])("$type", (body) => {
    expect(isValidEvent(body)).toBe(true);
  });
});

describe("isValidEvent: the new events, exactly as the SQL builds them", () => {
  it.each([
    { type: "new_like", recipientId: A, likeCount: 1 },
    { type: "new_like", recipientId: A, likeCount: 4 },
    { type: "session_proposed", matchId: MATCH, sessionId: ROW, proposerId: A, recipientId: B },
    { type: "discord_shared", matchId: MATCH, shareId: ROW, sharerId: A, recipientId: B },
    { type: "first_message_nudge", matchId: MATCH, recipientId: A, otherId: B },
    { type: "announcement", title: "New in DuoQueue", body: "Parties are here. Swipe together to find a third." },
    { type: "duo_pop", popId: ROW, recipientId: A },
  ])("$type", (body) => {
    expect(isValidEvent(body)).toBe(true);
  });
});

describe("isValidEvent stays strict", () => {
  it.each([
    ["an unknown type", { type: "new_admirer", recipientId: A }],
    ["no body", null],
    ["an array", [{ type: "new_like", recipientId: A, likeCount: 1 }]],
    ["a like count of 0", { type: "new_like", recipientId: A, likeCount: 0 }],
    ["a fractional like count", { type: "new_like", recipientId: A, likeCount: 1.5 }],
    ["a like count as a string", { type: "new_like", recipientId: A, likeCount: "1" }],
    ["a like with no count", { type: "new_like", recipientId: A }],
    ["a like with a bad id", { type: "new_like", recipientId: "abc", likeCount: 1 }],
    ["a proposal with no session", { type: "session_proposed", matchId: MATCH, proposerId: A, recipientId: B }],
    ["a share with no recipient", { type: "discord_shared", matchId: MATCH, shareId: ROW, sharerId: A }],
    ["a nudge with no other side", { type: "first_message_nudge", matchId: MATCH, recipientId: A }],
    ["an empty announcement title", { type: "announcement", title: " ", body: "b" }],
    ["an announcement title over 60", { type: "announcement", title: "t".repeat(61), body: "b" }],
    ["an announcement body over 180", { type: "announcement", title: "t", body: "b".repeat(181) }],
    ["an announcement with an em dash", { type: "announcement", title: `New${EM_DASH}now`, body: "b" }],
    ["an announcement with an en dash", { type: "announcement", title: "t", body: `a ${EN_DASH} b` }],
    ["an announcement over two lines", { type: "announcement", title: "t", body: "one\ntwo" }],
    ["a Duo Pop with a bad pop id", { type: "duo_pop", popId: "pop", recipientId: A }],
    ["a Duo Pop with no recipient", { type: "duo_pop", popId: ROW }],
    ["a Duo Pop with a bad recipient", { type: "duo_pop", popId: ROW, recipientId: "everyone" }],
  ])("refuses %s", (_label, body) => {
    expect(isValidEvent(body)).toBe(false);
  });

  it("announcement limits are the ones 0081 documents", () => {
    expect(ANNOUNCEMENT_TITLE_MAX).toBe(60);
    expect(ANNOUNCEMENT_BODY_MAX).toBe(180);
    expect(isAnnouncementText("t".repeat(60), ANNOUNCEMENT_TITLE_MAX)).toBe(true);
  });
});

describe("PUSH_ROUTES: the contract with the SQL and with the shipped app", () => {
  it("the new events use the switch, category and sound the migrations specify", () => {
    expect(PUSH_ROUTES.new_like).toEqual({ setting: "new_like", category: "new_player", sound: true });
    expect(PUSH_ROUTES.session_proposed).toEqual({ setting: "new_message", category: "new_message", sound: true });
    expect(PUSH_ROUTES.discord_shared).toEqual({ setting: "new_message", category: "new_message", sound: true });
    expect(PUSH_ROUTES.first_message_nudge).toEqual({ setting: "nudge_unread", category: "new_match", sound: false });
    expect(PUSH_ROUTES.looking_now).toEqual({ setting: "nudge_online", category: "new_message", sound: true });
  });

  it("the pushes that existed before keep their switch, category and sound", () => {
    expect(PUSH_ROUTES.new_match).toEqual({ setting: "new_match", category: "new_match", sound: true });
    expect(PUSH_ROUTES.new_message).toEqual({ setting: "new_message", category: "new_message", sound: true });
    expect(PUSH_ROUTES.super_ping).toEqual({ setting: "super_ping", category: "super_ping", sound: true });
    expect(PUSH_ROUTES.party_invite).toEqual({ setting: "new_match", category: "party_invite", sound: true });
    expect(PUSH_ROUTES.party_started).toEqual({ setting: "new_match", category: "party_started", sound: true });
    expect(PUSH_ROUTES.party_joined).toEqual({ setting: "new_match", category: "party_joined", sound: true });
    expect(PUSH_ROUTES.party_message).toEqual({ setting: "new_message", category: "party_message", sound: true });
  });

  const tap = (category: string, matchId?: string) =>
    notificationTapAction({
      category,
      matchId,
      partyId: undefined,
      navigatorReady: true,
      sessionStatus: "signed_in",
      profileStatus: "loaded",
      onboardingCompleted: true,
    });

  it("a like alert opens the deck on the shipped app", () => {
    expect(tap(PUSH_ROUTES.new_like.category)).toEqual({ kind: "open-deck" });
  });

  it.each(["session_proposed", "discord_shared", "first_message_nudge", "looking_now"] as const)(
    "%s opens that chat on the shipped app",
    (event) => {
      expect(tap(PUSH_ROUTES[event].category, MATCH)).toEqual({ kind: "open-chat", matchId: MATCH });
    },
  );

  it("an announcement is not routed anywhere (a tap just opens the app)", () => {
    expect(tap("announcement")).toEqual({ kind: "ignore" });
  });

  it("a Duo Pop's category without its popId is ignored (1.0.1 never routes it, and cannot opt in)", () => {
    expect(tap(DUO_POP_CATEGORY)).toEqual({ kind: "ignore" });
  });

  it("the sender's Duo locked push rides new_match + matchId, so the shipped app opens that chat", () => {
    expect(tap(PUSH_ROUTES.new_match.category, MATCH)).toEqual({ kind: "open-chat", matchId: MATCH });
  });

  it("the post's Duo locked push (0088) is new_match + matchId too, so a tap opens the chat", () => {
    // Its extra popId and via "post" ride beside matchId; the shipped app routes on category and
    // matchId only.
    expect(tap(PUSH_ROUTES.new_match.category, MATCH)).toEqual({ kind: "open-chat", matchId: MATCH });
  });

  it("the Duo Pop is not a notifyProfile route: it never takes the missing-row-means-notify default", () => {
    expect("duo_pop" in PUSH_ROUTES).toBe(false);
    expect(DUO_POP_CATEGORY).toBe("duo_pop");
    expect(DUO_POP_SOUND).toBe("duo-pop.wav");
    expect(DUO_POP_TTL_SECONDS).toBe(600);
  });
});

describe("Duo Pop re-checks (0085)", () => {
  const now = new Date("2026-10-15T20:00:00Z");
  const open = {
    id: ROW,
    sender_id: A,
    game_id: C,
    recipients: [B, MATCH],
    declined: [],
    can_duo: [B],
    locked_at: null,
    ended_at: null,
    pop_expires_at: "2026-10-15T20:09:00+00:00",
  };

  it("isDuoPopOpenFor: unlocked, not stopped, more than 30 seconds left, a recipient, no Not now", () => {
    expect(isDuoPopOpenFor(open, B, now)).toBe(true);
    expect(isDuoPopOpenFor(open, B.toUpperCase(), now)).toBe(true);
    expect(isDuoPopOpenFor({ ...open, locked_at: "2026-10-15T19:59:00Z" }, B, now)).toBe(false);
    expect(isDuoPopOpenFor({ ...open, ended_at: "2026-10-15T19:59:00Z" }, B, now)).toBe(false);
    expect(isDuoPopOpenFor({ ...open, declined: [B] }, B, now)).toBe(false);
    expect(isDuoPopOpenFor(open, C, now)).toBe(false);
    expect(isDuoPopOpenFor(null, B, now)).toBe(false);
    expect(isDuoPopOpenFor({ ...open, recipients: null }, B, now)).toBe(false);
    expect(isDuoPopOpenFor({ ...open, pop_expires_at: "not a time" }, B, now)).toBe(false);
  });

  it("isDuoPopOpenFor: the 30-second edge", () => {
    const at = (seconds: number) => new Date(now.getTime() + seconds * 1000).toISOString();
    expect(isDuoPopOpenFor({ ...open, pop_expires_at: at(DUO_POP_MIN_SECONDS_LEFT) }, B, now)).toBe(false);
    expect(isDuoPopOpenFor({ ...open, pop_expires_at: at(DUO_POP_MIN_SECONDS_LEFT + 1) }, B, now)).toBe(true);
    expect(isDuoPopOpenFor({ ...open, pop_expires_at: at(-5) }, B, now)).toBe(false);
  });

  it("duoPopTtlSeconds: the seconds the pop has left, floored, never past the pop or over 600", () => {
    const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
    // 20:09:00 against 20:00:00: 9 minutes left.
    expect(duoPopTtlSeconds(open, now)).toBe(540);
    // A fresh pop, as Postgres writes it (microseconds and an offset).
    expect(duoPopTtlSeconds({ pop_expires_at: "2026-10-15T20:10:00.000000+00:00" }, now)).toBe(600);
    // Floored: 45.9 seconds left is a 45-second ttl, so the push never outlives the pop.
    expect(duoPopTtlSeconds({ pop_expires_at: at(45_900) }, now)).toBe(45);
    // Clock skew between the database and this function never lifts it past the pop's 10 minutes.
    expect(duoPopTtlSeconds({ pop_expires_at: at(605_000) }, now)).toBe(DUO_POP_TTL_SECONDS);
    // Nothing left, already past, unreadable or missing: do not send.
    expect(duoPopTtlSeconds({ pop_expires_at: at(999) }, now)).toBeNull();
    expect(duoPopTtlSeconds({ pop_expires_at: at(-5_000) }, now)).toBeNull();
    expect(duoPopTtlSeconds({ pop_expires_at: "not a time" }, now)).toBeNull();
    expect(duoPopTtlSeconds(null, now)).toBeNull();
  });

  it("duoPopTtlSeconds: the last pop of the night (fanned out 00:49:30 local) can never land at 01:00", () => {
    // America/New_York in October is UTC-4: the pop closes at 00:59:30 local, 04:59:30Z.
    const pop = { pop_expires_at: "2026-10-16T04:59:30+00:00" };
    const oneAm = Date.parse("2026-10-16T05:00:00Z");
    // Whenever the push leaves (on time, or late behind a pg_net backlog), the provider may hold it
    // only until the pop closes.
    for (const leaves of ["2026-10-16T04:49:30Z", "2026-10-16T04:55:00Z", "2026-10-16T04:58:59.500Z"]) {
      const sent = new Date(leaves);
      const ttl = duoPopTtlSeconds(pop, sent);
      expect(ttl).not.toBeNull();
      expect(sent.getTime() + (ttl ?? 0) * 1000).toBeLessThanOrEqual(Date.parse(pop.pop_expires_at));
      expect(sent.getTime() + (ttl ?? 0) * 1000).toBeLessThan(oneAm);
    }
  });

  it("canDuoWith: only a recipient in can_duo", () => {
    expect(canDuoWith(open, B)).toBe(true);
    expect(canDuoWith(open, MATCH)).toBe(false);
    expect(canDuoWith({ can_duo: null }, B)).toBe(false);
    expect(canDuoWith(null, B)).toBe(false);
  });

  it("isOptedInToDuoPops: the row must exist and say exactly true (the opposite of notifyProfile)", () => {
    expect(isOptedInToDuoPops({ queue_pop: true })).toBe(true);
    expect(isOptedInToDuoPops({ queue_pop: false })).toBe(false);
    expect(isOptedInToDuoPops(null)).toBe(false);
    expect(isOptedInToDuoPops(undefined)).toBe(false);
    expect(isOptedInToDuoPops({})).toBe(false);
    expect(isOptedInToDuoPops({ queue_pop: "true" })).toBe(false);
  });

  const lockedRow = {
    id: ROW.toUpperCase(),
    sender_id: A,
    locked_by: B,
    locked_at: "2026-10-15T20:00:41+00:00",
    created_at: "2026-10-15T20:00:00+00:00",
    can_duo: [B],
  };

  it("popLockFor: a locked pop whose sender and locker are exactly the match's two players", () => {
    expect(popLockFor(lockedRow, { userAId: A, userBId: B })).toEqual({
      popId: ROW,
      senderId: A,
      lockerId: B,
      canDuo: true,
    });
    expect(popLockFor(lockedRow, { userAId: B, userBId: A.toUpperCase() })?.senderId).toBe(A);
    expect(popLockFor({ ...lockedRow, can_duo: [] }, { userAId: A, userBId: B })?.canDuo).toBe(false);
  });

  it("popLockFor: anything else is an ordinary match", () => {
    expect(popLockFor(null, { userAId: A, userBId: B })).toBeNull();
    expect(popLockFor({ ...lockedRow, locked_at: null }, { userAId: A, userBId: B })).toBeNull();
    expect(popLockFor({ ...lockedRow, locked_by: null }, { userAId: A, userBId: B })).toBeNull();
    expect(popLockFor(lockedRow, { userAId: A, userBId: C })).toBeNull();
    expect(popLockFor({ ...lockedRow, locked_by: A }, { userAId: A, userBId: B })).toBeNull();
  });

  // 0088: one duo per Queue up. A Duo Call lock is the same row shape plus locked_via "call".
  it("isCallLock: only locked_via exactly call (absent before 0088, null, pop or anything else is a pop)", () => {
    expect(isCallLock({ ...lockedRow, locked_via: "call" })).toBe(true);
    expect(isCallLock({ ...lockedRow, locked_via: "pop" })).toBe(false);
    expect(isCallLock({ ...lockedRow, locked_via: null })).toBe(false);
    expect(isCallLock({ ...lockedRow, locked_via: undefined })).toBe(false);
    expect(isCallLock(lockedRow)).toBe(false);
    expect(isCallLock({ ...lockedRow, locked_via: "CALL" })).toBe(false);
    expect(isCallLock(null)).toBe(false);
    expect(isCallLock(undefined)).toBe(false);
  });

  it("popLockFor still returns the lock for a call row (the sender gets the call push, the joiner nothing)", () => {
    expect(popLockFor({ ...lockedRow, locked_via: "call" }, { userAId: A, userBId: B })).toEqual({
      popId: ROW,
      senderId: A,
      lockerId: B,
      canDuo: true,
    });
  });

  it("the call lock's log event is its own, not duo_locked", () => {
    expect(DUO_CALL_LOCKED_LOG_EVENT).toBe("duo_call_locked");
    expect(DUO_CALL_LOCKED_LOG_EVENT).not.toBe(DUO_LOCKED_LOG_EVENT);
    // push_log_event_length (0080): 1..40 characters.
    expect(DUO_CALL_LOCKED_LOG_EVENT.length).toBeLessThanOrEqual(40);
  });
});

describe("re-checks before a match push goes out", () => {
  const live = { user_a_id: A, user_b_id: B, unmatched_at: null };

  it("isLiveMatchBetween: only the two players of a match that is still on", () => {
    expect(isLiveMatchBetween(live, A, B)).toBe(true);
    expect(isLiveMatchBetween(live, B.toUpperCase(), A)).toBe(true);
    expect(isLiveMatchBetween({ ...live, unmatched_at: "2026-10-14T10:00:00Z" }, A, B)).toBe(false);
    expect(isLiveMatchBetween(live, A, C)).toBe(false);
    expect(isLiveMatchBetween(live, A, A)).toBe(false);
    expect(isLiveMatchBetween(null, A, B)).toBe(false);
  });

  const now = new Date("2026-10-15T12:00:00Z");
  const session = { match_id: MATCH, proposed_by: A, status: "pending", scheduled_at: "2026-10-17T23:00:00+00:00" };
  const proposed = { matchId: MATCH, proposerId: A };

  it("isStillProposed: pending, same match and proposer, still ahead", () => {
    expect(isStillProposed(session, proposed, now)).toBe(true);
    expect(isStillProposed({ ...session, status: "cancelled" }, proposed, now)).toBe(false);
    expect(isStillProposed({ ...session, status: "confirmed" }, proposed, now)).toBe(false);
    expect(isStillProposed({ ...session, proposed_by: B }, proposed, now)).toBe(false);
    expect(isStillProposed({ ...session, match_id: ROW }, proposed, now)).toBe(false);
    expect(isStillProposed({ ...session, scheduled_at: "2026-10-15T11:00:00Z" }, proposed, now)).toBe(false);
    expect(isStillProposed(null, proposed, now)).toBe(false);
  });

  const share = { match_id: MATCH, shared_by: A, revoked: false };
  const shared = { matchId: MATCH, sharerId: A };

  it("isStillShared: not revoked, same match and sharer", () => {
    expect(isStillShared(share, shared)).toBe(true);
    expect(isStillShared({ ...share, revoked: true }, shared)).toBe(false);
    expect(isStillShared({ ...share, shared_by: B }, shared)).toBe(false);
    expect(isStillShared({ ...share, match_id: ROW }, shared)).toBe(false);
    expect(isStillShared(undefined, shared)).toBe(false);
  });
});
