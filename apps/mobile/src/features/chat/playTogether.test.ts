import { describe, expect, it } from "vitest";

import {
  CHIP_CHAR_W,
  CHIP_CHROME_W,
  CHIP_GAP,
  FREE_NOW_COOLDOWN_MS,
  FREE_NOW_MESSAGE,
  PLAY_TOGETHER_COPY,
  SESSION_CONFIRMED_LIVE_MS,
  SESSION_PENDING_LIVE_MS,
  chipRowWidth,
  chipsVisible,
  discordChipState,
  freeNowCooldownUntil,
  freeNowCoolingDown,
  liveSession,
} from "./playTogether";

const NOW = Date.parse("2026-10-15T20:00:00.000Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

function session(status: "pending" | "confirmed" | "cancelled" | "declined", scheduledAgoMs: number) {
  return { status, scheduled_at: new Date(NOW - scheduledAgoMs).toISOString() };
}

describe("liveSession: a proposal or a confirmed time only counts while it can still happen", () => {
  it("mirrors 0077: confirmed stays live for 2 hours after its time, pending for 30 minutes", () => {
    expect(SESSION_CONFIRMED_LIVE_MS).toBe(2 * HOUR);
    expect(SESSION_PENDING_LIVE_MS).toBe(30 * MIN);
  });

  it("keeps a confirmed session that started an hour ago, drops one from three hours ago", () => {
    const live = session("confirmed", 1 * HOUR);
    expect(liveSession(live, NOW)).toBe(live);
    expect(liveSession(session("confirmed", 3 * HOUR), NOW)).toBeNull();
  });

  it("keeps a pending proposal 10 minutes past, drops one 45 minutes past", () => {
    const live = session("pending", 10 * MIN);
    expect(liveSession(live, NOW)).toBe(live);
    expect(liveSession(session("pending", 45 * MIN), NOW)).toBeNull();
  });

  it("keeps anything in the future", () => {
    expect(liveSession(session("pending", -3 * HOUR), NOW)).not.toBeNull();
    expect(liveSession(session("confirmed", -3 * HOUR), NOW)).not.toBeNull();
  });

  it("returns null for no session, a terminal status or an unreadable time", () => {
    expect(liveSession(null, NOW)).toBeNull();
    expect(liveSession(undefined, NOW)).toBeNull();
    expect(liveSession(session("cancelled", -HOUR), NOW)).toBeNull();
    expect(liveSession(session("declined", -HOUR), NOW)).toBeNull();
    expect(liveSession({ status: "confirmed", scheduled_at: "soon" }, NOW)).toBeNull();
  });
});

describe("chipsVisible: the row hides only when there is nothing to arrange", () => {
  it("hides in a locked chat", () => {
    expect(chipsVisible({ session: null, isLocked: true, now: NOW })).toBe(false);
  });

  it("hides while a confirmed session is live", () => {
    expect(chipsVisible({ session: session("confirmed", HOUR), isLocked: false, now: NOW })).toBe(false);
  });

  it("shows while a proposal is only pending", () => {
    expect(chipsVisible({ session: session("pending", 10 * MIN), isLocked: false, now: NOW })).toBe(true);
  });

  it("comes back once a confirmed session is more than 2 hours past", () => {
    expect(chipsVisible({ session: session("confirmed", 3 * HOUR), isLocked: false, now: NOW })).toBe(true);
  });

  it("shows with no session at all (and while the session is still loading)", () => {
    expect(chipsVisible({ session: null, isLocked: false, now: NOW })).toBe(true);
    expect(chipsVisible({ session: undefined, isLocked: false, now: NOW })).toBe(true);
  });
});

describe("discordChipState", () => {
  it("hides once shared, whether or not a username is saved", () => {
    expect(discordChipState({ hasUsername: true, hasShared: true })).toBe("hidden");
    expect(discordChipState({ hasUsername: false, hasShared: true })).toBe("hidden");
  });

  it("offers to share a saved username, or to add one", () => {
    expect(discordChipState({ hasUsername: true, hasShared: false })).toBe("share");
    expect(discordChipState({ hasUsername: false, hasShared: false })).toBe("add");
  });
});

describe("the I'm free now cooldown", () => {
  const me = "me";
  const msg = (sender: string, content: string, agoMs: number, id = "m") => ({
    id,
    sender_id: sender,
    content,
    created_at: new Date(NOW - agoMs).toISOString(),
  });

  it("is five minutes", () => {
    expect(FREE_NOW_COOLDOWN_MS).toBe(5 * MIN);
  });

  it("cools down after my own message 2 minutes ago, not after one 6 minutes ago", () => {
    expect(freeNowCoolingDown({ messages: [msg(me, FREE_NOW_MESSAGE, 2 * MIN)], myId: me, now: NOW })).toBe(true);
    expect(freeNowCoolingDown({ messages: [msg(me, FREE_NOW_MESSAGE, 6 * MIN)], myId: me, now: NOW })).toBe(false);
  });

  it("counts an optimistic temp row too", () => {
    const temp = msg(me, FREE_NOW_MESSAGE, 1000, "temp-123");
    expect(freeNowCoolingDown({ messages: [temp], myId: me, now: NOW })).toBe(true);
  });

  it("ignores theirs and my other messages", () => {
    expect(freeNowCoolingDown({ messages: [msg("them", FREE_NOW_MESSAGE, MIN)], myId: me, now: NOW })).toBe(false);
    expect(freeNowCoolingDown({ messages: [msg(me, "gg", MIN)], myId: me, now: NOW })).toBe(false);
    expect(freeNowCoolingDown({ messages: [msg(me, FREE_NOW_MESSAGE, MIN)], myId: undefined, now: NOW })).toBe(false);
  });

  it("says when the cooldown ends, from the newest one", () => {
    const messages = [msg(me, FREE_NOW_MESSAGE, 4 * MIN, "a"), msg(me, FREE_NOW_MESSAGE, 1 * MIN, "b")];
    expect(freeNowCooldownUntil({ messages, myId: me, now: NOW })).toBe(NOW - MIN + FREE_NOW_COOLDOWN_MS);
    expect(freeNowCooldownUntil({ messages: [], myId: me, now: NOW })).toBeNull();
  });

  // created_at on a server row is the server's clock; `now` and temp rows are the phone's.
  it("never runs past five minutes from now when the phone is slow (a server row stamped in the future)", () => {
    const future = msg(me, FREE_NOW_MESSAGE, -10 * MIN);
    expect(freeNowCooldownUntil({ messages: [future], myId: me, now: NOW })).toBe(NOW + FREE_NOW_COOLDOWN_MS);
  });

  it("holds five minutes from this phone's own send when the phone is fast (the server row looks old)", () => {
    // Sent 30 seconds ago by the phone's clock; the server, 6 minutes behind, stamped it 6.5 minutes ago.
    const serverRow = msg(me, FREE_NOW_MESSAGE, 6.5 * MIN);
    const sentAt = NOW - 30_000;
    expect(freeNowCoolingDown({ messages: [serverRow], myId: me, now: NOW })).toBe(false);
    expect(freeNowCooldownUntil({ messages: [serverRow], myId: me, now: NOW, sentAt })).toBe(sentAt + FREE_NOW_COOLDOWN_MS);
  });

  it("takes the later of the local send and the rows, and ignores a missing or stale local send", () => {
    const row = msg(me, FREE_NOW_MESSAGE, MIN);
    expect(freeNowCooldownUntil({ messages: [row], myId: me, now: NOW, sentAt: NOW - 3 * MIN })).toBe(
      NOW - MIN + FREE_NOW_COOLDOWN_MS,
    );
    expect(freeNowCooldownUntil({ messages: [row], myId: me, now: NOW, sentAt: null })).toBe(NOW - MIN + FREE_NOW_COOLDOWN_MS);
    expect(freeNowCooldownUntil({ messages: [], myId: me, now: NOW, sentAt: NOW - 6 * MIN })).toBeNull();
    expect(freeNowCooldownUntil({ messages: [], myId: me, now: NOW, sentAt: NOW + MIN })).toBe(NOW + FREE_NOW_COOLDOWN_MS);
  });

  it("needs a signed-in player even with a local send", () => {
    expect(freeNowCooldownUntil({ messages: [], myId: undefined, now: NOW, sentAt: NOW })).toBeNull();
  });
});

describe("the chip row fits one line on a 375pt phone", () => {
  it("uses the measured IBM Plex Mono advance and the chip's own chrome", () => {
    expect(CHIP_CHAR_W).toBe(6.6);
    expect(CHIP_CHROME_W).toBe(20);
    expect(CHIP_GAP).toBe(8);
  });

  it("fits the widest labels inside 343pt (375 minus the 16pt gutters)", () => {
    const widest = [PLAY_TOGETHER_COPY.addDiscord, PLAY_TOGETHER_COPY.freeNow, PLAY_TOGETHER_COPY.pickTime];
    const alt = [PLAY_TOGETHER_COPY.shareDiscord, PLAY_TOGETHER_COPY.freeNow, PLAY_TOGETHER_COPY.pickTime];
    expect(chipRowWidth(widest)).toBeLessThanOrEqual(343);
    expect(chipRowWidth(alt)).toBeLessThanOrEqual(343);
    expect(chipRowWidth([])).toBe(0);
    expect(chipRowWidth(["ab"])).toBeCloseTo(2 * 6.6 + 20);
  });
});

describe("play-together copy", () => {
  const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
  const all = [...Object.values(PLAY_TOGETHER_COPY), FREE_NOW_MESSAGE];

  it("is the approved wording", () => {
    expect(PLAY_TOGETHER_COPY.addDiscord).toBe("Add your Discord");
    expect(PLAY_TOGETHER_COPY.shareDiscord).toBe("Share my Discord");
    expect(PLAY_TOGETHER_COPY.freeNow).toBe("I'm free now");
    expect(PLAY_TOGETHER_COPY.pickTime).toBe("Pick a time");
    expect(PLAY_TOGETHER_COPY.emptyChatSubtitle).toBe("Say hi, then share your Discord or pick a time to play.");
    expect(FREE_NOW_MESSAGE).toBe("🎮 I'm free to play right now!");
  });

  it("has no dashes, no 'beats' and no dating words", () => {
    for (const text of all) {
      expect(text).not.toMatch(dashes);
      expect(text).not.toMatch(/\bbeats?\b/i);
      expect(text).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
    }
  });
});
