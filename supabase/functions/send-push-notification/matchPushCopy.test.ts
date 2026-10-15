import { describe, expect, it } from "vitest";

import {
  discordSharedPush,
  firstMessageNudgePush,
  formatPlayTime,
  lookingNowPush,
  sessionProposedPush,
} from "./matchPushCopy";

// The two dashes spelled by code, so this file carries neither character.
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

// Saturday 17 Oct 2026, 23:00 UTC = 19:00 in New York (EDT), 16:00 in Los Angeles (PDT).
const SAT_7PM_NEW_YORK = new Date("2026-10-17T23:00:00Z");

describe("formatPlayTime", () => {
  it("is the weekday and the hour on the recipient's clock", () => {
    expect(formatPlayTime(SAT_7PM_NEW_YORK, "America/New_York")).toBe("Sat 7pm");
    expect(formatPlayTime(SAT_7PM_NEW_YORK, "America/Los_Angeles")).toBe("Sat 4pm");
  });

  it("shows minutes only when there are some", () => {
    expect(formatPlayTime(new Date("2026-10-17T23:30:00Z"), "America/New_York")).toBe("Sat 7:30pm");
  });

  it("midnight and the small hours read as am, on the right day", () => {
    expect(formatPlayTime(new Date("2026-10-18T04:30:00Z"), "America/New_York")).toBe("Sun 12:30am");
    expect(formatPlayTime(new Date("2026-10-18T13:00:00Z"), "America/Chicago")).toBe("Sun 8am");
  });

  it("falls back to New York for a missing, blank or unknown zone", () => {
    expect(formatPlayTime(SAT_7PM_NEW_YORK, null)).toBe("Sat 7pm");
    expect(formatPlayTime(SAT_7PM_NEW_YORK, "  ")).toBe("Sat 7pm");
    expect(formatPlayTime(SAT_7PM_NEW_YORK, "Not/AZone")).toBe("Sat 7pm");
  });
});

describe("match push copy", () => {
  it("session proposed: who and when, then what to do", () => {
    expect(sessionProposedPush("Sam", "Sat 7pm")).toEqual({
      title: "Sam wants to play Sat 7pm",
      body: "Tap to confirm or pick another time.",
    });
  });

  it("discord shared: who, and where to get it, never the username", () => {
    expect(discordSharedPush("Sam")).toEqual({ title: "Sam shared their Discord", body: "Copy it from the chat." });
  });

  it("first message nudge: say hi, then why", () => {
    expect(firstMessageNudgePush("Sam")).toEqual({
      title: "Say hi to Sam",
      body: "You matched. Send the first message and pick a time to play.",
    });
  });

  it("first message nudge without a name still reads as a sentence", () => {
    expect(firstMessageNudgePush(null).title).toBe("Say hi to your new duo");
    expect(firstMessageNudgePush("  ").title).toBe("Say hi to your new duo");
  });

  it("free to duo keeps its words", () => {
    expect(lookingNowPush("Sam")).toEqual({
      title: "Sam is free to duo right now",
      body: "Jump in before the window closes.",
    });
  });

  it("has no dating line, no game publisher, never says beats, and no em or en dash", () => {
    const all = [
      sessionProposedPush("Sam", formatPlayTime(SAT_7PM_NEW_YORK, "America/New_York")),
      discordSharedPush("Sam"),
      firstMessageNudgePush("Sam"),
      firstMessageNudgePush(null),
      lookingNowPush("Sam"),
    ];
    for (const { title, body } of all) {
      const text = `${title} ${body}`;
      expect(text).not.toMatch(/\b(date|dating|singles|nearby|hookup|crush|interested)\b/i);
      expect(text).not.toMatch(/riot|league|beats/i);
      expect(text).not.toContain(EN_DASH);
      expect(text).not.toContain(EM_DASH);
    }
  });
});
