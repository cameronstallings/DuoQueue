import { describe, expect, it } from "vitest";

import {
  PUSH_ASK_INTERVAL_MS,
  PUSH_ON_TOAST,
  askOutcome,
  canHoldDeckSlot,
  mergePushAskRecord,
  parsePushAskRecord,
  permissionStateOf,
  pushAskCopy,
  pushAskKind,
  serializePushAskRecord,
  settingsBannerCopy,
  type PushPermissionState,
} from "./pushAsk";

const NOW = Date.parse("2026-10-15T20:00:00.000Z");
const DAY = 86_400_000;

const undetermined: PushPermissionState = { status: "undetermined", canAskAgain: true };
const denied: PushPermissionState = { status: "denied", canAskAgain: false };
const granted: PushPermissionState = { status: "granted", canAskAgain: true };

describe("pushAskKind", () => {
  it("asks once a week at most", () => {
    expect(PUSH_ASK_INTERVAL_MS).toBe(7 * DAY);
  });

  it("is none until the permission and the store have loaded", () => {
    expect(pushAskKind({ permission: undefined, lastOfferedAt: null, now: NOW })).toBe("none");
    expect(pushAskKind({ permission: undetermined, lastOfferedAt: undefined, now: NOW })).toBe("none");
  });

  it("is none when notifications are already on", () => {
    expect(pushAskKind({ permission: granted, lastOfferedAt: null, now: NOW })).toBe("none");
  });

  it("asks when iOS can still show its prompt, and sends to Settings when it cannot", () => {
    expect(pushAskKind({ permission: undetermined, lastOfferedAt: null, now: NOW })).toBe("ask");
    expect(pushAskKind({ permission: denied, lastOfferedAt: null, now: NOW })).toBe("open-settings");
    expect(pushAskKind({ permission: { status: "denied", canAskAgain: true }, lastOfferedAt: null, now: NOW })).toBe(
      "ask",
    );
  });

  it("waits exactly 7 days after the last offer on any surface", () => {
    expect(pushAskKind({ permission: undetermined, lastOfferedAt: NOW - 7 * DAY, now: NOW })).toBe("ask");
    expect(pushAskKind({ permission: undetermined, lastOfferedAt: NOW - 7 * DAY + 1, now: NOW })).toBe("none");
    expect(pushAskKind({ permission: denied, lastOfferedAt: NOW - DAY, now: NOW })).toBe("none");
  });

  it("treats an offer stamped in the near future (the clock moved back) as recent, and a far one as junk", () => {
    expect(pushAskKind({ permission: undetermined, lastOfferedAt: NOW + DAY, now: NOW })).toBe("none");
    expect(pushAskKind({ permission: undetermined, lastOfferedAt: NOW + 30 * DAY, now: NOW })).toBe("ask");
  });
});

describe("permissionStateOf", () => {
  it("reads expo-notifications' answer", () => {
    expect(permissionStateOf({ status: "granted", granted: true, canAskAgain: true })).toEqual(granted);
    expect(permissionStateOf({ status: "denied", granted: false, canAskAgain: false })).toEqual(denied);
    expect(permissionStateOf({ status: "undetermined", granted: false, canAskAgain: true })).toEqual(undetermined);
  });

  it("counts granted:true as granted whatever the status says (iOS provisional)", () => {
    expect(permissionStateOf({ status: "weird", granted: true, canAskAgain: true }).status).toBe("granted");
  });

  it("falls back to undetermined for junk, askable unless the OS said otherwise", () => {
    expect(permissionStateOf(null)).toEqual(undetermined);
    expect(permissionStateOf("granted")).toEqual(undetermined);
    expect(permissionStateOf({ status: "denied" })).toEqual({ status: "denied", canAskAgain: false });
    expect(permissionStateOf({ canAskAgain: false })).toEqual({ status: "undetermined", canAskAgain: false });
  });
});

describe("askOutcome: what a tap on Turn on leads to", () => {
  // `after` is ensurePushPermission()'s answer. Expo on iOS reports canAskAgain false as soon as
  // the status is denied, so a Don't Allow on the prompt this tap raised reads exactly like a
  // denial from months ago; only the state BEFORE the tap tells the two apart.
  const deniedNow = { granted: false, canAskAgain: false };

  it("registers the token when the answer is yes", () => {
    expect(askOutcome(undetermined, { granted: true, canAskAgain: true })).toBe("register-token");
    expect(askOutcome(granted, { granted: true, canAskAgain: true })).toBe("register-token");
    expect(askOutcome(denied, { granted: true, canAskAgain: false })).toBe("register-token");
  });

  it("does nothing after Don't Allow on the prompt this tap raised", () => {
    expect(askOutcome(undetermined, deniedNow)).toBe("nothing");
    // Android after one no: the OS could still prompt, and did.
    expect(askOutcome({ status: "denied", canAskAgain: true }, deniedNow)).toBe("nothing");
    expect(askOutcome(undetermined, { granted: false, canAskAgain: true })).toBe("nothing");
  });

  it("opens Settings only when the OS could not prompt before the tap", () => {
    expect(askOutcome(denied, deniedNow)).toBe("open-os-settings");
    expect(askOutcome({ status: "undetermined", canAskAgain: false }, deniedNow)).toBe("open-os-settings");
  });

  it("does nothing when the OS says it could still ask (nothing to send them to)", () => {
    expect(askOutcome(denied, { granted: false, canAskAgain: true })).toBe("nothing");
  });
});

describe("the one deck ask slot", () => {
  it("is free, or already held by the same asker", () => {
    expect(canHoldDeckSlot(null, "push")).toBe(true);
    expect(canHoldDeckSlot("push", "push")).toBe(true);
    expect(canHoldDeckSlot("duo-pops", "push")).toBe(false);
    expect(canHoldDeckSlot("push", "duo-pops")).toBe(false);
  });
});

describe("pushAskCopy", () => {
  it("asks on the deck with a generic 'they'", () => {
    expect(pushAskCopy("ask", "deck")).toEqual({
      title: "Get notified when they duo you back?",
      body: "We'll let you know when a duo locks or a match messages you.",
      primaryLabel: "Turn on",
      secondaryLabel: "Not now",
    });
    expect(pushAskCopy("ask", "deck", "Kai").title).toBe("Get notified when Kai duos you back?");
  });

  it("sends a denied player to Settings from the deck", () => {
    expect(pushAskCopy("open-settings", "deck")).toEqual({
      title: "Notifications are off for DuoQueue",
      body: "Turn them on in Settings so you know when a duo locks.",
      primaryLabel: "Open Settings",
      secondaryLabel: "Not now",
    });
  });

  it("names the new duo on DUO LOCKED, with 'your match' as the fallback", () => {
    expect(pushAskCopy("ask", "match", "Kai")).toEqual({
      title: "Get notified when Kai messages you?",
      primaryLabel: "Turn on",
      secondaryLabel: "Not now",
    });
    expect(pushAskCopy("ask", "match").title).toBe("Get notified when your match messages you?");
    expect(pushAskCopy("ask", "match", "   ").title).toBe("Get notified when your match messages you?");
    expect(pushAskCopy("open-settings", "match", "Kai")).toEqual({
      title: "Notifications are off for DuoQueue",
      body: "Turn them on in Settings so you see Kai's reply.",
      primaryLabel: "Open Settings",
      secondaryLabel: "Not now",
    });
    expect(pushAskCopy("open-settings", "match").body).toBe("Turn them on in Settings so you see your match's reply.");
  });
});

describe("settingsBannerCopy", () => {
  it("has one line for denied and one for not asked yet", () => {
    expect(settingsBannerCopy("denied")).toEqual({
      title: "Notifications are off for DuoQueue",
      body: "Your choices below are saved. Turn notifications on in Settings to get them.",
      primaryLabel: "Open Settings",
    });
    expect(settingsBannerCopy("undetermined")).toEqual({
      title: "Turn on notifications",
      body: "Know when a duo locks or a match messages you.",
      primaryLabel: "Turn on",
    });
  });
});

describe("the persisted ask record", () => {
  it("round-trips", () => {
    const record = { lastOfferedAt: NOW, firstLikeAt: NOW - DAY };
    expect(parsePushAskRecord(serializePushAskRecord(record))).toEqual(record);
  });

  it("tolerates junk", () => {
    const empty = { lastOfferedAt: null, firstLikeAt: null };
    expect(parsePushAskRecord(null)).toEqual(empty);
    expect(parsePushAskRecord("")).toEqual(empty);
    expect(parsePushAskRecord("{")).toEqual(empty);
    expect(parsePushAskRecord("[]")).toEqual(empty);
    expect(parsePushAskRecord('{"lastOfferedAt":"yesterday","firstLikeAt":-5}')).toEqual(empty);
    expect(parsePushAskRecord('{"lastOfferedAt":12}')).toEqual({ lastOfferedAt: 12, firstLikeAt: null });
  });

  it("merges what was stored with what happened before it loaded: latest offer, earliest like", () => {
    expect(
      mergePushAskRecord({ lastOfferedAt: 5, firstLikeAt: 9 }, { lastOfferedAt: 7, firstLikeAt: 3 }),
    ).toEqual({ lastOfferedAt: 7, firstLikeAt: 3 });
    expect(mergePushAskRecord({ lastOfferedAt: null, firstLikeAt: 4 }, { lastOfferedAt: 2, firstLikeAt: null })).toEqual({
      lastOfferedAt: 2,
      firstLikeAt: 4,
    });
  });
});

describe("push-ask copy", () => {
  const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
  const strings = [
    PUSH_ON_TOAST,
    ...(["ask", "open-settings"] as const).flatMap((kind) =>
      (["deck", "match"] as const).flatMap((surface) =>
        [undefined, "Kai"].flatMap((name) => Object.values(pushAskCopy(kind, surface, name))),
      ),
    ),
    ...Object.values(settingsBannerCopy("denied")),
    ...Object.values(settingsBannerCopy("undetermined")),
  ];

  it("toasts 'Notifications on'", () => {
    expect(PUSH_ON_TOAST).toBe("Notifications on");
  });

  it("has no dashes, no 'beats', no dating words and never the word 'ping' (that is Super Ping)", () => {
    expect(strings.length).toBeGreaterThan(20);
    for (const text of strings) {
      expect(text).not.toMatch(dashes);
      expect(text).not.toMatch(/\bbeats?\b/i);
      expect(text).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
      expect(text).not.toMatch(/ping/i);
    }
  });
});
