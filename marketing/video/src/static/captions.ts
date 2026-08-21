/**
 * THE POST COPY, generated rather than typed, one block per placement.
 *
 * out/_carousel/captions.md exists so the workflow is: open the file, copy one block, switch app,
 * paste. This does the same job for the four sheets, and it has one extra responsibility neither
 * the video captions nor the carousel's have: THE STICKER. A story sheet that goes up without a
 * link sticker is the only file in this campaign that fails silently. It looks finished, it reads
 * correctly, and the one thing 1080x1920 is for did not happen. So the story block says where the
 * band is, in pixels, and what to put in it.
 *
 * =====================================================================================
 * THE CAPTION IS NOT THE SHEET REPEATED
 * =====================================================================================
 *
 * The sheet carries seven words and a stamp. A caption that restates them wastes the one place in
 * the post where a whole sentence is allowed, so it does the two jobs the sheet cannot: it says
 * the loop end to end for the reader who is not going to look at the picture twice, and it puts
 * the url somewhere it can be copied, which on a feed post it cannot be.
 *
 * AND IT IS WHERE THE FILM'S LINE FINALLY GETS TO RUN. "your best games were the ones you played
 * with someone else" is eleven words, which at the measure is three lines of 67px type. It is the
 * best sentence in the campaign and the wrong one for a sheet that has to state rather than tease
 * (see ./plan.ts). One line down, to a reader who has already stopped, it is exactly right.
 *
 * NO NEGATIONS, and nothing dating adjacent, in the copy or in the tags. Naming a category is
 * what files you under it, and the hashtag is the part of a post an algorithm reads AS a category.
 */
import type { Cta } from "@/config/phase";

import { LAYOUT, type SizeName } from "./ground";
import { STAMP, STATEMENT } from "./plan";

/**
 * The five established tags, unchanged from src/config/captions.ts so the sheets are filed with
 * the videos and the carousel, plus the one title that is legible in the picture. ROCKET LEAGUE
 * is on the playstyle chip inside the card on all four files. #valorant is NOT here, unlike on
 * the carousel: the gameplay plate is not on these sheets, and a tag naming something that is not
 * in the post is the only kind that costs anything.
 */
const HASHTAGS = [
  "#gaming",
  "#soloqueue",
  "#lfg",
  "#duo",
  "#gamerfriends",
  "#rocketleague",
] as const;

const TIKTOK_HASHTAG_COUNT = 5;

const HOOK = "your best games were the ones you played with someone else.";

const BODY = [
  "duoqueue is where you find the next one.",
  "you match on the games you play and how you play them, lock the duo, send a message, and go play.",
  "18 plus and platonic, for people who want somebody to queue with.",
].join("\n\n");

export interface PlacementCaptions {
  instagram: string;
  tiktok: string;
}

export const feedCaptions = (cta: Cta): PlacementCaptions => {
  const call = `${cta.line}: ${cta.url}`;
  return {
    instagram: [HOOK, "", BODY, "", call, "", HASHTAGS.join(" ")].join("\n"),
    tiktok: [
      HOOK,
      "duoqueue matches you on the games you already play.",
      call,
      HASHTAGS.slice(0, TIKTOK_HASHTAG_COUNT).join(" "),
    ].join(" "),
  };
};

/**
 * The story block. It is not a caption, because a story has no caption field; it is the three
 * decisions a poster has to make in the composer, written down so none of them is made by
 * instinct at the moment of posting.
 */
export const storySetup = (cta: Cta): string[] => {
  const band = LAYOUT.story.sticker;
  const top = band?.top ?? 0;
  const height = band?.height ?? 0;
  return [
    `1. LINK STICKER. Set it to https://${cta.url} and change its text to "${cta.line}".`,
    `   Drop it in the empty band at the bottom of the sheet: ${String(top)}px to ${String(top + height)}px,`,
    `   centred, which is the gap under the address line. Do not scale it up past that band.`,
    "",
    "2. NOTHING ELSE ON THE FRAME. No text, no poll, no music sticker, no mention. The sheet is",
    "   already three elements deep and the sticker is the fourth.",
    "",
    "3. ADD IT TO A HIGHLIGHT so the link survives past 24 hours.",
  ];
};

export interface SheetRow {
  file: string;
  size: SizeName;
  theme: string;
  where: string;
}

export const captionsMarkdown = (cta: Cta, rows: readonly SheetRow[]): string => {
  const captions = feedCaptions(cta);
  const statement = STATEMENT.join(" ");

  return `${[
    "# Static ads",
    "",
    `The sheet says: **${statement}**`,
    `Under it: ${STAMP.replace(/\s+/g, " ")}`,
    `The ask: ${cta.line} / ${cta.url}`,
    "",
    "| file | size | app theme | placement |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.file} | ${LAYOUT[row.size].w}x${LAYOUT[row.size].h} | ${row.theme} | ${row.where} |`),
    "",
    "The light pair is the campaign's own preference and the dark pair is the alternate; they are",
    "the same sheet with the other half of the fragment table in it, so either can go up on its own",
    "and the two should not be posted as a set.",
    "",
    "## Feed  (1080x1350, 4:5)",
    "",
    "### Instagram",
    "",
    captions.instagram,
    "",
    "### TikTok photo post",
    "",
    captions.tiktok,
    "",
    "## Story  (1080x1920, 9:16)",
    "",
    ...storySetup(cta),
    "",
    "Nothing that has to be read lives in the top 250px or the bottom 250px, which is roughly what",
    "Instagram's own chrome covers, so the sheet survives the profile row, the close button and the",
    "reply bar without moving.",
  ].join("\n")}\n`;
};
