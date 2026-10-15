import { describe, expect, it } from "vitest";

import {
  DUO_LOCKED_TITLE,
  DUO_POP_TITLE,
  duoCallLockedPush,
  duoLockedPush,
  duoPopPush,
  duoPopVariant,
  formatPoppedIn,
  poppedInSeconds,
  sanitizeRankText,
} from "./duoPopCopy";

// The two dashes spelled by code, so this file carries neither character.
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

// apps/mobile/src/lib/invite.test.ts's dating sweep, plus the words a push to a stranger must
// never use.
const DATING = /dating|singles|hookup|nearby|meet people|match with singles|\bdates?\b|crush|interested in you/i;

const POP_A = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

function allDuoPopCopy() {
  const out = [];
  for (const gameName of ["League of Legends", "Valorant", "Apex Legends", "Overwatch 2"]) {
    for (const rankText of ["Gold II", "Emerald I", "Diamond 2", null, "", "Unranked"]) {
      for (const canDuo of [true, false]) {
        for (const variant of [0, 1, 2]) {
          out.push({ input: { gameName, rankText, canDuo, variant }, copy: duoPopPush({ gameName, rankText, canDuo, variant }) });
        }
      }
    }
  }
  return out;
}

describe("duoPopPush: Group Q's copy, word for word", () => {
  it("a rank and can duo: the can-duo line", () => {
    expect(duoPopPush({ gameName: "League of Legends", rankText: "Gold II", canDuo: true, variant: 1 })).toEqual({
      title: "Duo Pop",
      body: "A Gold II player who can duo with you (by rank) is queueing League of Legends now.",
    });
  });

  it("a rank without can duo: the rank line", () => {
    expect(duoPopPush({ gameName: "League of Legends", rankText: "Diamond I", canDuo: false, variant: 2 })).toEqual({
      title: "Duo Pop",
      body: "A Diamond I League of Legends player is queueing now. First to tap I'm in gets the duo.",
    });
  });

  it("no rank: one of three, by variant", () => {
    const body = (variant: number) => duoPopPush({ gameName: "Valorant", rankText: null, canDuo: false, variant }).body;
    expect(body(0)).toBe("A Valorant player is queueing now. First to tap I'm in gets the duo.");
    expect(body(1)).toBe("Someone in Valorant wants a duo right now.");
    expect(body(2)).toBe("A Valorant player just queued up. Want in?");
  });

  it("'An' before a vowel", () => {
    expect(duoPopPush({ gameName: "League of Legends", rankText: "Emerald I", canDuo: true, variant: 0 }).body).toBe(
      "An Emerald I player who can duo with you (by rank) is queueing League of Legends now.",
    );
    expect(duoPopPush({ gameName: "Apex Legends", rankText: null, canDuo: false, variant: 0 }).body).toBe(
      "An Apex Legends player is queueing now. First to tap I'm in gets the duo.",
    );
  });

  it("the can-duo wording appears only when can duo is true", () => {
    for (const { input, copy } of allDuoPopCopy()) {
      const says = copy.body.includes("can duo with you");
      expect(says).toBe(input.canDuo && sanitizeRankText(input.rankText) !== null);
    }
  });

  it("without a rank, can duo is not claimed (there is no rank to stand behind it)", () => {
    expect(duoPopPush({ gameName: "League of Legends", rankText: null, canDuo: true, variant: 0 }).body).not.toContain("can duo");
  });

  it("an odd variant still picks one of the three", () => {
    const bodies = new Set([0, 1, 2].map((v) => duoPopPush({ gameName: "Valorant", rankText: null, canDuo: false, variant: v }).body));
    for (const v of [-1, 3, 4, 1.5, Number.NaN]) {
      expect(bodies.has(duoPopPush({ gameName: "Valorant", rankText: null, canDuo: false, variant: v }).body)).toBe(true);
    }
  });

  it("every body: title Duo Pop, I'm in never Accept or Lock In, no dashes, no beats, no dating, names nobody", () => {
    for (const { copy } of allDuoPopCopy()) {
      const text = `${copy.title} ${copy.body}`;
      expect(copy.title).toBe(DUO_POP_TITLE);
      expect(text).not.toMatch(/accept|lock in/i);
      expect(text).not.toMatch(/beats/i);
      expect(text).not.toMatch(DATING);
      expect(text).not.toContain(EN_DASH);
      expect(text).not.toContain(EM_DASH);
      expect(text).not.toMatch(/riot/i);
      if (text.includes("tap")) expect(text).toContain("I'm in");
    }
  });
});

describe("sanitizeRankText", () => {
  it("keeps a real rank, trimmed and on one line", () => {
    expect(sanitizeRankText("Gold II")).toBe("Gold II");
    expect(sanitizeRankText("  Diamond   2 \n")).toBe("Diamond 2");
  });

  it("turns a typed en or em dash into a hyphen", () => {
    expect(sanitizeRankText(`Plat ${EN_DASH} 3`)).toBe("Plat - 3");
    expect(sanitizeRankText(`Gold${EM_DASH}Plat`)).toBe("Gold-Plat");
  });

  it("drops blank, Unranked, over-long and non-string values", () => {
    expect(sanitizeRankText("")).toBeNull();
    expect(sanitizeRankText("   ")).toBeNull();
    expect(sanitizeRankText("Unranked")).toBeNull();
    expect(sanitizeRankText("unranked")).toBeNull();
    expect(sanitizeRankText("x".repeat(25))).toBeNull();
    expect(sanitizeRankText("x".repeat(24))).toBe("x".repeat(24));
    expect(sanitizeRankText(null)).toBeNull();
    expect(sanitizeRankText(undefined)).toBeNull();
    expect(sanitizeRankText(7)).toBeNull();
  });

  it("control characters never reach a push", () => {
    expect(sanitizeRankText("Gold\u0000II")).toBe("Gold II");
  });
});

describe("duoPopVariant", () => {
  it("is parseInt(popId.slice(0, 8), 16) % 3, so the same pop always reads the same", () => {
    expect(duoPopVariant(POP_A)).toBe(Number.parseInt("0a1b2c3d", 16) % 3);
    expect(duoPopVariant(POP_A)).toBe(duoPopVariant(POP_A));
    expect(duoPopVariant("00000000-0000-4000-8000-000000000000")).toBe(0);
    expect(duoPopVariant("00000001-0000-4000-8000-000000000000")).toBe(1);
    expect(duoPopVariant("00000002-0000-4000-8000-000000000000")).toBe(2);
    expect(duoPopVariant("ffffffff-0000-4000-8000-000000000000")).toBe(0xffffffff % 3);
  });

  it("an unparseable id is variant 0", () => {
    expect(duoPopVariant("zzzzzzzz")).toBe(0);
    expect(duoPopVariant("")).toBe(0);
  });
});

describe("Popped in", () => {
  it("formatPoppedIn: m:ss, clamped to 1..600", () => {
    expect(formatPoppedIn(41)).toBe("0:41");
    expect(formatPoppedIn(581)).toBe("9:41");
    expect(formatPoppedIn(600)).toBe("10:00");
    expect(formatPoppedIn(5)).toBe("0:05");
    expect(formatPoppedIn(0)).toBe("0:01");
    expect(formatPoppedIn(9999)).toBe("10:00");
    expect(formatPoppedIn(Number.NaN)).toBe("0:01");
  });

  it("poppedInSeconds: ceil of locked minus created, clamped 1..600, as get_my_queue_up computes it", () => {
    expect(poppedInSeconds("2026-10-15T20:00:00.000Z", "2026-10-15T20:00:40.200Z")).toBe(41);
    expect(poppedInSeconds("2026-10-15T20:00:00Z", "2026-10-15T20:00:00Z")).toBe(1);
    expect(poppedInSeconds("2026-10-15T20:00:00Z", "2026-10-15T20:30:00Z")).toBe(600);
    // As PostgREST returns timestamptz: microseconds and a +00:00 offset.
    expect(poppedInSeconds("2026-10-15T20:00:00.000001+00:00", "2026-10-15T20:09:41.000001+00:00")).toBe(581);
  });

  it("poppedInSeconds: null when either time is missing or does not parse", () => {
    expect(poppedInSeconds(null, "2026-10-15T20:00:00Z")).toBeNull();
    expect(poppedInSeconds("2026-10-15T20:00:00Z", undefined)).toBeNull();
    expect(poppedInSeconds("yesterday", "2026-10-15T20:00:00Z")).toBeNull();
  });
});

describe("duoLockedPush", () => {
  it("to the sender: Group Q's words", () => {
    expect(duoLockedPush("Kai", 41)).toEqual({ title: "Duo locked", body: "Kai grabbed your Duo Pop. Popped in 0:41." });
  });

  it("a missing name still reads as a sentence", () => {
    expect(duoLockedPush(null, 581).body).toBe("Someone grabbed your Duo Pop. Popped in 9:41.");
    expect(duoLockedPush("  ", 581).body).toBe("Someone grabbed your Duo Pop. Popped in 9:41.");
  });

  it("no dashes, no beats, no dating, never Accept or Lock In", () => {
    const copy = duoLockedPush("Sam", 120);
    const text = `${copy.title} ${copy.body}`;
    expect(copy.title).toBe(DUO_LOCKED_TITLE);
    expect(text).not.toMatch(/accept|lock in|beats/i);
    expect(text).not.toMatch(DATING);
    expect(text).not.toContain(EN_DASH);
    expect(text).not.toContain(EM_DASH);
  });
});

describe("duoCallLockedPush (0088: one duo per Queue up)", () => {
  it("to the sender when a new player joins with the post's code: Duo locked, no Popped in", () => {
    expect(duoCallLockedPush("Sam")).toEqual({ title: "Duo locked", body: "Sam answered your LFG post." });
  });

  it("a missing or blank name still reads as a sentence", () => {
    expect(duoCallLockedPush(null).body).toBe("Someone answered your LFG post.");
    expect(duoCallLockedPush(undefined).body).toBe("Someone answered your LFG post.");
    expect(duoCallLockedPush("   ").body).toBe("Someone answered your LFG post.");
  });

  it("a typed name is made one line, and its dashes become hyphens", () => {
    expect(duoCallLockedPush(`Kai\n${EM_DASH}Main`).body).toBe("Kai -Main answered your LFG post.");
  });

  it("no dashes, no beats, no dating, never Accept or Lock In", () => {
    const copy = duoCallLockedPush("Sam");
    const text = `${copy.title} ${copy.body}`;
    expect(copy.title).toBe(DUO_LOCKED_TITLE);
    expect(text).not.toMatch(/accept|lock in|beats/i);
    expect(text).not.toMatch(DATING);
    expect(text).not.toContain(EN_DASH);
    expect(text).not.toContain(EM_DASH);
  });
});
