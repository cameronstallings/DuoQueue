import { describe, expect, it } from "vitest";

import { likeAlertPush } from "./likeAlertCopy";

// The two dashes spelled by code, so this file carries neither character.
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

describe("likeAlertPush", () => {
  it("one like: someone wants to duo, and where to look", () => {
    expect(likeAlertPush(1)).toEqual({ title: "Someone wants to duo with you", body: "Open your deck to see who." });
  });

  it("more than one: the count, same body", () => {
    expect(likeAlertPush(3)).toEqual({ title: "3 players want to duo with you", body: "Open your deck to see who." });
  });

  it("an odd count still reads as a sentence", () => {
    expect(likeAlertPush(0).title).toBe("Someone wants to duo with you");
    expect(likeAlertPush(Number.NaN).title).toBe("Someone wants to duo with you");
    expect(likeAlertPush(2.7).title).toBe("2 players want to duo with you");
  });

  it("names nobody, has no dating line, no game publisher and no em or en dash", () => {
    for (const n of [1, 2, 12]) {
      const text = `${likeAlertPush(n).title} ${likeAlertPush(n).body}`;
      expect(text).not.toMatch(/\b(date|dating|singles|nearby|hookup|crush|interested|likes? you)\b/i);
      expect(text).not.toMatch(/riot|league|beats/i);
      expect(text).not.toContain(EN_DASH);
      expect(text).not.toContain(EM_DASH);
    }
  });
});
