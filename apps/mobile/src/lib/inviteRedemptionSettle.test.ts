import { describe, expect, it } from "vitest";

import { redemptionStillWanted, type RedemptionSettleState } from "./invite";

/**
 * The settle gate of `useInviteRedemption` (src/features/invite/useInvite.ts). Its own file so the
 * fix can be cherry-picked onto release/1.0.1, where the same hook never settled an answer: the
 * old `cancelled` flag was set by the effect's cleanup, which `markRedeeming()` itself triggered.
 */

const CODE = "HKT98T1B9J";

/** The store right after `markRedeeming()` for CODE, signed in: the moment the RPC is sent. */
const waiting: RedemptionSettleState = { pendingCode: CODE, redemption: "pending", sessionStatus: "signed_in" };

describe("redemptionStillWanted", () => {
  it("settles the answer while the store is still waiting on the same code", () => {
    // Also the state after the re-render markRedeeming() causes (the effect re-runs and returns
    // early), which is exactly where the old cleanup flag had already dropped the answer.
    expect(redemptionStillWanted(waiting, CODE)).toBe(true);
  });

  it("drops the answer once a newer code replaced it", () => {
    expect(redemptionStillWanted({ ...waiting, pendingCode: "ABCDE12345", redemption: "idle" }, CODE)).toBe(false);
    expect(redemptionStillWanted({ ...waiting, pendingCode: "ABCDE12345" }, CODE)).toBe(false);
  });

  it("drops the answer when the code is gone (settled, or the arrival was cleared)", () => {
    expect(redemptionStillWanted({ ...waiting, pendingCode: null, redemption: "done" }, CODE)).toBe(false);
    expect(redemptionStillWanted({ ...waiting, pendingCode: null, redemption: "failed" }, CODE)).toBe(false);
    expect(redemptionStillWanted({ ...waiting, pendingCode: null, redemption: "idle" }, CODE)).toBe(false);
  });

  it("drops the answer when the status is no longer pending", () => {
    expect(redemptionStillWanted({ ...waiting, redemption: "idle" }, CODE)).toBe(false);
    expect(redemptionStillWanted({ ...waiting, redemption: "failed" }, CODE)).toBe(false);
    expect(redemptionStillWanted({ ...waiting, redemption: "done" }, CODE)).toBe(false);
  });

  it("drops the answer after a sign-out or while the session is loading", () => {
    expect(redemptionStillWanted({ ...waiting, sessionStatus: "signed_out" }, CODE)).toBe(false);
    expect(redemptionStillWanted({ ...waiting, sessionStatus: "loading" }, CODE)).toBe(false);
  });
});
