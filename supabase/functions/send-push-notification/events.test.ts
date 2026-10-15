import { describe, expect, it } from "vitest";

// The app's own tap routing, read (never changed) to pin that every category this function sends
// does what the shipped app expects. apps/mobile is the 1.0.1 code today; a later build may add
// routes, and this test fails only if one of these stops working.
import { notificationTapAction } from "../../../apps/mobile/src/lib/notificationRouting";

import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  isAnnouncementText,
  isLiveMatchBetween,
  isStillProposed,
  isStillShared,
  isValidEvent,
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
