import { describe, expect, it } from "vitest";

import {
  emptyDeckReason,
  filteredSubtitle,
  firstPingStep,
  pingOutcome,
  type EmptyDeckInputs,
} from "./emptyDeckDecisions";

/** Everything resolved, nobody in the pool, notifications fully working. Each test overrides
 *  only the fact it is about, so a case about the pool does not have to restate permission. */
const resolved: EmptyDeckInputs = {
  poolSize: 0,
  poolFailed: false,
  permissionGranted: true,
  permissionFailed: false,
  newPlayerAlertsEnabled: true,
};

describe("emptyDeckReason", () => {
  it("resolves while the pool count is still in flight", () => {
    expect(emptyDeckReason({ ...resolved, poolSize: undefined })).toEqual({ kind: "resolving" });
  });

  it("resolves while the permission state is still being read", () => {
    expect(emptyDeckReason({ ...resolved, permissionGranted: undefined })).toEqual({
      kind: "resolving",
    });
  });

  it("does not stay resolving when the pool count fails", () => {
    // A spinning skeleton forever is a worse screen than any wrong sentence this function was
    // written to prevent. get_deck_pool_size is rate limited at 20/minute and this screen is
    // its only caller, so the failure is reachable.
    expect(emptyDeckReason({ ...resolved, poolSize: undefined, poolFailed: true })).toEqual({
      kind: "new",
      canPing: true,
      permissionGranted: true,
    });
  });

  it("treats an unreadable permission state as not granted", () => {
    expect(
      emptyDeckReason({ ...resolved, permissionGranted: undefined, permissionFailed: true }),
    ).toEqual({ kind: "new", canPing: false, permissionGranted: false });
  });

  it("blames the filters when the pool is not empty", () => {
    expect(emptyDeckReason({ ...resolved, poolSize: 7 })).toEqual({ kind: "filtered", poolSize: 7 });
  });

  it("blames the filters for a pool of exactly one", () => {
    expect(emptyDeckReason({ ...resolved, poolSize: 1 })).toEqual({ kind: "filtered", poolSize: 1 });
  });

  it("says the deck is genuinely empty when the pool is zero", () => {
    // "Nobody has joined yet" and "you have swiped everyone" both land here, and both want the
    // same screen: a ping when somebody new who shares your games signs up.
    expect(emptyDeckReason(resolved)).toEqual({
      kind: "new",
      canPing: true,
      permissionGranted: true,
    });
  });

  it("does not promise a ping when the OS permission is missing", () => {
    expect(emptyDeckReason({ ...resolved, permissionGranted: false })).toEqual({
      kind: "new",
      canPing: false,
      permissionGranted: false,
    });
  });

  it("does not promise a ping when the in-app toggle is off, even with permission granted", () => {
    // The sweep filters opted-out recipients in SQL, so this push would never be sent. The
    // permission flag stays true so the screen can send the user to the right settings screen
    // rather than raising an OS prompt that would do nothing.
    expect(emptyDeckReason({ ...resolved, newPlayerAlertsEnabled: false })).toEqual({
      kind: "new",
      canPing: false,
      permissionGranted: true,
    });
  });

  it("prefers the filtered screen over the ping offer when both could apply", () => {
    // Someone with filters hiding everyone and notifications off has two problems; only one of
    // them is why their deck is empty today.
    expect(
      emptyDeckReason({ ...resolved, poolSize: 3, permissionGranted: false }),
    ).toEqual({ kind: "filtered", poolSize: 3 });
  });
});

describe("filteredSubtitle", () => {
  it("uses the singular for one", () => {
    expect(filteredSubtitle(1)).toBe(
      "There is 1 player you could see right now, but your current filters rule them out.",
    );
  });

  it("uses the plural for more than one", () => {
    expect(filteredSubtitle(4)).toBe(
      "There are 4 players you could see right now, but your current filters rule them out.",
    );
  });

  it("never says dating, matches, or people looking for anything", () => {
    // 18+ platonic gaming app, rejected once under guideline 2.3.6. The empty state is a screen
    // a reviewer will reach, because at this density they will reach it by swiping four cards.
    const forbidden = [/\bdate\b/i, /\bdating\b/i, /\bsingles\b/i, /\bmatch\b/i, /\bnearby\b/i];
    for (const n of [0, 1, 2, 25]) {
      for (const pattern of forbidden) expect(filteredSubtitle(n)).not.toMatch(pattern);
    }
  });
});

describe("firstPingStep", () => {
  it("asks the OS when permission has not been granted", () => {
    expect(firstPingStep({ canPing: false, permissionGranted: false })).toBe("request-permission");
  });

  it("goes to the in-app settings when permission is granted but the ping is still off", () => {
    // The only other input to canPing is the toggle, so this state means the toggle. Raising an
    // OS prompt here would resolve instantly with the answer already on file and look broken.
    expect(firstPingStep({ canPing: false, permissionGranted: true })).toBe(
      "open-notification-settings",
    );
  });

  it("does nothing when the ping already works", () => {
    expect(firstPingStep({ canPing: true, permissionGranted: true })).toBe("nothing");
  });
});

describe("pingOutcome", () => {
  it("registers a push token once permission is granted", () => {
    // Permission is not a token: the alert sweep joins push_tokens, so granting without
    // registering leaves a consenting user with no address.
    expect(pingOutcome({ granted: true, canAskAgain: false })).toBe("register-token");
    expect(pingOutcome({ granted: true, canAskAgain: true })).toBe("register-token");
  });

  it("sends the user to Settings only when iOS will not prompt again", () => {
    expect(pingOutcome({ granted: false, canAskAgain: false })).toBe("open-os-settings");
  });

  it("respects a fresh refusal instead of routing around it", () => {
    // granted false with canAskAgain true is the user having just tapped "Don't Allow" on the
    // prompt this button raised. Opening Settings a second later is asking again with steps.
    expect(pingOutcome({ granted: false, canAskAgain: true })).toBe("nothing");
  });
});
