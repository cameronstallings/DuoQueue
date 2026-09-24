import { describe, expect, it } from "vitest";

import { PLAYSTYLE_LABELS, TILT_HANDLING_LABELS } from "../onboarding/profile-labels";
import { type HowIPlayInput, hourLabel, howIPlayTiles, playWindowWords, vibeBand } from "./howIPlay";

const BASE: HowIPlayInput = {
  vibe: { intensity: 10, commsStyle: 50, coachingPref: 50, tiltHandling: "stays_calm" },
  playstyles: ["chill", "casual_coop", "team_player"],
  playWindow: { startHour: 20, endHour: 0 },
  playstyleLabels: PLAYSTYLE_LABELS,
  tiltLabels: TILT_HANDLING_LABELS,
};

describe("vibeBand", () => {
  it("splits 0-100 into three bands with a wide middle", () => {
    expect([0, 33, 34, 50, 66, 67, 100].map(vibeBand)).toEqual(["low", "low", "mid", "mid", "mid", "high", "high"]);
  });

  it("clamps out-of-range values and treats NaN as the middle", () => {
    expect(vibeBand(-10)).toBe("low");
    expect(vibeBand(140)).toBe("high");
    expect(vibeBand(Number.NaN)).toBe("mid");
  });
});

describe("hourLabel", () => {
  it("writes 12-hour times", () => {
    expect([0, 1, 11, 12, 13, 23].map(hourLabel)).toEqual(["12 AM", "1 AM", "11 AM", "12 PM", "1 PM", "11 PM"]);
  });
});

describe("playWindowWords", () => {
  it("names a preset and gives its hours", () => {
    expect(playWindowWords(17, 21)).toEqual({ value: "Evening", caption: "5 PM to 9 PM" });
    expect(playWindowWords(21, 1)).toEqual({ value: "Night", caption: "9 PM to 1 AM" });
    expect(playWindowWords(1, 5)).toEqual({ value: "Late night", caption: "1 AM to 5 AM" });
  });

  it("gives the hours alone for any other window", () => {
    expect(playWindowWords(20, 0)).toEqual({ value: "8 PM to 12 AM", caption: null });
  });

  it("is null when either hour is missing", () => {
    expect(playWindowWords(null, 5)).toBeNull();
    expect(playWindowWords(5, null)).toBeNull();
  });
});

describe("howIPlayTiles", () => {
  it("is STYLE, WHEN, COMMS, AFTER A LOSS in words", () => {
    expect(howIPlayTiles(BASE)).toEqual([
      {
        key: "style",
        label: "Style",
        value: "Chill",
        caption: "Casual co-op · Team player",
        accessibilityLabel: "Style: Chill. Casual co-op · Team player",
      },
      { key: "when", label: "When", value: "8 PM to 12 AM", caption: null, accessibilityLabel: "When: 8 PM to 12 AM" },
      {
        key: "comms",
        label: "Comms",
        value: "Mic sometimes",
        caption: "Open to tips",
        accessibilityLabel: "Comms: Mic sometimes. Open to tips",
      },
      {
        key: "afterLoss",
        label: "After a loss",
        value: "Stays calm",
        caption: null,
        accessibilityLabel: "After a losing streak: Stays calm",
      },
    ]);
  });

  it("drops the WHEN tile without a play window", () => {
    const tiles = howIPlayTiles({ ...BASE, playWindow: { startHour: null, endHour: null } });
    expect(tiles.map((t) => t.key)).toEqual(["style", "comms", "afterLoss"]);
  });

  it("keeps only WHEN without vibe answers", () => {
    expect(howIPlayTiles({ ...BASE, vibe: null }).map((t) => t.key)).toEqual(["when"]);
  });

  it("uses the high words", () => {
    const tiles = howIPlayTiles({ ...BASE, vibe: { intensity: 90, commsStyle: 90, coachingPref: 90, tiltHandling: "stays_calm" } });
    expect(tiles.find((t) => t.key === "style")?.value).toBe("Ranked grind");
    expect(tiles.find((t) => t.key === "comms")).toMatchObject({ value: "Mic on", caption: "Wants coaching" });
  });

  it("uses the low words", () => {
    const tiles = howIPlayTiles({ ...BASE, vibe: { intensity: 50, commsStyle: 0, coachingPref: 0, tiltHandling: "stays_calm" } });
    expect(tiles.find((t) => t.key === "style")?.value).toBe("Balanced");
    expect(tiles.find((t) => t.key === "comms")).toMatchObject({ value: "Mostly quiet", caption: "No tips, please" });
  });

  it("splits every tilt answer into a short value and caption, and speaks the full answer", () => {
    const cases = [
      ["gets_frustrated_sometimes", "Gets frustrated", "Sometimes"],
      ["tilts_but_recovers_fast", "Recovers fast", "After a quick tilt"],
      ["needs_space_after_losses", "Needs space", null],
    ] as const;
    for (const [tiltHandling, value, caption] of cases) {
      const tile = howIPlayTiles({ ...BASE, vibe: { ...BASE.vibe!, tiltHandling } }).find((t) => t.key === "afterLoss");
      expect(tile).toMatchObject({ value, caption, accessibilityLabel: `After a losing streak: ${TILT_HANDLING_LABELS[tiltHandling]}` });
    }
  });

  it("caps the style caption at two playstyles, in catalog order", () => {
    const tiles = howIPlayTiles({ ...BASE, vibe: { ...BASE.vibe!, intensity: 90 }, playstyles: ["team_player", "grinder", "chill"] });
    expect(tiles[0]?.caption).toBe("Chill · Grinder");
  });

  it("has no style caption without playstyles", () => {
    expect(howIPlayTiles({ ...BASE, playstyles: [] })[0]?.caption).toBeNull();
  });

  it("has no em dash anywhere", () => {
    for (const tile of howIPlayTiles(BASE)) {
      for (const text of [tile.label, tile.value, tile.caption ?? "", tile.accessibilityLabel]) {
        expect(text).not.toContain("\u2014");
      }
    }
  });
});
