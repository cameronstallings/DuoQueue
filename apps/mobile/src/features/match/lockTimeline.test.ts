import { describe, expect, it } from "vitest";

import { springFirstReachMs } from "../launch/springMath";

import {
  BRACKETS_AFTER_RINGS_MS,
  BUTTONS_FADE_MS,
  FADE_MS,
  POPPED_AFTER_LOCK_MS,
  POPPED_ROLL_MS,
  POP_RINGS_AFTER_MS,
  SHEET_IN_MS,
  STAMP_MS,
  lockSchedule,
} from "./lockTimeline";
import { BRACKET_SPRING, RINGS_MS } from "./matchMoment";

describe("lockSchedule: plain DUO LOCKED", () => {
  const s = lockSchedule("match", false);

  it("keeps today's schedule to the millisecond", () => {
    expect(s.ringsAt).toBe(250);
    expect(s.bracketsAt).toBe(630);
    expect(s.lockAt).toBe(770);
    expect(s.playersAt).toBe(890);
    expect(s.reasonAt).toBe(1120);
    expect(s.sentenceAt).toBe(1190);
    expect(s.buttonsAt).toBe(1270);
  });

  it("has no Popped-in line", () => {
    expect(s.poppedAt).toBeNull();
    expect(s.poppedLandsAt).toBeNull();
  });

  it("brings the caller's card in after the buttons, and settles when the buttons have", () => {
    expect(s.belowButtonsAt).toBe(s.buttonsAt + 200);
    expect(s.settledAt).toBe(s.buttonsAt + BUTTONS_FADE_MS);
  });
});

describe("lockSchedule: DUO LOCKED after a Duo Pop (the sender)", () => {
  const s = lockSchedule("match", true);

  it("locks when it always did, then stamps the time", () => {
    expect(s.ringsAt).toBe(SHEET_IN_MS);
    expect(s.lockAt).toBe(770);
    expect(s.poppedAt).toBe(1030);
    expect(s.poppedLandsAt).toBe(1550);
  });

  it("brings the rest in around the digits landing", () => {
    expect(s.playersAt).toBe(1370);
    expect(s.reasonAt).toBe(1530);
    expect(s.sentenceAt).toBe(1590);
    expect(s.buttonsAt).toBe(1670);
    expect(s.settledAt).toBe(2070);
  });
});

describe("lockSchedule: the Pop card (the recipient), counted from the I'm in answer", () => {
  const s = lockSchedule("pop", true);

  it("closes the ring first, then slides the rings together", () => {
    expect(s.ringsAt).toBe(POP_RINGS_AFTER_MS);
    expect(s.bracketsAt).toBe(520);
    expect(s.lockAt).toBe(660);
  });

  it("stamps, rolls and lands", () => {
    expect(s.poppedAt).toBe(920);
    expect(s.poppedLandsAt).toBe(1440);
    expect(s.playersAt).toBe(1260);
    expect(s.reasonAt).toBe(1420);
    expect(s.sentenceAt).toBe(1480);
    expect(s.buttonsAt).toBe(1560);
    expect(s.settledAt).toBe(1960);
  });
});

describe("lockSchedule: the rules every variant keeps", () => {
  const all = [lockSchedule("match", false), lockSchedule("match", true), lockSchedule("pop", true), lockSchedule("pop", false)];

  it("locks when the rings arrive, and starts the brackets so they land with it", () => {
    for (const s of all) {
      expect(s.lockAt).toBe(s.ringsAt + RINGS_MS);
      expect(s.bracketsAt).toBe(s.ringsAt + BRACKETS_AFTER_RINGS_MS);
    }
  });

  it("starts the Popped-in line only after the stamp has finished", () => {
    for (const s of all) {
      if (s.poppedAt !== null) {
        expect(s.poppedAt).toBeGreaterThanOrEqual(s.lockAt + STAMP_MS);
        expect(s.poppedAt).toBe(s.lockAt + POPPED_AFTER_LOCK_MS);
      }
    }
  });

  it("brings the buttons in only after the digits land", () => {
    for (const s of all) {
      if (s.poppedLandsAt !== null) {
        expect(s.poppedLandsAt).toBe((s.poppedAt ?? 0) + POPPED_ROLL_MS);
        expect(s.buttonsAt).toBeGreaterThan(s.poppedLandsAt);
      }
    }
  });

  it("keeps the success and the landing taps at least 400ms apart", () => {
    for (const s of all) {
      if (s.poppedLandsAt !== null) expect(s.poppedLandsAt - s.lockAt).toBeGreaterThanOrEqual(400);
    }
  });

  it("brings everything in after the lock, in order", () => {
    for (const s of all) {
      expect(s.playersAt).toBeGreaterThan(s.lockAt);
      expect(s.reasonAt).toBeGreaterThan(s.playersAt);
      expect(s.sentenceAt).toBeGreaterThan(s.reasonAt);
      expect(s.buttonsAt).toBeGreaterThan(s.sentenceAt);
      // The 300ms fades before the buttons are done before the screen is settled.
      expect(s.sentenceAt + FADE_MS).toBeLessThanOrEqual(s.settledAt);
    }
  });
});

describe("the brackets' spring", () => {
  it("first reaches home within 15ms of the lock", () => {
    const s = lockSchedule("match", false);
    const home = s.bracketsAt + springFirstReachMs(BRACKET_SPRING, 0, 1);
    expect(Math.abs(home - s.lockAt)).toBeLessThanOrEqual(15);
  });
});
