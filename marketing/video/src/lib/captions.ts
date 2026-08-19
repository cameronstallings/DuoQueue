import { captionsFor, lineFor, YOUTUBE_TITLE_MAX } from "../config/captions";
import type { Cta, Phase } from "../config/phase";
import type { Hook } from "../types";

/**
 * `captions.md`, the only file in a day's output that is read rather than uploaded.
 *
 * The whole shape follows from how it is used: open the file, copy one block, switch app,
 * paste, come back. So each block is complete on its own, with the call to action and the
 * hashtags already inside it. Nothing here needs a decision or an edit after pasting, because
 * a daily step that needs either is a daily tax and this file is opened every morning.
 *
 * Blocks are plain text, not fenced. Fences would give a rendered viewer a copy button and
 * cost every plain editor two lines that must not be copied, and the editor is where this
 * actually gets read. The templates already separate their parts with blank lines, so the
 * blocks survive being rendered as markdown too. A hashtag is safe as the first character of a
 * line: an ATX heading needs a space after the hashes, and `#gaming` has none.
 *
 * Returns the document instead of writing it. render-day owns `out/<date>/`, and a builder
 * with no I/O can be run against a synthetic day to check its own output.
 */

export interface CaptionsVideo {
  /** Posting order, 1 based. The same number that prefixes the two files below. */
  slot: number;
  hook: Hook;
  /** File names, not paths: they sit beside captions.md and are read, not resolved. */
  file: string;
  cover: string;
}

export interface CaptionsInput {
  /** YYYY-MM-DD, the name of the day's folder. */
  date: string;
  phase: Phase;
  /**
   * Passed in already resolved rather than read from config here. This file describes videos
   * that have already been encoded, and the CTA burned into their end card is the one render
   * day resolved before bundling. Reading the environment a second time is how the two come
   * to disagree.
   */
  cta: Cta;
  videos: CaptionsVideo[];
}

const hex = (code: number): string => `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;

/**
 * YouTube is the one platform that will silently rewrite a field. A Shorts title over the
 * limit is cut wherever the hundredth character lands, which is usually mid word and always
 * looks careless, so the cut is made here, at a space, by `truncateAtWord`. This asserts that
 * it worked: a caption that is one long unbroken string has no space to cut at, and the only
 * fix for that is editorial.
 */
export const assertYoutubeTitle = (hook: Hook, title: string): void => {
  const source = lineFor(hook, "youtube");

  if (title.length === 0) {
    throw new Error(`${hook.id}: the YouTube title is empty. Give the hook a caption.`);
  }
  if (title.length > YOUTUBE_TITLE_MAX) {
    throw new Error(
      `${hook.id}: the YouTube title is ${title.length} characters, over the ${YOUTUBE_TITLE_MAX} YouTube allows.`,
    );
  }
  if (title.length === source.length) {
    return;
  }

  // The title is a prefix of the caption, so the character the caption continues with is the
  // one the cut landed on. A space there means a whole word was dropped, which is the intent.
  const boundary = source.charAt(title.length);
  if (boundary.trim() !== "") {
    throw new Error(
      `${hook.id}: the YouTube title would cut mid word at "${title.slice(-12)}|${boundary}". ` +
        `Shorten the caption to ${YOUTUBE_TITLE_MAX} characters or add captionOverrides.youtube.`,
    );
  }
};

/**
 * ASCII, and nothing else. This file is read in a terminal, in an editor and on a phone, and a
 * smart quote or an em dash that survives all three still lands in a published post. Checked
 * on the assembled document rather than on the hooks, because the glue below is one more place
 * a stray character can enter, and because it holds no matter who calls this.
 */
const assertAscii = (document: string): void => {
  document.split("\n").forEach((line, index) => {
    for (const char of line) {
      const code = char.codePointAt(0) ?? 0;
      if (code < 0x20 || code > 0x7e) {
        throw new Error(
          `captions.md line ${index + 1} contains ${hex(code)}, and this file is ASCII only: "${line}"`,
        );
      }
    }
  });
};

const section = (video: CaptionsVideo, cta: Cta): string => {
  const captions = captionsFor(video.hook, cta);
  assertYoutubeTitle(video.hook, captions.youtube.title);

  return [
    `## ${video.slot}. ${video.hook.id}`,
    // Two spaces after "file:" so the two names line up and a wrong pairing is visible.
    `file:  ${video.file}`,
    `cover: ${video.cover}`,
    "",
    "### Instagram Reels",
    captions.instagram,
    "",
    "### TikTok",
    captions.tiktok,
    "",
    "### YouTube Shorts",
    // The limit is stated because the title is the one field Cameron may want to rewrite by
    // hand, and knowing the ceiling is the difference between rewriting it and truncating it.
    `TITLE (max ${YOUTUBE_TITLE_MAX}): ${captions.youtube.title}`,
    "DESCRIPTION:",
    captions.youtube.description,
  ].join("\n");
};

export const captionsMarkdown = (input: CaptionsInput): string => {
  // The phase is in the heading because it is the one thing about a day's output that cannot
  // be checked by looking at the file: the CTA below is correct for whichever phase rendered
  // it, and this says which that was.
  const heading = `# Day ${input.date}  (phase: ${input.phase})`;
  const document = `${[heading, ...input.videos.map((video) => section(video, input.cta))].join("\n\n")}\n`;

  assertAscii(document);
  return document;
};
