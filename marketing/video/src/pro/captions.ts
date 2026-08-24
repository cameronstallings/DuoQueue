/**
 * THE POST COPY FOR THE FOUR REELS, generated rather than typed.
 *
 * =====================================================================================
 * THE CAPTION IS THE ONLY LINK, ON ALL THREE PLATFORMS
 * =====================================================================================
 *
 * An organic Reel, an organic TikTok and a Short all have the same property and it is the whole
 * reason this file is careful: NOTHING IN THE VIDEO IS TAPPABLE. There is no link sticker on a
 * feed post, no card, no swipe-up, and the end card's `duoqueue.io` is pixels. So the address has
 * to be in the TEXT of every caption, every time, on every platform, or the post is a piece of
 * film with no way out of it. `pnpm validate` asserts it on every block this file can produce,
 * because it is exactly the kind of thing that gets dropped from the fourth caption at eleven at
 * night and fails silently in the one way that costs the whole post.
 *
 * The bio is the second route and it is the poster's job, not this file's; the story sheet's own
 * captions.md is the only place in this campaign that gets a tappable sticker.
 *
 * =====================================================================================
 * THE HOOK IS TAKEN OUT OF THE FILM RATHER THAN WRITTEN AGAIN
 * =====================================================================================
 *
 * `hookOf` reads a beat's own `phrase` off the script. So the first line of a caption is literally
 * the first line of the film it is under, and a rewrite of the read rewrites the caption with it.
 * Two places holding the same sentence is how the campaign already produced a set of videos whose
 * captions described the previous cut, and `pnpm validate` reported zero errors on that state.
 *
 * THE OBJECTION REEL IS THE ONE THAT TAKES A DIFFERENT BEAT, and the reason is worth stating
 * plainly because it is the most consequential decision in this file.
 *
 * That film's first line names the category on purpose: it is a resemblance named and then
 * corrected, and the correction is the other three quarters of the film. That works IN A FILM,
 * because a film finishes its sentence. IT DOES NOT WORK IN A CAPTION, and the reason is the same
 * one src/static/captions.ts gives for its hashtags: a caption is the part of a post a classifier
 * actually parses, so a caption that names the category is a caption that FILES the post under it,
 * in the one place a machine is reading rather than a person. The film gets to say the line
 * because the film is watched; the caption says what the thing IS.
 *
 * So the objection caption opens on "18 plus and platonic" and takes its hook from beat three,
 * "it exists so you have someone to queue with". The category is named nowhere in this file, in
 * any caption, on any platform, and `pnpm validate` asserts it.
 *
 * =====================================================================================
 * THE TAGS ARE DERIVED FROM THE SHOT PLAN
 * =====================================================================================
 *
 * "a tag naming something that is not in the post is the only kind that costs anything" is
 * src/static/captions.ts's rule and it was hand-applied there. Here it is computed: `#valorant`
 * because every one of the four ends on the gameplay plate, and `#rocketleague` only on the three
 * whose `role` chip lifts off the glass and prints ROCKET LEAGUE at 700px wide. `hours` does not
 * get it, because `hours` lifts the sent message instead and that title is never on its frame.
 *
 * NOTHING HERE IS DATING ADJACENT, in the copy or in the tags, and there are no em dashes.
 */
import type { Cta } from "@/config/phase";

import { shotsFor } from "./shots";
import type { ProScript } from "./script";

/** The five established tags, unchanged from src/config/captions.ts, so the reels are filed with
 * the day pipeline's videos, the carousel and the sheets rather than in a set of their own. */
const HASHTAGS = ["#gaming", "#soloqueue", "#lfg", "#duo", "#gamerfriends"] as const;

/** TikTok rewards a short tag list and the first four carry the category on their own. */
const TIKTOK_HASHTAG_COUNT = 5;

/** YouTube truncates a Shorts title past 100 characters. Restated from src/config/captions.ts's
 * own constant so the two cannot become two different numbers; `pnpm validate` asserts the titles
 * below are under it, which they are by 40 characters. */
export const YOUTUBE_TITLE_MAX = 100;

export interface YoutubeCaption {
  title: string;
  description: string;
}

export interface ReelCaptions {
  instagram: string;
  tiktok: string;
  youtube: YoutubeCaption;
}

interface ReelCopy {
  /**
   * Which beat's phrase opens the caption. Zero for three of the four; see the header for why the
   * objection reel takes beat three instead.
   */
  hookBeat?: number;
  /** Printed above the hook. Only the objection reel has one, and it is the stamp. */
  lead?: string;
  /** The paragraphs under the hook, in reading order, each one its own block on Instagram. */
  body: readonly string[];
  /** TikTok is one run-on line and a poster is not going to reformat it, so it is written as one
   * rather than assembled out of the paragraphs above and hoping the joins read. */
  tiktok: string;
  /** The Shorts title. It is shorter and flatter than the hook on purpose: a Shorts title is read
   * as a label in a grid, not as the first line of a caption. */
  title: string;
}

const STAMP = "18 plus and platonic, for people who want somebody to queue with.";

const COPY: Record<string, ReelCopy> = {
  "pro-pain": {
    body: [
      "duoqueue is where you pick one of the four.",
      "every card shows the games you share and how they play, so you know what you are getting before the queue starts. lock the duo, send a message, and go play.",
      STAMP,
    ],
    tiktok:
      "solo queue hands you four strangers and a coin flip. duoqueue is where you pick one of the four. 18 plus and platonic.",
    title: "pick one of the four",
  },

  "pro-mechanic": {
    body: [
      "shared games, shared hours, and how you both play. the card on top is the highest score, which is the whole difference between a deck and a list. a list is only ever whoever posted last.",
      "lock the duo, send a message, and go play.",
      STAMP,
    ],
    tiktok:
      "every card in your deck is scored on shared games, shared hours and how you both play, and the highest score is the one on top. 18 plus and platonic.",
    title: "your deck is sorted before you see it",
  },

  // Beat three, and the stamp above it. See the header: the film names the resemblance and
  // corrects it, and the caption is the place that correction has to stand on its own.
  "pro-objection": {
    hookBeat: 2,
    lead: "18 plus and platonic.",
    body: [
      "every card says three games in common and how they play. the whole app is that one screen, and the games on it are the ones already on your disk.",
      "lock the duo, send a message, go get a game in.",
    ],
    tiktok:
      "18 plus and platonic. three games in common, how they play, and someone to queue with. that is the entire app.",
    title: "someone to queue with",
  },

  "pro-hours": {
    body: [
      "duoqueue counts the hours you overlap, so the top of your deck is awake when you are.",
      "lock the duo, ask if they are on, and go play.",
      STAMP,
    ],
    tiktok:
      "you play at midnight and everyone you know plays at eight. duoqueue counts the hours you overlap. 18 plus and platonic.",
    title: "find a duo who is awake when you are",
  },
};

/** A beat's phrase as a caption sentence: the read carries no terminal punctuation, because the
 * frame must not show one, and a caption is prose. */
const hookOf = (script: ProScript, beat: number): string => {
  const phrase = script.beats[beat]?.phrase ?? "";
  return `${phrase}.`;
};

const tagsFor = (script: ProScript): string[] => {
  const shots = shotsFor(script.id);
  const lifted = [...(shots.pair ?? []), ...shots.close];
  return [
    ...HASHTAGS,
    // Every one of the four ends on the gameplay plate, so this one is unconditional and is
    // still derived rather than assumed: it is the closing plate that earns it.
    "#valorant",
    ...(lifted.includes("role") ? ["#rocketleague"] : []),
  ];
};

export const captionsForReel = (script: ProScript, cta: Cta): ReelCaptions => {
  const copy = COPY[script.id];
  if (copy === undefined) {
    throw new Error(`No caption copy for ${script.id}. Add a row to COPY in src/pro/captions.ts.`);
  }
  const hook = hookOf(script, copy.hookBeat ?? 0);
  const call = `${cta.line}: ${cta.url}`;
  const tags = tagsFor(script);

  const instagram = [
    ...(copy.lead === undefined ? [] : [copy.lead, ""]),
    hook,
    "",
    copy.body.join("\n\n"),
    "",
    call,
    "",
    tags.join(" "),
  ].join("\n");

  return {
    instagram,
    tiktok: [copy.tiktok, call, tags.slice(0, TIKTOK_HASHTAG_COUNT).join(" ")].join(" "),
    youtube: {
      title: copy.title,
      description: [
        ...(copy.lead === undefined ? [] : [copy.lead, ""]),
        hook,
        "",
        copy.body.join("\n\n"),
        "",
        call,
        "",
        tags.join(" "),
      ].join("\n"),
    },
  };
};

export interface ReelRow {
  file: string;
  script: ProScript;
  frames: number;
  seconds: number;
}

/**
 * out/_reels/captions.md, which exists so the workflow is: open the file, copy one block, switch
 * app, paste. It is the carousel's and the sheets' file for the four reels, with one thing neither
 * of those needs to say twice: the address is in every block because none of the three placements
 * has a clickable anything.
 */
export const reelCaptionsMarkdown = (cta: Cta, rows: readonly ReelRow[]): string => {
  const blocks = rows.flatMap((row) => {
    const captions = captionsForReel(row.script, cta);
    const name = row.script.id.replace(/^pro-/, "");
    return [
      `## ${name}  ·  \`${row.file}\``,
      "",
      `1080x1920, ${String(row.frames)} frames, ${row.seconds.toFixed(2)}s. The film says:`,
      "",
      ...row.script.beats.map((beat) => `> ${beat.phrase}`),
      "",
      "### Instagram Reels",
      "",
      "```",
      captions.instagram,
      "```",
      "",
      "### TikTok",
      "",
      "```",
      captions.tiktok,
      "```",
      "",
      "### YouTube Shorts",
      "",
      `Title (${String(captions.youtube.title.length)} of ${String(YOUTUBE_TITLE_MAX)} characters):`,
      "",
      "```",
      captions.youtube.title,
      "```",
      "",
      "Description:",
      "",
      "```",
      captions.youtube.description,
      "```",
      "",
    ];
  });

  return `${[
    "# The four reels",
    "",
    "Four angles on one product, in the approved `pro-a-light` system: the phone as a single lit",
    "object on warm paper, and the statement alone on clean paper between the object beats. Same",
    "ground, same camera, same type, same audio chain, same end card. Only the words differ, and",
    "which app fragments each set of words needs.",
    "",
    `**Every caption below carries ${cta.url} in its text, and that is not a style choice.** An`,
    "organic post on all three platforms has no tappable link anywhere in the video, so the caption",
    "and the profile bio are the only two routes to the waitlist that exist. A block pasted without",
    "the address is a post with no way out of it.",
    "",
    "## Post them in this order",
    "",
    "| # | reel | why here |",
    "| --- | --- | --- |",
    "| 1 | pain | the widest reach, and the batch needs a number to compare against the 116 before anything else is learned |",
    "| 2 | hours | the most self-selecting, so the cleanest read on whether the account reaches gamers at all |",
    "| 3 | objection | the most shareable, once there is a follower or two to absorb it |",
    "| 4 | mechanic | a second-touch asset in a first-touch shape. Post it last and pin it |",
    "",
    "One a day at most, and never two in the same session: four posts in an evening on a cold",
    "account measures the account rather than the angles, and the whole point of four scripts is to",
    "find out which sentence stops a stranger.",
    "",
    "## Set the cover by hand. Every time, on all three.",
    "",
    "Every film opens with a ten frame ramp out of black, which is the approved direction and is",
    "not changing. It means frame zero of all four is a BLACK FRAME, and a platform left to pick a",
    "thumbnail for itself can pick it. On a cold account with no follower graph, the still in the",
    "grid is doing the same job as the hook, so it does not get left to a default.",
    "",
    "Beside each MP4 in this folder is a `-cover.png` at 1080x1920, taken on the frame where that",
    "film's chosen statement is fully up and nothing on it is moving. Upload it as the cover:",
    "",
    "| where | how |",
    "| --- | --- |",
    "| Instagram | after trimming, Cover, then the photo icon on the left of the filmstrip |",
    "| TikTok | on the post screen, Select cover, then Upload |",
    "| YouTube Shorts | Edit, Thumbnail, Upload file. Shorts allows a custom one on a verified account |",
    "",
    ...blocks,
  ].join("\n")}\n`;
};
