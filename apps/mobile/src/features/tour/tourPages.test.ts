import { LOL_DIVISIONAL_TIERS, lolSoloDuoEligible, type LolDivision } from "@duoqueue/shared-types";
import { describe, expect, it } from "vitest";

import { PLATFORM_LABELS, PLAYSTYLE_LABELS, REGION_LABELS, SKILL_LABELS } from "../onboarding/profile-labels";
import { PICTURE_TAG } from "../profile/pictureStatus";
import { cardCells, cardDetailsLine } from "../swipe/cardChips";
import {
  CAN_DUO_CAVEAT,
  EXAMPLE_TAG,
  KAI_PROMPTS,
  LOCKED_COPY,
  TAP_HINT,
  TOUR_CHAT,
  TOUR_COPY,
  TOUR_FOOT,
  YOUR_CARD_BODY,
  exampleCard,
  showsCanDuoPage,
  tourChat,
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
    const cells = cardCells(exampleCard("Gold II"), { kind: "deck", sharedGames: 2 }, LABELS);
    expect(cells.map((c) => [c.key, c.value, c.lit])).toEqual([
      ["game", "Gold II", false],
      ["duo", "Can duo", true],
      ["common", "2 games", false],
    ]);
    for (const tier of LOL_DIVISIONAL_TIERS) {
      for (const division of [1, 2, 3, 4] as LolDivision[]) {
        expect(lolSoloDuoEligible({ tier, division }, { tier, division })).toBe(true);
      }
    }
  });

  it("is a Rocket League player with no lit cell for everyone else", () => {
    const cells = cardCells(exampleCard(null), { kind: "deck", sharedGames: 2 }, LABELS);
    expect(cells.map((c) => [c.key, c.label, c.value, c.lit])).toEqual([
      ["game", "Rocket League", "Casual", false],
      ["platforms", "Plays on", "PC · Switch", false],
      ["common", "In common", "2 games", false],
    ]);
  });

  it("never shows an age", () => {
    expect(cardDetailsLine(exampleCard(null), REGION_LABELS, { withAge: false })).toBe("NA East · en");
  });

  it("asks only questions a real player can pick (the prompt catalogue, 0010 and 0017)", () => {
    expect(KAI_PROMPTS.map((p) => p.question)).toEqual([
      "The role I always end up playing is",
      "A skill I'm weirdly proud of",
      "My comfort game is",
    ]);
    expect(EXAMPLE_TAG).toBe("Example");
  });
});

describe("tour copy", () => {
  it("says the design's words", () => {
    expect(TOUR_COPY.card.title).toBe("Tap for their prompts.");
    expect(TOUR_COPY.canDuo.title).toBe("Lit up means you can queue.");
    expect(TOUR_COPY.locked.title).toBe("Both queue up. Duo locked.");
    expect(TOUR_COPY.locked.body).toBe(
      "Swipe the card or tap the bolt to queue up. When they queue up with you too, chat opens. Free accounts get 25 swipes a day.",
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
      ...TOUR_CHAT.map((line) => line.text),
      ...KAI_PROMPTS.flatMap((p) => [p.question, p.answer]),
      CAN_DUO_CAVEAT,
      EXAMPLE_TAG,
    ];
    for (const text of all) {
      expect(text).not.toMatch(/[–—]/);
      expect(text).not.toMatch(/\$\d/);
      expect(text).not.toMatch(/swipe right/i);
      expect(text).not.toMatch(/interested in you/i);
    }
  });
});

describe("layout", () => {
  it("fits the picture area to the phone", () => {
    expect(tourPictureHeight(852)).toBe(458);
    expect(tourPictureHeight(932)).toBe(458);
    expect(tourPictureHeight(700)).toBe(306);
    expect(tourPictureHeight(667)).toBe(280);
  });

  it("keeps the chat's last two bubbles on a short phone", () => {
    expect(tourChat(458)).toEqual(TOUR_CHAT);
    expect(tourChat(300)).toEqual(TOUR_CHAT.slice(1));
  });
});
