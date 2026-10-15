import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_SAVE_FAILED,
  turningOnNeedsPermission,
  visibleCategories,
} from "./notificationCategories";

const TODAY = {
  profile_id: "p",
  new_match: true,
  new_message: true,
  super_ping: true,
  daily_swipes_refreshed: true,
  nudge_unread: true,
  nudge_online: false,
  new_player: true,
};

const EVERY_COLUMN = { ...TODAY, new_like: true, queue_pop: false, announcements: false };

describe("NOTIFICATION_CATEGORIES", () => {
  it("lists the ten categories in the screen's order", () => {
    expect(NOTIFICATION_CATEGORIES.map((c) => c.value)).toEqual([
      "new_match",
      "new_message",
      "new_like",
      "super_ping",
      "new_player",
      "queue_pop",
      "nudge_online",
      "nudge_unread",
      "daily_swipes_refreshed",
      "announcements",
    ]);
  });

  it("has no duplicates", () => {
    const values = NOTIFICATION_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("uses the approved wording", () => {
    const byValue = Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.value, c]));
    expect(byValue.new_like).toEqual({
      value: "new_like",
      label: "Someone wants to duo with you",
      hint: "When a player in your game and server duos you.",
    });
    expect(byValue.queue_pop?.label).toBe("Duo Pops");
    expect(byValue.queue_pop?.hint).toBe(
      "When someone who plays your game queues up. Up to 3 a day, never between 1 am and 10 am.",
    );
    expect(byValue.nudge_online).toEqual({
      value: "nudge_online",
      label: "A match queues up",
      hint: "When one of your matches taps Queue up.",
    });
    expect(byValue.daily_swipes_refreshed?.hint).toBe("The morning after you use up your free swipes.");
    expect(byValue.announcements).toEqual({
      value: "announcements",
      label: "News from DuoQueue",
      hint: "Occasional updates from the DuoQueue team. Off until you turn it on.",
    });
    expect(byValue.new_match?.hint).toBe("When someone you picked wants to duo with you too.");
  });
});

describe("visibleCategories", () => {
  it("shows the 7 rows today's table has, with no new_like, queue_pop or announcements", () => {
    const rows = visibleCategories(TODAY).map((c) => c.value);
    expect(rows).toHaveLength(7);
    expect(rows).not.toContain("new_like");
    expect(rows).not.toContain("queue_pop");
    expect(rows).not.toContain("announcements");
  });

  it("shows all 10 in order once every column is live, News last", () => {
    const rows = visibleCategories(EVERY_COLUMN).map((c) => c.value);
    expect(rows).toHaveLength(10);
    expect(rows.indexOf("new_like")).toBe(rows.indexOf("new_message") + 1);
    expect(rows[rows.length - 1]).toBe("announcements");
  });

  it("shows a row whose column is present even when it is off", () => {
    expect(visibleCategories({ ...TODAY, queue_pop: false }).map((c) => c.value)).toContain("queue_pop");
  });

  it("hides a column that is not a boolean, and everything for no row", () => {
    expect(visibleCategories({ ...TODAY, new_like: null }).map((c) => c.value)).not.toContain("new_like");
    expect(visibleCategories(undefined)).toEqual([]);
    expect(visibleCategories(null)).toEqual([]);
  });
});

describe("turningOnNeedsPermission", () => {
  it("asks iOS only when a switch goes on and iOS has not been asked yet", () => {
    expect(turningOnNeedsPermission(true, { status: "undetermined", canAskAgain: true })).toBe(true);
    expect(turningOnNeedsPermission(false, { status: "undetermined", canAskAgain: true })).toBe(false);
    expect(turningOnNeedsPermission(true, { status: "granted", canAskAgain: true })).toBe(false);
    expect(turningOnNeedsPermission(true, { status: "denied", canAskAgain: false })).toBe(false);
    expect(turningOnNeedsPermission(true, undefined)).toBe(false);
  });
});

describe("notification copy", () => {
  const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

  it("toasts a failed save plainly", () => {
    expect(NOTIFICATION_SAVE_FAILED).toBe("Couldn't save that. Try again.");
  });

  it("has no dashes, no 'beats' and no dating words", () => {
    for (const c of NOTIFICATION_CATEGORIES) {
      for (const text of [c.label, c.hint, NOTIFICATION_SAVE_FAILED]) {
        expect(text).not.toMatch(dashes);
        expect(text).not.toMatch(/\bbeats?\b/i);
        expect(text).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
      }
    }
  });
});
