import { describe, expect, it } from "vitest";

import { WIZARD_EXIT_LINK_LABEL, WIZARD_EXIT_SHEET } from "./wizardExit";

describe("the wizard's way out", () => {
  it("names deletion on the link itself, not only inside the sheet", () => {
    // A reviewer checking Guideline 5.1.1(v) on an unfinished profile should see the word
    // before tapping, rather than finding it behind a link labelled "Sign out".
    expect(WIZARD_EXIT_LINK_LABEL.toLowerCase()).toContain("delete");
  });

  it("offers both exits in the sheet's own words", () => {
    expect(WIZARD_EXIT_SHEET.message).toMatch(/sign out/i);
    expect(WIZARD_EXIT_SHEET.message).toMatch(/delete this sign-in/i);
    expect(WIZARD_EXIT_SHEET.keepGoing).toBe("Keep going");
    expect(WIZARD_EXIT_SHEET.signOut).toBe("Sign out");
  });

  it("has no em dash", () => {
    for (const text of [WIZARD_EXIT_LINK_LABEL, ...Object.values(WIZARD_EXIT_SHEET)]) {
      expect(text).not.toContain("—");
    }
  });
});
