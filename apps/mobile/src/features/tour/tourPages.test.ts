import { existsSync, readFileSync } from "node:fs";
import { URL } from "node:url";

import { LOL_DIVISIONAL_TIERS, REGIONS, lolSoloDuoEligible, type LolDivision } from "@duoqueue/shared-types";
import { describe, expect, it } from "vitest";

import { PLATFORM_LABELS, PLAYSTYLE_LABELS, REGION_LABELS, SKILL_LABELS } from "../onboarding/profile-labels";
import { PICTURE_TAG } from "../profile/pictureStatus";
import { DUO_POPS_OPT_IN_COPY, QUEUE_COPY, outcomeLine } from "../queue/queueCopy";
import { queueUpButtonLabel } from "../queue/queueState";
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
  TOUR_POP,
  TOUR_QUEUE_BODY,
  TOUR_QUEUED_MINUTES,
  YOUR_CARD_BODY,
  exampleCard,
  queueTourBody,
  queueTourKind,
  showsCanDuoPage,
  tourChat,
  tourChatSpoken,
  tourDecidesDuoPops,
  tourLockedFit,
  tourOffersDuoPops,
  tourPages,
  tourPictureHeight,
  tourPopPush,
  tourPopSpoken,
  tourQueueFit,
  tourRank,
  tourRankLine,
  tourShowsDuoPops,
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

  it("makes the tour five pages or four: Queue up after Duo locked, and the player's own card last", () => {
    expect(tourPages({ region: "na_east", games: [goldII] })).toEqual(["card", "canDuo", "locked", "queue", "yours"]);
    expect(tourPages({ region: "na_west", games: [goldII] })).toEqual(["card", "canDuo", "locked", "queue", "yours"]);
    expect(tourPages({ region: "na_east", games: [notLeague] })).toEqual(["card", "locked", "queue", "yours"]);
    expect(tourPages({ region: "eu", games: [goldII] })).toEqual(["card", "locked", "queue", "yours"]);
    expect(tourPages({ region: null, games: [] })).toEqual(["card", "locked", "queue", "yours"]);
  });

  it("shows Queue up to every player (it works for every game; only the Duo Pops are NA)", () => {
    for (const region of [...REGIONS, null]) {
      for (const games of [[goldII], [notLeague], []]) {
        const pages = tourPages({ region, games });
        expect(pages).toContain("queue");
        expect(pages.indexOf("queue")).toBe(pages.indexOf("locked") + 1);
        expect(pages[pages.length - 1]).toBe("yours");
      }
    }
  });
});

describe("the Queue up page", () => {
  it("says the design's words", () => {
    expect(TOUR_COPY.queue.heading).toBe("Queue up");
    // The no-break space keeps "Queue up." together when the title wraps.
    expect(TOUR_COPY.queue.title).toBe(`Ready to play? Queue${NBSP}up.`);
    expect(TOUR_COPY.queue.body).toBe(TOUR_QUEUE_BODY.na);
  });

  it("promises Duo Pops only where they go: between players in North America (0085)", () => {
    expect(TOUR_QUEUE_BODY.na).toBe(
      "A day after you join, Queue up can ping up to 6 players in your game who turned on Duo Pops. Or share an LFG post with your code.",
    );
    expect(TOUR_QUEUE_BODY.other).toBe(
      "You show in Online Now for up to an hour. Duo Pops reach North America for now. You can still share an LFG post with your code.",
    );
    expect(queueTourBody("na_east")).toBe(TOUR_QUEUE_BODY.na);
    expect(queueTourBody("na_west")).toBe(TOUR_QUEUE_BODY.na);
    for (const region of REGIONS.filter((r) => r !== "na_east" && r !== "na_west")) {
      expect(queueTourBody(region)).toBe(TOUR_QUEUE_BODY.other);
    }
    // An unknown region (the card read failed or is off) gets the sentence that is true anywhere.
    expect(queueTourBody(null)).toBe(TOUR_QUEUE_BODY.other);
  });

  it("picks the picture by the same split as the body", () => {
    expect(queueTourKind("na_east")).toBe("na");
    expect(queueTourKind("na_west")).toBe("na");
    for (const region of REGIONS.filter((r) => r !== "na_east" && r !== "na_west")) {
      expect(queueTourKind(region)).toBe("other");
    }
    expect(queueTourKind(null)).toBe("other");
    for (const region of [...REGIONS, null]) expect(queueTourBody(region)).toBe(TOUR_QUEUE_BODY[queueTourKind(region)]);
  });

  it("is true for the NA player reading it today, minutes after setup (0085)", () => {
    // start_queue_up pings nobody for a sender under a day old (too_new): the sheet's own words.
    expect(outcomeLine("too_new", { notified: 0, gameName: null, minutesLeft: 60 })).toContain("a day after you join");
    expect(TOUR_QUEUE_BODY.na).toMatch(/^A day after you join, /);
    // At most 6 (duo_pop_recipients' limit 6), as the sheet's hint says, and only "can": quiet
    // hours, the 3-hour and 3-a-day limits and a missing push token all leave players out.
    expect(QUEUE_COPY.pingHint).toContain("up to 6 players");
    expect(TOUR_QUEUE_BODY.na).toContain("can ping up to 6 players");
    // Opt-in: only players who turned Duo Pops on (queue_pop starts false).
    expect(TOUR_QUEUE_BODY.na).toContain("who turned on Duo Pops");
    // Every Queue up gets a call code, the first day too.
    expect(TOUR_QUEUE_BODY.na).toContain("LFG post");
    // Never the old promise that every opted-in player gets one.
    expect(TOUR_QUEUE_BODY.na).not.toMatch(/\bget a ping\b/);
  });

  it("draws the control queued for the hour outside North America, the same label as the header", () => {
    expect(TOUR_QUEUED_MINUTES).toBe(60);
    expect(queueUpButtonLabel({ kind: "queued", minutesLeft: TOUR_QUEUED_MINUTES, untilMs: 0 })).toBe("Queued 60m");
    expect(TOUR_QUEUE_BODY.other).toContain("up to an hour");
  });

  it("keeps each body as short as the tour's other three-line bodies", () => {
    // The picture budget (TOUR_TEXT_LINES) counts a three-line body; page 1's 122 characters
    // render in three at 393pt. These stay close to it.
    for (const body of Object.values(TOUR_QUEUE_BODY)) expect(body.length).toBeLessThanOrEqual(130);
  });

  it("never says Accept or Lock In; I'm in is named by the page's card and the example push", () => {
    for (const body of Object.values(TOUR_QUEUE_BODY)) expect(body).not.toMatch(/\baccept|lock in\b/i);
    expect(DUO_POPS_OPT_IN_COPY.body).toContain("I'm in");
    expect(tourPopPush(null).body).toContain("I'm in");
  });
});

describe("the example Duo Pop", () => {
  it("is the push a Rocket League Kai would send, with I'm in", () => {
    expect(tourPopPush(null)).toEqual({
      title: "Duo Pop",
      body: "A Rocket League player is queueing now. First to tap I'm in gets the duo.",
    });
  });

  it("is the can-duo push for the League Kai, who shares the player's rank and so can always duo", () => {
    expect(tourPopPush("Gold II")).toEqual({
      title: "Duo Pop",
      body: "A Gold II player who can duo with you (by rank) is queueing League of Legends now.",
    });
    expect(tourPopPush("Emerald IV").body).toBe(
      "An Emerald IV player who can duo with you (by rank) is queueing League of Legends now.",
    );
    expect(tourPopPush("Iron I").body).toMatch(/^An Iron I player/);
  });

  it("names nobody, as the real push never does", () => {
    for (const push of [tourPopPush(null), tourPopPush("Gold II")]) {
      expect(push.body).not.toContain("Kai");
      expect(push.title).not.toContain("Kai");
    }
  });

  it("says who the notice is from and when, and is read out whole", () => {
    expect(TOUR_POP).toEqual({ app: "DuoQueue", when: "now" });
    expect(tourPopSpoken(tourPopPush(null))).toBe(
      "Duo Pop: A Rocket League player is queueing now. First to tap I'm in gets the duo.",
    );
  });

  // The server's own words (Group S's duoPopCopy.ts), imported by a computed path so the app's
  // typecheck never reaches into the Deno function. A wording change on one side alone fails here.
  const serverCopy = new URL("../../../../../supabase/functions/send-push-notification/duoPopCopy.ts", import.meta.url);
  it.skipIf(!existsSync(serverCopy))("says exactly what the server's Duo Pop push says", async () => {
    const specifier: string = serverCopy.href;
    const server = (await import(/* @vite-ignore */ specifier)) as {
      duoPopPush: (input: { gameName: string; rankText: string | null; canDuo: boolean; variant: number }) => {
        title: string;
        body: string;
      };
    };
    expect(tourPopPush(null)).toEqual(
      server.duoPopPush({ gameName: "Rocket League", rankText: null, canDuo: false, variant: 0 }),
    );
    for (const rank of ["Gold II", "Emerald IV", "Iron I"]) {
      expect(tourPopPush(rank)).toEqual(
        server.duoPopPush({ gameName: "League of Legends", rankText: rank, canDuo: true, variant: 0 }),
      );
    }
  });
});

describe("the Duo Pops offer on the Queue up page", () => {
  const fresh = { askedWithinWeek: false } as const;

  it("is made only to a player a Duo Pop can reach, with the setting known and off, not offered before", () => {
    expect(tourOffersDuoPops({ region: "na_east", queuePop: false, seen: false, ...fresh })).toBe(true);
    expect(tourOffersDuoPops({ region: "na_west", queuePop: false, seen: false, ...fresh })).toBe(true);
    // Outside NA, or nowhere known: pops never reach them (0085's recipient rule).
    expect(tourOffersDuoPops({ region: "eu", queuePop: false, seen: false, ...fresh })).toBe(false);
    expect(tourOffersDuoPops({ region: null, queuePop: false, seen: false, ...fresh })).toBe(false);
    // Already on, or the column not there (undefined): nothing to ask.
    expect(tourOffersDuoPops({ region: "na_east", queuePop: true, seen: false, ...fresh })).toBe(false);
    expect(tourOffersDuoPops({ region: "na_east", queuePop: undefined, seen: false, ...fresh })).toBe(false);
    // Offered before on this phone, or the flag still loading: never twice, never on a guess.
    expect(tourOffersDuoPops({ region: "na_east", queuePop: false, seen: true, ...fresh })).toBe(false);
    expect(tourOffersDuoPops({ region: "na_east", queuePop: false, seen: undefined, ...fresh })).toBe(false);
  });

  it("keeps the weekly cap every notification ask shares, and never guesses it", () => {
    const naOff = { region: "na_east", queuePop: false, seen: false } as const;
    // Another ask on this phone within the week (a second account, say): not now.
    expect(tourOffersDuoPops({ ...naOff, askedWithinWeek: true })).toBe(false);
    // The ask record still loading: no card this time, as the deck never guesses either.
    expect(tourOffersDuoPops({ ...naOff, askedWithinWeek: undefined })).toBe(false);
  });

  it("is decided once the player settles on the page before it, while it is still off screen", () => {
    // Five pages, Queue up at index 3: decided on Duo locked (2) or later, never on the first two.
    expect(tourDecidesDuoPops(0, 3)).toBe(false);
    expect(tourDecidesDuoPops(1, 3)).toBe(false);
    expect(tourDecidesDuoPops(2, 3)).toBe(true);
    expect(tourDecidesDuoPops(3, 3)).toBe(true);
    expect(tourDecidesDuoPops(4, 3)).toBe(true);
    // Four pages, Queue up at index 2: decided on Duo locked (1).
    expect(tourDecidesDuoPops(0, 2)).toBe(false);
    expect(tourDecidesDuoPops(1, 2)).toBe(true);
    // No Queue up page: never.
    expect(tourDecidesDuoPops(3, -1)).toBe(false);
  });

  it("counts as shown once the pager settles on Queue up, never while it is still off screen", () => {
    // Five pages, Queue up at index 3. Mounted on Duo locked (2), it has not shown: a player who
    // leaves from there never saw it, and the deck keeps its chance.
    expect(tourShowsDuoPops(2, 3)).toBe(false);
    expect(tourShowsDuoPops(3, 3)).toBe(true);
    // Past it (the last page) it has shown: the pager can only get there through it.
    expect(tourShowsDuoPops(4, 3)).toBe(true);
    expect(tourShowsDuoPops(1, 2)).toBe(false);
    expect(tourShowsDuoPops(2, 2)).toBe(true);
    expect(tourShowsDuoPops(3, -1)).toBe(false);
    // Never shown before decided: the offer is always settled first.
    for (const queueIndex of [2, 3]) {
      for (let page = 0; page <= queueIndex + 1; page++) {
        if (tourShowsDuoPops(page, queueIndex)) expect(tourDecidesDuoPops(page, queueIndex)).toBe(true);
      }
    }
  });

  it("gives way a step when it measures taller than its picture area: the Queue up control goes first", () => {
    expect(tourQueueFit(0)).toBe(0);
    expect(tourQueueFit(1)).toBe(1);
    // Past compact the page scrolls.
    expect(tourQueueFit(4)).toBe(1);
    expect(tourQueueFit(-1)).toBe(0);
  });
});

/**
 * The tour card's rules that live in components, pinned in their source (pushAskWiring.test.ts's
 * pattern): nothing else would notice them gone, and every gate would stay green.
 */
describe("the tour card's wiring", () => {
  const card = source("../queue/DuoPopsOptInCard.tsx");
  const welcome = source("../../../app/welcome.tsx");
  const pictures = source("./TourPictures.tsx");
  const tourCard = card.slice(card.indexOf("function TourDuoPopsCard("));

  it("counts the card as an ask the moment it shows: seen on this phone, and the weekly cap", () => {
    expect(card).toContain('if (surface === "tour") return <TourDuoPopsCard shown={active} />;');
    const counting = tourCard.slice(tourCard.indexOf("useEffect(() => {"), tourCard.indexOf("}, [shown, markSeen]);"));
    expect(counting).toContain("if (!shown || counted.current) return;");
    expect(counting).toContain("usePushAskStore.getState().markOffered(Date.now());");
    expect(counting).toContain("markSeen();");
    // Counted on show only, never again on Turn on: a save that fails costs nothing more.
    expect(tourCard.match(/markOffered\(/g)).toHaveLength(1);
  });

  it("tells the card it has shown only once the pager has settled on its page", () => {
    expect(welcome).toContain("const duoPopsShown = offerDuoPops === true && tourShowsDuoPops(pager.page, queueIndex);");
    expect(welcome).toContain("duoPopsShown={duoPopsShown}");
    expect(pictures).toContain('<DuoPopsOptInCard surface="tour" active={duoPopsShown} />');
  });

  it("decides the offer on the weekly ask record, which the tour loads itself", () => {
    expect(welcome).toContain("askedWithinWeek: offeredWithinWeek(lastOfferedAt, Date.now())");
    expect(welcome).toContain("usePushAskStore((s) => (s.loaded ? s.lastOfferedAt : undefined))");
    expect(welcome).toContain("void usePushAskStore.getState().load();");
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
    // "Queue up" names the deck's new button in 1.0.2, so the like is "duo" here; the title and
    // DUO LOCKED itself keep "both queued up".
    expect(TOUR_COPY.locked.body).toBe(
      `Swipe the card or tap the bolt to duo. When they duo you back, chat opens. Free accounts get ${FREE_DAILY_SWIPES} swipes a day.`,
    );
    expect(TOUR_COPY.locked.body).not.toMatch(/queue up/i);
    expect(TOUR_COPY.yours.title).toBe("This is your card.");
    expect(TOUR_FOOT).toEqual({ skip: "Skip", start: "Start swiping", dotsLabel: "Tour page" });
  });

  it("changes page 4's sentence with the picture state", () => {
    expect(yourCardBody(PICTURE_TAG.review)).toBe(YOUR_CARD_BODY.review);
    expect(yourCardBody(PICTURE_TAG.add)).toBe(YOUR_CARD_BODY.add);
    expect(yourCardBody(PICTURE_TAG.rejected)).toBe(YOUR_CARD_BODY.add);
    expect(yourCardBody(null)).toBe(TOUR_COPY.yours.body);
  });

  it("has no em or en dash, no price, never beats and no dating cue anywhere", () => {
    const all = [
      ...Object.values(TOUR_COPY).flatMap((c) => [c.heading, c.title, c.body]),
      ...Object.values(TOUR_QUEUE_BODY),
      ...Object.values(TOUR_POP),
      ...[tourPopPush(null), tourPopPush("Gold II"), tourPopPush("Emerald IV")].flatMap((p) => [
        p.title,
        p.body,
        tourPopSpoken(p),
      ]),
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
      expect(text, text).not.toMatch(/\bbeats?\b/i);
      // The app's dating sweep (invite.test.ts, queueCopy.test.ts): 2.3.6 rejected it once.
      expect(text, text).not.toMatch(/\bdates?\b|dating|singles|hookup|nearby|meet people|match with singles/i);
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
