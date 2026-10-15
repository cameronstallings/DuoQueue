import { describe, expect, it } from "vitest";

import {
  WIZARD_EXIT_LINK_LABEL,
  WIZARD_EXIT_SHEET,
  WIZARD_START_OVER_LINK_LABEL,
  WIZARD_START_OVER_SHEET,
} from "./wizardExit";

// The dating-words regex from src/lib/invite.test.ts (Guideline 2.3.6 rejected this app once).
const DATING = /dating|singles|hookup|nearby|meet people|match with singles/i;

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
});

describe("the signed-out wizard's way out (1.0.2)", () => {
  it("is Start over, because there is no account to sign out of or delete", () => {
    expect(WIZARD_START_OVER_LINK_LABEL).toBe("Start over");
    expect(WIZARD_START_OVER_LINK_LABEL.toLowerCase()).not.toContain("sign out");
    expect(WIZARD_START_OVER_LINK_LABEL.toLowerCase()).not.toContain("delete");
  });

  it("confirms before clearing the card, with a way to keep it", () => {
    expect(WIZARD_START_OVER_SHEET.title).toBe("Start over?");
    expect(WIZARD_START_OVER_SHEET.message).toBe("This clears the card you've built on this phone.");
    expect(WIZARD_START_OVER_SHEET.keep).toBe("Keep my card");
    expect(WIZARD_START_OVER_SHEET.confirm).toBe("Start over");
  });
});

describe("every wizard exit string", () => {
  const all = [
    WIZARD_EXIT_LINK_LABEL,
    ...Object.values(WIZARD_EXIT_SHEET),
    WIZARD_START_OVER_LINK_LABEL,
    ...Object.values(WIZARD_START_OVER_SHEET),
  ];

  it("has no em or en dash", () => {
    for (const text of all) {
      expect(text).not.toContain(String.fromCharCode(0x2014));
      expect(text).not.toContain(String.fromCharCode(0x2013));
    }
  });

  it("never says the banned word and has no dating framing", () => {
    for (const text of all) {
      expect(text).not.toMatch(/\bbeats?\b/i);
      expect(text).not.toMatch(DATING);
    }
  });
});
