import { describe, expect, it } from "vitest";

import {
  type DraftStep,
  isDraftStep,
  nextStepPath,
  ONBOARDING_STEPS,
  previousStepPath,
  stepPath,
  wizardResumePath,
} from "./steps";

describe("onboarding steps", () => {
  it("asks 8 things, with no gender and no shows (Profile still asks for shows)", () => {
    expect(ONBOARDING_STEPS).not.toContain("gender");
    expect(ONBOARDING_STEPS).not.toContain("shows");
    expect(ONBOARDING_STEPS).toEqual([
      "display-name",
      "region",
      "languages",
      "platforms",
      "games",
      "playstyles",
      "prompts",
      "discord",
    ]);
  });

  it("goes from the name and picture straight to region", () => {
    expect(nextStepPath("display-name")).toBe("/(onboarding)/region");
  });

  it("goes from games straight to playstyles now that shows is gone", () => {
    expect(nextStepPath("games")).toBe("/(onboarding)/playstyles");
  });

  it("ends on Save your card after Discord", () => {
    expect(nextStepPath("discord")).toBe("/(onboarding)/save");
  });
});

describe("isDraftStep", () => {
  it("knows intro, every step and save", () => {
    for (const step of ["intro", ...ONBOARDING_STEPS, "save"]) expect(isDraftStep(step)).toBe(true);
  });

  it("refuses anything else, including the removed steps", () => {
    for (const value of ["shows", "gender", "", null, undefined, 3, {}]) expect(isDraftStep(value)).toBe(false);
  });
});

describe("stepPath", () => {
  it("is the route of the step", () => {
    expect(stepPath("intro")).toBe("/(onboarding)/intro");
    expect(stepPath("games")).toBe("/(onboarding)/games");
    expect(stepPath("save")).toBe("/(onboarding)/save");
  });
});

describe("previousStepPath", () => {
  const table: [DraftStep, string | null, string | null][] = [
    // step, signed out, signed in
    ["intro", "/(auth)/age-gate", "/(auth)/age-gate"],
    ["display-name", "/(onboarding)/intro", null],
    ["region", "/(onboarding)/display-name", "/(onboarding)/display-name"],
    ["languages", "/(onboarding)/region", "/(onboarding)/region"],
    ["platforms", "/(onboarding)/languages", "/(onboarding)/languages"],
    ["games", "/(onboarding)/platforms", "/(onboarding)/platforms"],
    ["playstyles", "/(onboarding)/games", "/(onboarding)/games"],
    ["prompts", "/(onboarding)/playstyles", "/(onboarding)/playstyles"],
    ["discord", "/(onboarding)/prompts", "/(onboarding)/prompts"],
    ["save", "/(onboarding)/discord", "/(onboarding)/discord"],
  ];

  it.each(table)("%s goes back to %s signed out and %s signed in", (step, signedOut, signedIn) => {
    expect(previousStepPath(step, { signedIn: false })).toBe(signedOut);
    expect(previousStepPath(step, { signedIn: true })).toBe(signedIn);
  });
});

describe("wizardResumePath", () => {
  it("resumes a signed-out draft where it was left", () => {
    expect(wizardResumePath(null, false)).toBe("/(onboarding)/intro");
    expect(wizardResumePath("intro", false)).toBe("/(onboarding)/intro");
    expect(wizardResumePath("games", false)).toBe("/(onboarding)/games");
    expect(wizardResumePath("discord", false)).toBe("/(onboarding)/discord");
    expect(wizardResumePath("save", false)).toBe("/(onboarding)/save");
  });

  it("never sends a signed-in (Apple-first) player to the intro or Save", () => {
    expect(wizardResumePath(null, true)).toBe("/(onboarding)/display-name");
    expect(wizardResumePath("intro", true)).toBe("/(onboarding)/display-name");
    expect(wizardResumePath("save", true)).toBe("/(onboarding)/display-name");
    expect(wizardResumePath("prompts", true)).toBe("/(onboarding)/prompts");
  });
});
