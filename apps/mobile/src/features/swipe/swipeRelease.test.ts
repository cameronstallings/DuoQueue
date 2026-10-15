import { describe, expect, it } from "vitest";

import {
  BLOCKED_NUDGE,
  EXIT_MAX_MS,
  EXIT_MIN_MS,
  FLING_MIN_TRAVEL,
  FLING_VELOCITY,
  OFFSCREEN_MARGIN,
  SWIPE_THRESHOLD,
  exitDuration,
  exitY,
  offscreenX,
  releaseDecision,
} from "./swipeRelease";

describe("the release constants", () => {
  it("keeps the 120pt threshold the card always had, and the plan's fling numbers", () => {
    expect(SWIPE_THRESHOLD).toBe(120);
    expect(FLING_VELOCITY).toBe(800);
    expect(FLING_MIN_TRAVEL).toBe(32);
    expect(EXIT_MIN_MS).toBe(140);
    expect(EXIT_MAX_MS).toBe(320);
    expect(OFFSCREEN_MARGIN).toBe(120);
    expect(BLOCKED_NUDGE).toBe(28);
  });
});

describe("releaseDecision", () => {
  it("counts a card dragged past the threshold, either way", () => {
    expect(releaseDecision(121, 0)).toBe("like");
    expect(releaseDecision(-121, 0)).toBe("pass");
  });

  it("does not count a slow release short of the threshold", () => {
    expect(releaseDecision(119, 0)).toBeNull();
    expect(releaseDecision(100, 799)).toBeNull();
    expect(releaseDecision(0, 0)).toBeNull();
  });

  it("counts a short fast flick in the direction it travelled", () => {
    expect(releaseDecision(40, 900)).toBe("like");
    expect(releaseDecision(-40, -900)).toBe("pass");
  });

  it("does not count a flick against the way the card went", () => {
    expect(releaseDecision(40, -900)).toBeNull();
    expect(releaseDecision(-40, 900)).toBeNull();
  });

  it("does not count a flick that barely moved the card (a tap with a twitch)", () => {
    expect(releaseDecision(20, 2000)).toBeNull();
    expect(releaseDecision(-31, -2000)).toBeNull();
    expect(releaseDecision(32, 801)).toBe("like");
  });

  it("lets a card past the threshold be thrown back to cancel", () => {
    expect(releaseDecision(130, -900)).toBeNull();
    expect(releaseDecision(-130, 900)).toBeNull();
  });

  it("keeps a card past the threshold that drifts back slowly", () => {
    expect(releaseDecision(130, -500)).toBe("like");
    expect(releaseDecision(-130, 500)).toBe("pass");
  });

  it("needs strictly more than the threshold and the fling speed", () => {
    expect(releaseDecision(120, 0)).toBeNull();
    expect(releaseDecision(40, 800)).toBeNull();
  });
});

describe("exitDuration", () => {
  it("matches the release speed (an out-quad starts at twice its average speed)", () => {
    expect(exitDuration(300, 3000)).toBe(200);
  });

  it("never takes longer than 320ms", () => {
    expect(exitDuration(400, 2000)).toBe(320);
  });

  it("never takes less than 140ms, so a hard throw still reads", () => {
    expect(exitDuration(100, 5000)).toBe(140);
  });

  it("takes the longest exit when the card is not moving its way", () => {
    expect(exitDuration(300, 0)).toBe(320);
    expect(exitDuration(300, -500)).toBe(320);
  });

  it("is a whole number of ms", () => {
    expect(Number.isInteger(exitDuration(333, 2777))).toBe(true);
  });
});

describe("exitY", () => {
  it("keeps the vertical drift the finger gave the card", () => {
    expect(exitY(10, 1000, 200)).toBe(110);
    expect(exitY(-20, -500, 320)).toBe(-100);
    expect(exitY(15, 0, 320)).toBe(15);
  });
});

describe("offscreenX", () => {
  it("clears the window by the margin, however wide the phone", () => {
    expect(offscreenX(393)).toBe(513);
    expect(offscreenX(430)).toBe(550);
  });
});
