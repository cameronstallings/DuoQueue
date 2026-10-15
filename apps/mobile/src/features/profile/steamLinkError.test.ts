import { describe, expect, it } from "vitest";

import { STEAM_LINK_COPY, steamLinkDetailMessage } from "./steamLinkError";

describe("steamLinkDetailMessage", () => {
  it("names the cases a player can act on", () => {
    expect(steamLinkDetailMessage("state_expired")).toBe(STEAM_LINK_COPY.expired);
    expect(steamLinkDetailMessage("rate_limited")).toBe(STEAM_LINK_COPY.tooMany);
    expect(steamLinkDetailMessage("save_failed")).toBe(STEAM_LINK_COPY.saveFailed);
    expect(steamLinkDetailMessage("steam_not_configured")).toBe(STEAM_LINK_COPY.unavailable);
  });

  it("never shows a raw code: every other detail, or none, is 'did not confirm'", () => {
    for (const detail of ["invalid_assertion", "state_mismatch", "bad_return_to", "no_steam_id", "something_new", null, undefined]) {
      expect(steamLinkDetailMessage(detail)).toBe(STEAM_LINK_COPY.notConfirmed);
    }
  });

  it("keeps the copy rules: no dashes, no 'beats', no codes", () => {
    for (const line of Object.values(STEAM_LINK_COPY)) {
      expect(line).not.toContain(String.fromCharCode(0x2014));
      expect(line).not.toContain(String.fromCharCode(0x2013));
      expect(line.toLowerCase()).not.toContain("beats");
      expect(line).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});
