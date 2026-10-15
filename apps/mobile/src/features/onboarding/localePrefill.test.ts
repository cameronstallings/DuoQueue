import { describe, expect, it } from "vitest";

import { isOutsideNa, languagesFromLocales, regionFromTimeZone } from "./localePrefill";

describe("regionFromTimeZone", () => {
  it.each([
    ["America/New_York", "na_east"],
    ["America/Chicago", "na_east"],
    ["America/Toronto", "na_east"],
    ["America/Detroit", "na_east"],
    ["America/Halifax", "na_east"],
    ["America/St_Johns", "na_east"],
    ["America/Indiana/Indianapolis", "na_east"],
    ["America/Kentucky/Louisville", "na_east"],
    ["America/North_Dakota/Center", "na_east"],
    ["US/Eastern", "na_east"],
    ["Canada/Atlantic", "na_east"],
    ["America/Denver", "na_west"],
    ["America/Phoenix", "na_west"],
    ["America/Los_Angeles", "na_west"],
    ["America/Vancouver", "na_west"],
    ["America/Anchorage", "na_west"],
    ["America/Boise", "na_west"],
    ["America/Edmonton", "na_west"],
    ["Pacific/Honolulu", "na_west"],
    ["US/Pacific", "na_west"],
    ["US/Mountain", "na_west"],
    ["US/Hawaii", "na_west"],
    ["US/Alaska", "na_west"],
    ["US/Arizona", "na_west"],
    ["Canada/Pacific", "na_west"],
    ["Canada/Mountain", "na_west"],
    ["America/Sao_Paulo", "sa"],
    ["America/Argentina/Buenos_Aires", "sa"],
    ["America/Buenos_Aires", "sa"],
    ["America/Santiago", "sa"],
    ["America/Bogota", "sa"],
    ["America/Lima", "sa"],
    ["Europe/London", "eu"],
    ["Europe/Berlin", "eu"],
    ["Africa/Cairo", "mena"],
    ["Asia/Dubai", "mena"],
    ["Asia/Riyadh", "mena"],
    ["Asia/Jerusalem", "mena"],
    ["Africa/Lagos", "africa"],
    ["Africa/Johannesburg", "africa"],
    ["Asia/Manila", "sea"],
    ["Asia/Jakarta", "sea"],
    ["Asia/Singapore", "sea"],
    ["Asia/Tokyo", "asia"],
    ["Asia/Kolkata", "asia"],
    ["Australia/Sydney", "oce"],
    ["Pacific/Auckland", "oce"],
    ["Pacific/Fiji", "oce"],
    ["Pacific/Guam", "oce"],
  ])("%s gives %s", (tz, region) => {
    expect(regionFromTimeZone(tz)).toBe(region);
  });

  it.each([
    "America/Mexico_City",
    "America/Cancun",
    "America/Guatemala",
    "America/Panama",
    "America/Puerto_Rico",
    "America/Havana",
    "Europe/Istanbul",
    "UTC",
    "Etc/GMT+5",
    "Pacific/Tahiti",
    "Antarctica/McMurdo",
    "Not/A_Zone",
    "",
  ])("%s gives null (left for the player to pick)", (tz) => {
    expect(regionFromTimeZone(tz)).toBeNull();
  });

  it("gives null for undefined and null", () => {
    expect(regionFromTimeZone(undefined)).toBeNull();
    expect(regionFromTimeZone(null)).toBeNull();
  });
});

describe("languagesFromLocales", () => {
  it("maps the old and regional tags onto the codes the app offers", () => {
    expect(languagesFromLocales([{ languageCode: "fil" }])).toEqual(["tl"]);
    expect(languagesFromLocales([{ languageCode: "in" }])).toEqual(["id"]);
    expect(languagesFromLocales([{ languageTag: "zh-Hant-TW", languageCode: "zh" }])).toEqual(["zh"]);
    expect(languagesFromLocales([{ languageTag: "zh-Hans" }])).toEqual(["zh"]);
    expect(languagesFromLocales([{ languageTag: "en-US", languageCode: "en" }])).toEqual(["en"]);
  });

  it("drops languages the app does not offer", () => {
    expect(languagesFromLocales([{ languageCode: "xx" }, { languageCode: "en" }])).toEqual(["en"]);
  });

  it("dedupes and keeps at most 3", () => {
    expect(
      languagesFromLocales([
        { languageTag: "en-US", languageCode: "en" },
        { languageTag: "en-GB", languageCode: "en" },
        { languageCode: "es" },
        { languageCode: "fr" },
        { languageCode: "de" },
      ]),
    ).toEqual(["en", "es", "fr"]);
  });

  it("survives missing or odd entries", () => {
    expect(languagesFromLocales([])).toEqual([]);
    expect(languagesFromLocales(undefined)).toEqual([]);
    expect(languagesFromLocales([{ languageCode: null }, {}])).toEqual([]);
    expect(languagesFromLocales([{ languageCode: "EN" }])).toEqual(["en"]);
  });
});

describe("isOutsideNa", () => {
  it("is false for no region yet and for both NA regions", () => {
    expect(isOutsideNa(null)).toBe(false);
    expect(isOutsideNa("na_east")).toBe(false);
    expect(isOutsideNa("na_west")).toBe(false);
  });

  it("is true for every other region", () => {
    for (const region of ["sa", "eu", "mena", "africa", "asia", "sea", "oce"] as const) {
      expect(isOutsideNa(region)).toBe(true);
    }
  });
});
