import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import { APP_STORE_DEEP_LINK, APP_STORE_ID, APP_STORE_URL, RIOT_NOTICE } from "./legal";

/**
 * Riot's Developer Policies require their non-endorsement line, word for word, wherever a product
 * uses League of Legends data or names. It is written out here as a literal, so a "tidy-up" of the
 * constant fails this test instead of quietly breaking the policy, and it is checked against the
 * site footer's copy so the two cannot drift.
 */
const RIOT_LITERAL =
  "DuoQueue isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.";

const BUILD_SITE = readFileSync(new URL("../../../../scripts/build-site.mjs", import.meta.url), "utf8");
const SITE_HAS_NOTICE = BUILD_SITE.includes("const RIOT_NOTICE =");

/** Joins the double-quoted string literals of `const RIOT_NOTICE = "..." + "...";`. */
function siteRiotNotice(): string {
  const start = BUILD_SITE.indexOf("const RIOT_NOTICE =");
  const end = BUILD_SITE.indexOf(";", start);
  const body = BUILD_SITE.slice(start, end);
  return [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`) as string).join("");
}

describe("RIOT_NOTICE", () => {
  it("is Riot's boilerplate, word for word (the comma after the second Riot Games included)", () => {
    expect(RIOT_NOTICE).toBe(RIOT_LITERAL);
  });

  it("uses no em or en dashes", () => {
    // The two dashes by code point (U+2014, U+2013), so this file holds neither character itself.
    expect(RIOT_NOTICE).not.toContain(String.fromCharCode(0x2014));
    expect(RIOT_NOTICE).not.toContain(String.fromCharCode(0x2013));
  });

  // Skipped, not failed, when the site has no footer constant yet (its footer edit lives in
  // another workflow's uncommitted changes to scripts/build-site.mjs).
  it.skipIf(!SITE_HAS_NOTICE)(
    SITE_HAS_NOTICE
      ? "matches the site footer's copy in scripts/build-site.mjs"
      : "matches the site footer (skipped: scripts/build-site.mjs has no RIOT_NOTICE; the footer edit is another workflow's)",
    () => {
      expect(siteRiotNotice()).toBe(RIOT_NOTICE);
    },
  );
});

describe("App Store links", () => {
  it("both carry the app's id", () => {
    expect(APP_STORE_ID).toBe("6798837181");
    expect(APP_STORE_URL).toContain(APP_STORE_ID);
    expect(APP_STORE_DEEP_LINK).toContain(APP_STORE_ID);
  });

  it("are the https listing and the App Store app's own scheme", () => {
    expect(APP_STORE_URL).toBe("https://apps.apple.com/app/id6798837181");
    expect(APP_STORE_DEEP_LINK.startsWith("itms-apps://")).toBe(true);
  });

  it("match the site's App Store link", () => {
    expect(BUILD_SITE).toContain(`const APP_STORE_URL = "${APP_STORE_URL}"`);
  });
});
