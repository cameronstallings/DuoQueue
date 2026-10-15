import { describe, expect, it } from "vitest";

import { VB_W } from "../../theme/logo-geometry";
import {
  MATCH_MARK_W,
  MATCH_REASON_COPY,
  POPPED_IN_MAX_SECONDS,
  POP_Q_FROM_UNITS,
  countdownFraction,
  formatClock,
  lockSentence,
  matchExitSteps,
  matchParams,
  matchReason,
  oRingCentre,
  oRingInnerDiameter,
  parsePoppedSeconds,
  popOFrom,
  popQFrom,
  poppedInLabel,
  poppedInSpoken,
  ringTravel,
  rollColumns,
  timeLeftSpoken,
} from "./matchMoment";

// The same sweep every new copy test uses (src/lib/invite.test.ts): no dashes, never "beats",
// nothing that reads as dating, and the Duo Pop words only ("I'm in", never "Accept" or "Lock In").
function expectCleanCopy(text: string) {
  expect(text).not.toContain("—");
  expect(text).not.toContain("–");
  expect(text.toLowerCase()).not.toContain("beats");
  expect(text).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
  expect(text).not.toMatch(/accept|lock in/i);
}

describe("ringTravel", () => {
  it("is 190 of the mark's viewBox units at any width, as on duoqueue.io", () => {
    expect(ringTravel(VB_W)).toBeCloseTo(190, 6);
    expect(ringTravel(168)).toBeCloseTo(37.135, 2);
  });
});

describe("matchParams", () => {
  it("carries the pair facts the deck knows", () => {
    expect(matchParams({ matchId: "m1", name: "Dae", photo: "https://x/p.jpg", canDuo: true, sharedGames: 3 })).toEqual({
      matchId: "m1",
      name: "Dae",
      photo: "https://x/p.jpg",
      duo: "1",
      common: "3",
    });
  });

  it("sends an empty photo and no facts when there are none", () => {
    const params = matchParams({ matchId: "m1", name: "Dae", photo: null, canDuo: false, sharedGames: null });
    expect(params).toEqual({ matchId: "m1", name: "Dae", photo: "" });
    expect(params).not.toHaveProperty("duo");
    expect(params).not.toHaveProperty("common");
  });

  it("drops zero games in common", () => {
    expect(matchParams({ matchId: "m1", name: "Dae", photo: null, canDuo: false, sharedGames: 0 })).not.toHaveProperty("common");
  });
});

describe("matchReason", () => {
  it("says the pair can queue Solo/Duo before anything else", () => {
    expect(matchReason({ duo: "1", common: "3" })).toEqual({ kind: "duo", text: "You can queue Ranked Solo/Duo" });
  });

  it("counts games in common otherwise", () => {
    expect(matchReason({ common: "1" })).toEqual({ kind: "common", text: "1 game in common" });
    expect(matchReason({ common: "3" })).toEqual({ kind: "common", text: "3 games in common" });
  });

  it("says nothing without a fact, and never a score", () => {
    for (const common of ["0", "", undefined, "abc", "-2", "2.5"]) {
      expect(matchReason({ common })).toBeNull();
    }
    expect(matchReason({})).toBeNull();
  });

  it("has no em dash", () => {
    for (const text of Object.values(MATCH_REASON_COPY)) expect(text).not.toContain("\u{2014}");
    expect(matchReason({ common: "3" })?.text).not.toContain("\u{2014}");
  });
});

describe("matchExitSteps", () => {
  it("closes the sheet or swaps it for the chat when it sits over another screen", () => {
    expect(matchExitSteps("keep-swiping", true)).toEqual(["back"]);
    expect(matchExitSteps("message", true)).toEqual(["replace-with-chat"]);
  });

  it("goes through the tabs when the match screen is the whole stack (after an invite)", () => {
    expect(matchExitSteps("keep-swiping", false)).toEqual(["replace-with-tabs"]);
    // The chat lands on top of the tabs, so its back button has somewhere to go.
    expect(matchExitSteps("message", false)).toEqual(["replace-with-tabs", "push-chat"]);
  });

  it("never goes back when there is nothing to go back to", () => {
    for (const exit of ["keep-swiping", "message"] as const) {
      expect(matchExitSteps(exit, false)).not.toContain("back");
    }
  });
});

describe("matchParams with a Duo Pop's popped-in time", () => {
  const base = { matchId: "m1", name: "Dae", photo: null, canDuo: false, sharedGames: null };

  it("carries the seconds as a string for a whole number from 1 to 600", () => {
    expect(matchParams({ ...base, poppedInSeconds: 41 })).toEqual({ matchId: "m1", name: "Dae", photo: "", popped: "41" });
    expect(matchParams({ ...base, poppedInSeconds: 1 }).popped).toBe("1");
    expect(matchParams({ ...base, poppedInSeconds: 600 }).popped).toBe("600");
  });

  it("drops anything else, so a bad value never reaches the screen", () => {
    for (const poppedInSeconds of [0, 601, 41.5, -3, Number.NaN, null, undefined]) {
      expect(matchParams({ ...base, poppedInSeconds })).not.toHaveProperty("popped");
    }
  });

  it("leaves every caller that knows nothing about pops unchanged", () => {
    expect(matchParams(base)).toEqual({ matchId: "m1", name: "Dae", photo: "" });
  });
});

describe("parsePoppedSeconds", () => {
  it("reads the route param and the push's poppedIn", () => {
    expect(parsePoppedSeconds("41")).toBe(41);
    expect(parsePoppedSeconds(41)).toBe(41);
    expect(parsePoppedSeconds("1")).toBe(1);
    expect(parsePoppedSeconds("600")).toBe(POPPED_IN_MAX_SECONDS);
  });

  it("rejects anything that is not a whole number of seconds from 1 to 600", () => {
    for (const raw of ["4a", "-3", "0", "601", "", "4.1", " 41", "41 ", "0x10", "1e2", 41.5, 0, 601, null, undefined, {}, [], true]) {
      expect(parsePoppedSeconds(raw)).toBeNull();
    }
  });
});

describe("formatClock and the Popped-in words", () => {
  it("reads m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(41)).toBe("0:41");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(581)).toBe("9:41");
    expect(formatClock(600)).toBe("10:00");
  });

  it("never shows a negative or fractional clock", () => {
    expect(formatClock(-5)).toBe("0:00");
    expect(formatClock(41.9)).toBe("0:41");
  });

  it("stamps the time it popped in (type.label uppercases it)", () => {
    expect(poppedInLabel(41)).toBe("Popped in 0:41");
    expect(poppedInLabel(65)).toBe("Popped in 1:05");
    expect(poppedInLabel(600)).toBe("Popped in 10:00");
  });

  it("says it in words to VoiceOver", () => {
    expect(poppedInSpoken(41)).toBe("Popped in 41 seconds");
    expect(poppedInSpoken(1)).toBe("Popped in 1 second");
    expect(poppedInSpoken(60)).toBe("Popped in 1 minute");
    expect(poppedInSpoken(75)).toBe("Popped in 1 minute 15 seconds");
    expect(poppedInSpoken(600)).toBe("Popped in 10 minutes");
  });

  it("says the ring's time left in words", () => {
    expect(timeLeftSpoken(581)).toBe("9 minutes 41 seconds left");
    expect(timeLeftSpoken(60)).toBe("1 minute left");
    expect(timeLeftSpoken(41)).toBe("41 seconds left");
    expect(timeLeftSpoken(61)).toBe("1 minute 1 second left");
    expect(timeLeftSpoken(0)).toBe("0 seconds left");
    expect(timeLeftSpoken(-2)).toBe("0 seconds left");
  });
});

describe("rollColumns", () => {
  it("rolls each digit of m:ss to its place on a 0 to 9 strip, the last one spinning once more", () => {
    expect(rollColumns(41)).toEqual([
      { kind: "digit", digit: 0, cells: 0 },
      { kind: "static", text: ":" },
      { kind: "digit", digit: 4, cells: 4 },
      { kind: "digit", digit: 1, cells: 11 },
    ]);
  });

  it("handles the full ten minutes", () => {
    expect(rollColumns(600)).toEqual([
      { kind: "digit", digit: 1, cells: 1 },
      { kind: "digit", digit: 0, cells: 0 },
      { kind: "static", text: ":" },
      { kind: "digit", digit: 0, cells: 0 },
      { kind: "digit", digit: 0, cells: 10 },
    ]);
  });

  it("spells the same characters as the label", () => {
    for (const s of [1, 9, 41, 65, 599, 600]) {
      const text = rollColumns(s)
        .map((c) => (c.kind === "digit" ? String(c.digit) : c.text))
        .join("");
      expect(`Popped in ${text}`).toBe(poppedInLabel(s));
      // A strip holds 0 to 9 twice, so no column ever rolls past its last cell.
      for (const c of rollColumns(s)) if (c.kind === "digit") expect(c.cells).toBeLessThan(20);
    }
  });
});

describe("countdownFraction", () => {
  it("is the share of the ten minutes left", () => {
    expect(countdownFraction(600, 600)).toBe(1);
    expect(countdownFraction(300, 600)).toBe(0.5);
    expect(countdownFraction(0, 600)).toBe(0);
  });

  it("clamps, and is empty without a total", () => {
    expect(countdownFraction(700, 600)).toBe(1);
    expect(countdownFraction(-1, 600)).toBe(0);
    expect(countdownFraction(10, 0)).toBe(0);
    expect(countdownFraction(10, -5)).toBe(0);
  });
});

describe("the Duo Pop ring's geometry", () => {
  it("starts the O in the middle of the mark, 31.5pt right of its locked place", () => {
    expect(popOFrom(MATCH_MARK_W)).toBeCloseTo(31.52, 2);
    expect(oRingCentre(MATCH_MARK_W).x + popOFrom(MATCH_MARK_W)).toBeCloseTo(MATCH_MARK_W / 2, 6);
  });

  it("brings the Q in from 117pt right", () => {
    expect(POP_Q_FROM_UNITS).toBe(600);
    expect(popQFrom(MATCH_MARK_W)).toBeCloseTo(117.3, 1);
    expect(popQFrom(VB_W)).toBeCloseTo(600, 6);
  });

  it("centres the O ring vertically in the mark", () => {
    const { y } = oRingCentre(MATCH_MARK_W);
    expect(y).toBeCloseTo(52.48, 1);
  });

  it("leaves room inside the O for 10:00 at 16pt Plex Mono", () => {
    const inner = oRingInnerDiameter(MATCH_MARK_W);
    expect(inner).toBeCloseTo(64.7, 1);
    // Plex Mono advances 0.6em a glyph, plus the 1pt tracking after each one.
    expect(formatClock(600).length * (16 * 0.6 + 1)).toBeLessThan(inner);
  });
});

describe("lockSentence", () => {
  it("says how the duo happened", () => {
    expect(lockSentence("Kai", true)).toBe("You and Kai teamed up from a Duo Pop.");
    expect(lockSentence("Kai", false)).toBe("You and Kai both queued up.");
  });
});

describe("the new copy", () => {
  it("is clean", () => {
    for (const text of [
      lockSentence("Kai", true),
      lockSentence("Kai", false),
      poppedInLabel(41),
      poppedInSpoken(75),
      poppedInSpoken(1),
      timeLeftSpoken(581),
      timeLeftSpoken(1),
    ]) {
      expectCleanCopy(text);
    }
  });
});
