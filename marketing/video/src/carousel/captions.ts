/**
 * THE POST COPY, and the card order, generated rather than typed.
 *
 * out/_captions/captions.md exists so the daily workflow is: open the file, copy one block,
 * switch app, paste. This file does the same job for the carousel, and it has one extra
 * responsibility the video captions do not: UPLOAD ORDER. A carousel that goes up with card
 * four in front of card two is not a slightly worse post, it is an incoherent one, and the
 * upload picker sorts by filename. So the files are numbered and this file prints the order
 * beside what each card actually says, which is the only way to check the upload without
 * opening six PNGs.
 *
 * =====================================================================================
 * THE CAPTION IS NOT THE HEADLINE REPEATED
 * =====================================================================================
 *
 * The cards carry twelve words in total. A caption that restates them wastes the one place
 * in the post where a full sentence is allowed, so it does the two jobs the cards cannot:
 * it says the loop end to end in one breath for the reader who never swipes, and it names the
 * url, which is the only honest reason to promise somebody a sixth swipe.
 *
 * IT USED TO SAY "the link is on the last card" AND THAT WAS FALSE. Nothing on a PNG is
 * tappable on either platform. A reader who swiped six cards looking for something to press
 * would find a printed url and a promise that had not been kept, which is a worse outcome than
 * never having made it. The line now says what card six actually is, and the url is in the
 * caption as well, where it CAN be copied.
 *
 * NO NEGATIONS, and nothing dating adjacent, in the copy or in the tags. The campaign spent
 * a whole script arguing with a category it does not want to be filed under, and the hashtag
 * is the part of a post an algorithm reads AS a category.
 */
import type { Cta } from "@/config/phase";

import { CARDS, WAITLIST_LABEL } from "./plan";

/**
 * The five established tags, unchanged from src/config/captions.ts so the carousel is filed
 * with the videos, plus the two titles that are literally on the cards. ROCKET LEAGUE is the
 * playstyle chip on card one and card two; card five is a Valorant capture. A tag naming
 * something visible in the post is the only kind worth adding.
 */
const HASHTAGS = [
  "#gaming",
  "#soloqueue",
  "#lfg",
  "#duo",
  "#gamerfriends",
  "#rocketleague",
  "#valorant",
] as const;

const TIKTOK_HASHTAG_COUNT = 5;

/**
 * The hook, in one line, for a reader who is looking at card one and deciding.
 *
 * IT IS THE FILM'S OPENING LINE, and that is the one job the caption does that the cards cannot.
 * "your best games were the ones you played with someone else" is the best sentence in the
 * campaign and it is eleven words, which at the measure is three lines of 72px type: thirteen
 * display pixels in a feed thumbnail. Card one carries three words instead, because three words is
 * what stops a scroll. The sentence lands here, one line lower, for the reader who did stop.
 */
const HOOK = "your best games were the ones you played with someone else.";

/** The loop, end to end, for the reader who never swipes at all. */
const BODY = [
  "duoqueue is where you find the next one.",
  "you match on the games you play and how you play them, lock the duo, send a message, and go play.",
  "18 plus and platonic, for people who want somebody to queue with.",
  "card six has the url. it is also down here, so you do not have to type it off a picture.",
].join("\n\n");

export interface CarouselCaptions {
  instagram: string;
  tiktok: string;
}

export const carouselCaptions = (cta: Cta): CarouselCaptions => {
  const call = `${cta.line}: ${cta.url}`;
  return {
    instagram: [HOOK, "", BODY, "", call, "", HASHTAGS.join(" ")].join("\n"),
    tiktok: [
      HOOK,
      "six cards, one loop. swipe.",
      call,
      HASHTAGS.slice(0, TIKTOK_HASHTAG_COUNT).join(" "),
    ].join(" "),
  };
};

/** One row per file, in upload order, with what the card says on it. */
export interface CardRow {
  slot: number;
  file: string;
  label: string;
  says: string;
}

export const cardRows = (files: readonly string[]): CardRow[] =>
  files.map((file, index) => {
    const card = CARDS[index];
    return {
      slot: index + 1,
      file,
      label: card?.label ?? WAITLIST_LABEL,
      says: card ? card.lines.join(" ") : "the lockup, the call to action and the url",
    };
  });

export const captionsMarkdown = (cta: Cta, files: readonly string[]): string => {
  const captions = carouselCaptions(cta);
  const rows = cardRows(files);

  return `${[
    "# Carousel  (1080x1350, 4:5)",
    "",
    "Upload in this order. The picker sorts by filename, so the numbers are the order.",
    "",
    ...rows.map(
      (row) =>
        `${String(row.slot).padStart(2, "0")}  ${row.file.padEnd(22)}  ${row.label.padEnd(14)}  ${row.says}`,
    ),
    "",
    "## Instagram carousel",
    "",
    captions.instagram,
    "",
    "## TikTok photo carousel",
    "",
    captions.tiktok,
  ].join("\n")}\n`;
};
