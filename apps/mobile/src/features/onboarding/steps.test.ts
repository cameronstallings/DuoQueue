import { describe, expect, it } from "vitest";

import { ONBOARDING_STEPS, nextStepPath } from "./steps";

describe("onboarding steps", () => {
  it("no longer asks for gender", () => {
    expect(ONBOARDING_STEPS).not.toContain("gender");
    expect(ONBOARDING_STEPS).toHaveLength(9);
  });

  it("goes from the name and picture straight to region", () => {
    expect(nextStepPath("display-name")).toBe("/(onboarding)/region");
  });

  it("finishes into the tabs after Discord", () => {
    expect(nextStepPath("discord")).toBe("/(tabs)");
  });
});
