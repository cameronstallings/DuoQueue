import { describe, expect, it } from "vitest";

import {
  isPendingCustomGame,
  normalizeCustomName,
  orderQuickPicks,
  PENDING_CUSTOM_PREFIX,
  pendingCustomGameId,
  QUICK_PICK_GAMES,
  showAddCustom,
} from "./catalogSearch";

describe("QUICK_PICK_GAMES", () => {
  it("leads with League of Legends", () => {
    expect(QUICK_PICK_GAMES[0]).toBe("League of Legends");
    expect(QUICK_PICK_GAMES).toEqual([
      "League of Legends",
      "Fortnite",
      "Valorant",
      "Rainbow Six Siege",
      "Rocket League",
      "Call of Duty: Warzone",
    ]);
  });
});

describe("orderQuickPicks", () => {
  it("keeps the quick-pick order whatever order the rows came back in", () => {
    const rows = [
      { id: "3", name: "Valorant" },
      { id: "1", name: "League of Legends" },
      { id: "2", name: "Fortnite" },
    ];
    expect(orderQuickPicks(rows).map((r) => r.name)).toEqual(["League of Legends", "Fortnite", "Valorant"]);
  });

  it("matches names case-insensitively and drops strangers", () => {
    const rows = [
      { id: "1", name: "league of legends" },
      { id: "9", name: "Tetris" },
    ];
    expect(orderQuickPicks(rows)).toEqual([{ id: "1", name: "league of legends" }]);
  });

  it("keeps one row per quick pick", () => {
    const rows = [
      { id: "1", name: "Fortnite" },
      { id: "2", name: "FORTNITE" },
    ];
    expect(orderQuickPicks(rows)).toEqual([{ id: "1", name: "Fortnite" }]);
  });
});

describe("showAddCustom", () => {
  const settledEmpty = { trimmed: "zelda", debounced: "zelda", isFetching: false, resultCount: 0, minQuery: 2 };

  it("is true only for a settled search with no rows", () => {
    expect(showAddCustom(settledEmpty)).toBe(true);
  });

  it("is false while fetching", () => {
    expect(showAddCustom({ ...settledEmpty, isFetching: true })).toBe(false);
  });

  it("is false while the debounced query still differs from what was typed", () => {
    expect(showAddCustom({ ...settledEmpty, debounced: "zeld" })).toBe(false);
  });

  it("is false below the minimum query", () => {
    expect(showAddCustom({ ...settledEmpty, trimmed: "z", debounced: "z" })).toBe(false);
  });

  it("is false with any result", () => {
    expect(showAddCustom({ ...settledEmpty, resultCount: 1 })).toBe(false);
  });
});

describe("custom games", () => {
  it("normalizes the name: trimmed, single spaces, at most 60 characters", () => {
    expect(normalizeCustomName("  Deep   Rock  Galactic ")).toBe("Deep Rock Galactic");
    expect(normalizeCustomName("x".repeat(80))).toHaveLength(60);
  });

  it("round-trips a pending id", () => {
    const id = pendingCustomGameId("  Deep   Rock ");
    expect(id).toBe(`${PENDING_CUSTOM_PREFIX}Deep Rock`);
    expect(isPendingCustomGame(id)).toBe(true);
    expect(isPendingCustomGame("2b6f0cc9-3a3c-4c5e-9d2f-8c1a2d3e4f50")).toBe(false);
  });
});
