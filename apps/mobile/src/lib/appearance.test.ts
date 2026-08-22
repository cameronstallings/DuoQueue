import { describe, expect, it } from "vitest";

import {
  APPEARANCE_OPTIONS,
  appearanceSummary,
  isAppearanceOptionSelected,
  type ResolvedScheme,
} from "./appearance";

const SCHEMES: ResolvedScheme[] = ["light", "dark"];

describe("APPEARANCE_OPTIONS", () => {
  it("offers exactly two rows", () => {
    expect(APPEARANCE_OPTIONS).toHaveLength(2);
  });

  it("puts Dark first, because Volt is dark-first", () => {
    expect(APPEARANCE_OPTIONS.map((o) => o.value)).toEqual(["dark", "light"]);
  });

  it("never names the invisible default", () => {
    // The whole change is that "system" stops being a word the user can see. If a third
    // row or a hint reintroduces it, this fails.
    const copy = APPEARANCE_OPTIONS.map((o) => `${o.value} ${o.label}`).join(" ").toLowerCase();
    expect(copy).not.toMatch(/system|automatic|follow|phone|device/);
  });

  it("carries no per-option hint that could contradict what the user is seeing", () => {
    for (const option of APPEARANCE_OPTIONS) {
      expect(Object.keys(option).sort()).toEqual(["label", "value"]);
    }
  });

  it("uses no em dashes in user-facing copy", () => {
    for (const option of APPEARANCE_OPTIONS) {
      expect(option.label).not.toContain("—");
    }
    for (const scheme of SCHEMES) {
      expect(appearanceSummary(scheme)).not.toContain("—");
    }
  });
});

describe("isAppearanceOptionSelected", () => {
  it("ticks exactly one row for every scheme the app can resolve to", () => {
    // This is the invariant that matters. A user whose stored preference is "system" still
    // resolves to one of these two, so there is no state in which the screen ticks nothing
    // and no state in which it ticks both.
    for (const scheme of SCHEMES) {
      const ticked = APPEARANCE_OPTIONS.filter((o) => isAppearanceOptionSelected(scheme, o.value));
      expect(ticked).toHaveLength(1);
      expect(ticked[0]?.value).toBe(scheme);
    }
  });

  it("ticks Dark when the app is dark and Light when it is light", () => {
    expect(isAppearanceOptionSelected("dark", "dark")).toBe(true);
    expect(isAppearanceOptionSelected("dark", "light")).toBe(false);
    expect(isAppearanceOptionSelected("light", "light")).toBe(true);
    expect(isAppearanceOptionSelected("light", "dark")).toBe(false);
  });
});

describe("appearanceSummary", () => {
  it("prints the resolved theme, in one word", () => {
    expect(appearanceSummary("dark")).toBe("Dark");
    expect(appearanceSummary("light")).toBe("Light");
  });

  it("always matches the label of the row the Appearance screen ticks", () => {
    // The Settings row and the Appearance screen are two surfaces describing one fact. If
    // they ever disagree the user is being told the app looks like something it does not.
    for (const scheme of SCHEMES) {
      const ticked = APPEARANCE_OPTIONS.find((o) => isAppearanceOptionSelected(scheme, o.value));
      expect(appearanceSummary(scheme)).toBe(ticked?.label);
    }
  });

  it("never prints a word for the invisible default", () => {
    for (const scheme of SCHEMES) {
      expect(appearanceSummary(scheme).toLowerCase()).not.toMatch(/system|automatic|follow/);
    }
  });
});
