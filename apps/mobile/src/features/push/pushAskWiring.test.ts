import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The two places the notification ask is raised from, pinned in the screens' source (the
 * entryPoints.test.ts pattern), because nothing else would notice them missing.
 *
 * Since 1.0.2 nothing asks cold at sign-in (Group P's P7 swaps the old prompt for
 * `refreshPushTokenIfGranted`, which never asks). After that, a new install is asked only where
 * a screen raises the card: after a like that did not match (the deck) and on DUO LOCKED. Both
 * hooks belong to Group M's code (`useDeckSwipeFlow` from M2, `DuoLockedScreen` from M3), so they
 * can only be wired in the merge that brings M in. If that step is missed, every gate stays green,
 * the app works, and push opt-in quietly collapses to the empty deck and Settings.
 *
 * These checks used to switch on only once Group M's piece was in the file (skipped before it).
 * M and G are merged, so they always run now: a skip would only hide the regression they exist
 * to catch (rename the deck's swipe flow or move DUO LOCKED, and the wiring checks would quietly
 * report "skipped" while the suite stayed green). The Duo Pop card, which also ends on DUO LOCKED,
 * is pinned the same way.
 */
function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const deck = source("../../../app/(tabs)/index.tsx");
const matchRoute = source("../../../app/match/[matchId].tsx");
const popCard = source("../../../app/pop/[popId].tsx");

const PRE_ASK_IMPORT = /import\s*\{\s*PushPreAskCard\s*\}\s*from\s*"@\/features\/push\/PushPreAskCard"/;

describe("where the notification ask is raised", () => {
  it("draws the deck card over the deck while there are cards", () => {
    expect(deck).toContain('{cards.length > 0 && <PushPreAskCard surface="deck" />}');
  });

  it("marks the deck moment after a like that did not match (onLiked on useDeckSwipeFlow)", () => {
    expect(deck).toContain("useDeckSwipeFlow(");
    expect(deck).toMatch(/onLiked:\s*(?:\(\)\s*=>\s*offerPushAsk\(\)|offerPushAsk\b)/);
    expect(deck).toMatch(/import\s*\{[^}]*\bofferPushAsk\b[^}]*\}\s*from\s*"@\/features\/push\/pushAskStore"/);
  });

  it("puts the card under DUO LOCKED's buttons", () => {
    expect(matchRoute).toContain("<DuoLockedScreen");
    expect(matchRoute).toMatch(/belowButtons=\{<PushPreAskCard surface="match"/);
    expect(matchRoute).toMatch(PRE_ASK_IMPORT);
  });

  it("puts the card under the Duo Pop card's DUO LOCKED too", () => {
    expect(popCard).toContain("<DuoLockedScreen");
    expect(popCard).toMatch(/belowButtons=\{<PushPreAskCard surface="match"/);
    expect(popCard).toMatch(PRE_ASK_IMPORT);
  });
});
