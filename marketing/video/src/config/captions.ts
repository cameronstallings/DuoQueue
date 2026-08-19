import type { Cta } from "./phase";
import type { Hook } from "../types";

/**
 * One caption line per hook becomes three platform captions. The alternative, authoring three
 * per video, is three times the writing and three times the places a claim can drift, for a
 * difference no viewer of any one platform can see.
 */

export type Platform = "instagram" | "tiktok" | "youtube";

export interface YoutubeCaption {
  title: string;
  description: string;
}

export interface PlatformCaptions {
  instagram: string;
  tiktok: string;
  youtube: YoutubeCaption;
}

/**
 * Retuning reach is one edit here, never a per-hook chore. Ordered by how well each one
 * describes the video rather than by volume: the first four go to TikTok, all five to the
 * others. Nothing here is dating-adjacent, deliberately, because the hashtag is the only part
 * of a post the algorithm reads as a category.
 */
const HASHTAGS = ["#gaming", "#soloqueue", "#lfg", "#duo", "#gamerfriends"] as const;

const TIKTOK_HASHTAG_COUNT = 4;

/** YouTube truncates a Shorts title past 100 characters, and truncating it itself puts the
 * cut wherever it lands. Doing it here means the cut is at a word. Exported because
 * src/lib/captions.ts both asserts against it and prints it into captions.md, and a platform
 * limit restated in three files is a limit that will eventually be three different numbers. */
export const YOUTUBE_TITLE_MAX = 100;

const ctaLine = (cta: Cta): string => `${cta.line}: ${cta.url}`;

/** Exported for the title assertion in src/lib/captions.ts, which has to compare a truncated
 * title against the line it was truncated from. */
export const lineFor = (hook: Hook, platform: Platform): string =>
  hook.captionOverrides?.[platform] ?? hook.caption;

const truncateAtWord = (text: string, max: number): string => {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
};

export const captionsFor = (hook: Hook, cta: Cta): PlatformCaptions => {
  const call = ctaLine(cta);
  const youtubeLine = lineFor(hook, "youtube");

  return {
    instagram: [lineFor(hook, "instagram"), "", call, "", HASHTAGS.join(" ")].join("\n"),
    tiktok: [
      lineFor(hook, "tiktok"),
      call,
      HASHTAGS.slice(0, TIKTOK_HASHTAG_COUNT).join(" "),
    ].join(" "),
    youtube: {
      title: truncateAtWord(youtubeLine, YOUTUBE_TITLE_MAX),
      description: [youtubeLine, "", call, "", HASHTAGS.join(" ")].join("\n"),
    },
  };
};
