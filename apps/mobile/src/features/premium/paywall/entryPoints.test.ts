import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Every way into the paywall says why the player came, so page one can be about that (build 17
 * spec §1; the list is research-code.md's entry-point table). A bare "/paywall" push would open
 * the default page from the wrong place.
 */
const ENTRY_POINTS: [file: string, froms: string[]][] = [
  ["../../../../app/(tabs)/settings.tsx", ["settings"]],
  ["../../../../app/(tabs)/index.tsx", ["limit", "superping", "powerup"]],
  ["../../../../app/filters.tsx", ["filters"]],
  ["../../../../app/admirers.tsx", ["requests"]],
  ["../../../../app/chat/[matchId].tsx", ["chat", "chat", "chat"]],
  ["../../swipe/StandoutCardModal.tsx", ["limit"]],
];

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("paywall entry points", () => {
  for (const [file, froms] of ENTRY_POINTS) {
    it(`${file} passes from (${froms.join(", ")})`, () => {
      const text = source(file);
      const found = [...text.matchAll(/paywallHref\("([a-z]+)"\)/g)].map((match) => match[1]);
      expect(found).toEqual(froms);
      expect(text).not.toMatch(/push\("\/paywall"\)/);
    });
  }

  it("leaves no bare paywall push anywhere else in the app screens", () => {
    for (const file of ["../../../../app/(tabs)/matches.tsx", "../../../../app/(tabs)/profile.tsx", "../../../../app/online-now.tsx"]) {
      expect(source(file)).not.toMatch(/push\("\/paywall"\)/);
    }
  });
});
