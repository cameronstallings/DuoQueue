import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { LOL_DIVISIONAL_TIERS, lolSoloDuoEligible, type LolDivision } from "@duoqueue/shared-types";
import { describe, expect, it } from "vitest";

import { PLATFORM_LABELS, PLAYSTYLE_LABELS, REGION_LABELS, SKILL_LABELS } from "../onboarding/profile-labels";
import { PICTURE_TAG } from "../profile/pictureStatus";
import { cardCells, cardDetailsLine } from "../swipe/cardChips";
import { FREE_DAILY_SWIPES } from "../swipe/deckStripCopy";
import {
  CAN_DUO_CAVEAT,
  EXAMPLE_TAG,
  KAI_PROMPTS,
  LOCKED_COPY,
  TAP_HINT,
  TOUR_CARD_NAME,
  TOUR_CHAT,
  TOUR_COPY,
  TOUR_FOOT,
  TOUR_OFFLINE,
  YOUR_CARD_BODY,
  exampleCard,
  showsCanDuoPage,
  tourChat,
  tourChatSpoken,
  tourLockedFit,
  tourPages,
  tourPictureHeight,
  tourRank,
  tourRankLine,
  yourCardBody,
  type TourGame,
} from "./tourPages";

const LABELS = { skill: SKILL_LABELS, platform: PLATFORM_LABELS, playstyle: PLAYSTYLE_LABELS };
const goldII: TourGame = { lolTier: "gold", lolDivision: 2 };
const notLeague: TourGame = { lolTier: null, lolDivision: null };

/** Spelled by code so no invisible character sits in this file (the 4b6bce5 way). */
const NBSP = String.fromCharCode(0xa0);

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

describe("showsCanDuoPage", () => {
  it("shows for a ranked League player in NA", () => {
    expect(showsCanDuoPage({ region: "na_east", games: [notLeague, goldII] })).toBe(true);
    expect(showsCanDuoPage({ region: "na_west", games: [goldII] })).toBe(true);
  });

  it("skips outside NA, where get_deck never compares ranks (0069)", () => {
    expect(showsCanDuoPage({ region: "eu", games: [goldII] })).toBe(false);
    expect(showsCanDuoPage({ region: null, games: [goldII] })).toBe(false);
  });

  it("skips without a rank the cell can light for", () => {
    const unlit: TourGame[] = [
      notLeague,
      { lolTier: "unranked", lolDivision: null },
      { lolTier: "gold", lolDivision: null },
      { lolTier: "master", lolDivision: null },
      { lolTier: "challenger", lolDivision: null },
    ];
    for (const game of unlit) expect(showsCanDuoPage({ region: "na_east", games: [game] })).toBe(false);
  });

  it("makes the tour four pages or three", () => {
    expect(tourPages({ region: "na_east", games: [goldII] })).toEqual(["card", "canDuo", "locked", "yours"]);
    expect(tourPages({ region: "eu", games: [goldII] })).toEqual(["card", "locked", "yours"]);
  });
});

describe("the player's rank line", () => {
  it("reads the rank and Riot's range for it", () => {
    const rank = tourRank([notLeague, goldII]);
    expect(rank).toEqual({ tier: "gold", division: 2 });
    if (!rank) throw new Error("no rank");
    expect(tourRankLine(rank)).toEqual({ label: "You · Gold II", rule: "In Solo/Duo you can duo with Silver to Platinum." });
    expect(CAN_DUO_CAVEAT).toBe("Based on League's published duo rules. The League client has the final say.");
  });
});

describe("exampleCard (Kai)", () => {
  it("lights Can duo in the player's own rank, which can always duo with itself", () => {
    const kai = exampleCard("Gold II");
    const cells = cardCells(kai, { kind: "deck", sharedGames: kai.shared_games_count }, LABELS);
    expect(cells.map((c) => [c.key, c.value, c.lit])).toEqual([
      ["game", "Gold II", false],
      ["duo", "Can duo", true],
      ["common", "1 game", false],
    ]);
    for (const tier of LOL_DIVISIONAL_TIERS) {
      for (const division of [1, 2, 3, 4] as LolDivision[]) {
        expect(lolSoloDuoEligible({ tier, division }, { tier, division })).toBe(true);
      }
    }
  });

  it("is a Rocket League player with no lit cell for everyone else", () => {
    const kai = exampleCard(null);
    const cells = cardCells(kai, { kind: "deck", sharedGames: kai.shared_games_count }, LABELS);
    expect(cells.map((c) => [c.key, c.label, c.value, c.lit])).toEqual([
      ["game", "Rocket League", "Casual", false],
      ["platforms", "Plays on", "PC · Switch", false],
      ["common", "In common", "1 game", false],
    ]);
  });

  it("never has more games in common than the one Kai lists", () => {
    for (const kai of [exampleCard("Gold II"), exampleCard(null)]) {
      expect(kai.topGames).toHaveLength(1);
      expect(kai.shared_games_count).toBe(1);
    }
  });

  it("never shows an age", () => {
    expect(cardDetailsLine(exampleCard(null), REGION_LABELS, { withAge: false })).toBe("NA East · en");
  });

  it("asks only questions a real player can pick (the prompt catalogue, 0010 and 0017)", () => {
    const catalogue =
      source("../../../../../supabase/migrations/0010_prompts.sql") +
      source("../../../../../supabase/migrations/0017_more_prompts.sql");
    expect(KAI_PROMPTS).toHaveLength(3);
    for (const { question } of KAI_PROMPTS) {
      expect(catalogue).toContain(`('${question.replaceAll("'", "''")}')`);
    }
    expect(EXAMPLE_TAG).toBe("Example");
  });
});

describe("tour copy", () => {
  it("says the design's words", () => {
    expect(TOUR_COPY.card.title).toBe("Tap for their prompts.");
    // A card has at most one picture (cardPages), as the store copy says.
    expect(TOUR_COPY.card.body).toMatch(/^The picture first, then prompts\./);
    expect(TOUR_COPY.canDuo.title).toBe(`Lit up means you can${NBSP}queue.`);
    expect(TOUR_COPY.locked.title).toBe(`Both queue up. Duo${NBSP}locked.`);
    expect(TOUR_COPY.locked.body).toBe(
      `Swipe the card or tap the bolt to queue up. When they queue up with you too, chat opens. Free accounts get ${FREE_DAILY_SWIPES} swipes a day.`,
    );
    expect(TOUR_COPY.yours.title).toBe("This is your card.");
    expect(TOUR_FOOT).toEqual({ skip: "Skip", start: "Start swiping", dotsLabel: "Tour page" });
  });

  it("changes page 4's sentence with the picture state", () => {
    expect(yourCardBody(PICTURE_TAG.review)).toBe(YOUR_CARD_BODY.review);
    expect(yourCardBody(PICTURE_TAG.add)).toBe(YOUR_CARD_BODY.add);
    expect(yourCardBody(PICTURE_TAG.rejected)).toBe(YOUR_CARD_BODY.add);
    expect(yourCardBody(null)).toBe(TOUR_COPY.yours.body);
  });

  it("has no em or en dash, no price and no dating cue anywhere", () => {
    const all = [
      ...Object.values(TOUR_COPY).flatMap((c) => [c.heading, c.title, c.body]),
      ...Object.values(YOUR_CARD_BODY),
      ...Object.values(LOCKED_COPY),
      ...Object.values(TAP_HINT),
      ...Object.values(TOUR_FOOT),
      ...Object.values(TOUR_CARD_NAME),
      TOUR_OFFLINE,
      ...TOUR_CHAT.map((line) => line.text),
      ...KAI_PROMPTS.flatMap((p) => [p.question, p.answer]),
      CAN_DUO_CAVEAT,
      EXAMPLE_TAG,
    ];
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    for (const text of all) {
      expect(text).not.toMatch(dashes);
      expect(text).not.toMatch(/\$\d/);
      expect(text).not.toMatch(/swipe right/i);
      expect(text).not.toMatch(/interested in you/i);
    }
  });
});

describe("layout", () => {
  const notched = { top: 59, bottom: 34 };
  const se = { top: 20, bottom: 0 };

  it("fits the picture area to the phone and its safe area", () => {
    expect(tourPictureHeight(852, notched)).toBe(458);
    expect(tourPictureHeight(932, notched)).toBe(458);
    expect(tourPictureHeight(700, notched)).toBe(306);
    // An iPhone SE: no notch, no home indicator, so the picture gets that room back.
    expect(tourPictureHeight(667, se)).toBe(346);
    expect(tourPictureHeight(568, se)).toBe(280);
    // The default text size is fontScale 1.
    expect(tourPictureHeight(852, notched, 1)).toBe(458);
  });

  it("gives a larger text size its lines from the picture, down to the floor", () => {
    // xxLarge (1.24) and xxxLarge (1.35): the text block and the button's label grow by
    // (138 + 21) x (fontScale - 1).
    expect(tourPictureHeight(852, notched, 1.24)).toBe(420);
    expect(tourPictureHeight(852, notched, 1.35)).toBe(402);
    expect(tourPictureHeight(667, se, 1.35)).toBe(290);
    // Past the floor the page scrolls instead (welcome.tsx).
    expect(tourPictureHeight(667, se, 1.5)).toBe(280);
    expect(tourPictureHeight(852, notched, 3.12)).toBe(280);
    // A smaller text size gives the picture the room, up to the design's 458.
    expect(tourPictureHeight(852, notched, 0.82)).toBe(458);
    expect(tourPictureHeight(667, se, 0.82)).toBe(375);
  });

  it("leaves the tallest measured heading its room once the pages are laid out", () => {
    // The default size: page 3's 152pt heading in a 714pt pager leaves 463, looser than the
    // budget's 458, so nothing moves (and nothing moves before anything is measured).
    expect(tourPictureHeight(852, notched, 1, { pageHeight: 714, tallestHeading: 152 })).toBe(458);
    expect(tourPictureHeight(667, se, 1, { pageHeight: 563, tallestHeading: 152 })).toBe(346);
    expect(tourPictureHeight(852, notched, 1.24, { pageHeight: 0, tallestHeading: 0 })).toBe(420);
    // xxLarge: page 3's body wraps to four lines (212pt), more than the budget counts, so the
    // picture gives way: 709 - 59 - 40 - 212 = 398.
    expect(tourPictureHeight(852, notched, 1.24, { pageHeight: 709, tallestHeading: 212 })).toBe(398);
    // Never under the floor: past it, the page scrolls.
    expect(tourPictureHeight(667, se, 1.35, { pageHeight: 520, tallestHeading: 260 })).toBe(280);
  });

  it("gives page 3 way a step at a time: a short phone starts short, a measured overflow adds one", () => {
    expect(tourLockedFit(458, 0)).toBe(0);
    expect(tourLockedFit(420, 0)).toBe(1);
    expect(tourLockedFit(300, 0)).toBe(1);
    // A larger text size wraps the bubbles onto more lines: measured taller, it steps down.
    expect(tourLockedFit(458, 1)).toBe(1);
    expect(tourLockedFit(458, 2)).toBe(2);
    expect(tourLockedFit(346, 1)).toBe(2);
    // Past compact the page scrolls.
    expect(tourLockedFit(280, 5)).toBe(2);
  });

  it("keeps the chat's first two bubbles when short: the question and its answer", () => {
    expect(tourChat(0)).toEqual(TOUR_CHAT);
    expect(tourChat(1)).toEqual(TOUR_CHAT.slice(0, 2));
    expect(tourChat(2)).toEqual(TOUR_CHAT.slice(0, 2));
    expect(tourChat(1).map((line) => line.from)).toEqual(["kai", "you"]);
  });

  it("says who said each bubble", () => {
    expect(TOUR_CHAT.map(tourChatSpoken)).toEqual([
      "Kai: Want to run a few ranked games later?",
      "You: Sure, I'm on from 8. What's your Discord?",
      "Kai: Sent it. See you in the lobby.",
    ]);
  });
});
