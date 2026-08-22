import { describe, expect, it } from "vitest";

import { buildNewPlayerAlertCopy, sendDecision } from "./new-player-alert";

describe("buildNewPlayerAlertCopy", () => {
  it("names the shared game when exactly one player joined", () => {
    expect(buildNewPlayerAlertCopy(1, "Valorant")).toEqual({
      title: "Someone new plays Valorant",
      body: "A new player just joined DuoQueue and they are in your deck now.",
    });
  });

  it("counts and pluralises when several joined", () => {
    expect(buildNewPlayerAlertCopy(3, "Valorant")).toEqual({
      title: "3 new players joined",
      body: "They play games from your list, Valorant among them. Open your deck to see who.",
    });
  });

  it("never says '1 new players joined'", () => {
    // The singular branch is keyed on count === 1 and this is the assertion that keeps it
    // that way; a refactor to `count > 1 ? ... : ...` would pass every other test here.
    expect(buildNewPlayerAlertCopy(1, "League of Legends").title).not.toMatch(/\bplayers\b/);
    expect(buildNewPlayerAlertCopy(2, "League of Legends").title).toBe("2 new players joined");
  });

  it("still says something true when the headline game is missing", () => {
    // headline_game is non-null by construction, but it arrives over the wire and
    // "Someone new plays null" is exactly the sort of thing that ships.
    expect(buildNewPlayerAlertCopy(1, null)).toEqual({
      title: "Someone new just joined",
      body: "A new player just joined DuoQueue and they are in your deck now.",
    });
    expect(buildNewPlayerAlertCopy(4, null)).toEqual({
      title: "4 new players joined",
      body: "They play games from your list. Open your deck to see who.",
    });
  });

  it("treats a blank or whitespace game name as missing", () => {
    expect(buildNewPlayerAlertCopy(1, "   ").title).toBe("Someone new just joined");
    expect(buildNewPlayerAlertCopy(2, "").body).toBe("They play games from your list. Open your deck to see who.");
  });

  it("trims a padded game name rather than rendering the padding", () => {
    expect(buildNewPlayerAlertCopy(1, "  Minecraft  ").title).toBe("Someone new plays Minecraft");
  });

  it("never reads as dating, for any count or game", () => {
    // DuoQueue is an 18+ PLATONIC gaming app that was rejected once under App Store guideline
    // 2.3.6. This is a string App Review can be shown without opening the app.
    for (const count of [1, 2, 7, 200]) {
      for (const game of ["Valorant", "Rainbow Six Siege", null]) {
        const { title, body } = buildNewPlayerAlertCopy(count, game);
        expect(`${title} ${body}`).not.toMatch(/date|dating|singles|hookup|nearby|romance|flirt/i);
      }
    }
  });

  it("names nobody", () => {
    // No display name and no profile id in the copy: the deck is where identity belongs.
    const { title, body } = buildNewPlayerAlertCopy(1, "Valorant");
    expect(`${title} ${body}`).not.toMatch(/@|\bid\b/i);
  });
});

describe("sendDecision", () => {
  it("sends when this run claimed the ledger rows", () => {
    expect(sendDecision({ ledgerError: false, claimedCount: 1 })).toBe("send");
    expect(sendDecision({ ledgerError: false, claimedCount: 3 })).toBe("send");
  });

  it("does not send when the ledger write failed", () => {
    // Sending anyway would mean the pair is never recorded and the next run sends it again.
    expect(sendDecision({ ledgerError: true, claimedCount: null })).toBe("skip-ledger-write-failed");
    expect(sendDecision({ ledgerError: true, claimedCount: 0 })).toBe("skip-ledger-write-failed");
  });

  it("does not send when a concurrent run already claimed every pair", () => {
    expect(sendDecision({ ledgerError: false, claimedCount: 0 })).toBe("skip-claimed-by-another-run");
  });

  it("sends when the insert came back without a count to read", () => {
    // Absence of an answer is not "somebody else has it". The pair is in the ledger either
    // way, so resolving this to skip would be a silent miss on every single run.
    expect(sendDecision({ ledgerError: false, claimedCount: null })).toBe("send");
  });
});
