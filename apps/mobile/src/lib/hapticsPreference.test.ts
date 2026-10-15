import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  HAPTICS_COPY,
  HAPTICS_STORAGE_KEY,
  parseHapticsPreference,
  serializeHapticsPreference,
} from "./hapticsPreference";

describe("haptics preference", () => {
  it("has its own storage key beside the theme's", () => {
    expect(HAPTICS_STORAGE_KEY).toBe("duoqueue.haptics-enabled");
  });

  it("is on when nothing was ever stored (haptics default on)", () => {
    expect(parseHapticsPreference(null)).toBe(true);
    expect(parseHapticsPreference(undefined)).toBe(true);
  });

  it("is on for 'on' and for anything it does not recognise", () => {
    // Only an explicit "off" turns haptics off: a corrupted or future value must never silently
    // take away something the player did not switch off.
    expect(parseHapticsPreference("on")).toBe(true);
    expect(parseHapticsPreference("")).toBe(true);
    expect(parseHapticsPreference("OFF")).toBe(true);
    expect(parseHapticsPreference("false")).toBe(true);
    expect(parseHapticsPreference("garbage")).toBe(true);
  });

  it("is off only for 'off'", () => {
    expect(parseHapticsPreference("off")).toBe(false);
  });

  it("serialises to 'on' and 'off'", () => {
    expect(serializeHapticsPreference(true)).toBe("on");
    expect(serializeHapticsPreference(false)).toBe("off");
  });

  it("round-trips both values", () => {
    expect(parseHapticsPreference(serializeHapticsPreference(true))).toBe(true);
    expect(parseHapticsPreference(serializeHapticsPreference(false))).toBe(false);
  });
});

describe("HAPTICS_COPY", () => {
  const strings = Object.values(HAPTICS_COPY);

  it("says what the plan says", () => {
    expect(HAPTICS_COPY.label).toBe("Haptics");
    expect(HAPTICS_COPY.hint).toBe("Small taps when you swipe, lock a duo or flip a switch.");
    expect(HAPTICS_COPY.settingsHint).toBe("Light or dark, and haptics");
  });

  it("the Settings tab's Appearance row carries settingsHint word for word", () => {
    // The tab writes it as a literal (this group owns only that one line of settings.tsx, not
    // its imports), so this is what stops the two drifting apart.
    const settings = readFileSync(new URL("../../app/(tabs)/settings.tsx", import.meta.url), "utf8");
    expect(settings).toContain(`hint="${HAPTICS_COPY.settingsHint}"`);
  });

  it.each(strings)("%s has no em or en dash", (s) => {
    expect(s).not.toMatch(/[—–]/);
  });

  it.each(strings)("%s never says beats", (s) => {
    expect(s).not.toMatch(/\bbeats?\b/i);
  });

  it.each(strings)("%s never reads as a dating app", (s) => {
    expect(s).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
  });

  it.each(strings)("%s is sentence case (uppercase comes only from type styles)", (s) => {
    expect(s).not.toBe(s.toUpperCase());
    expect(s[0]).toBe(s[0]?.toUpperCase());
  });
});
