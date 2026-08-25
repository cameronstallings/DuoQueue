/**
 * TEN CAPTIONS, THE UPLOAD ORDER FOR EACH, AND THE TWO NOTES THAT BELONG BESIDE THEM.
 *
 * out/_carousels/captions.md is the file somebody has open in one window with the upload picker
 * in the other. It does four jobs and each of them exists because of a way this has gone wrong:
 *
 * 1. UPLOAD ORDER. A carousel that goes up with card four in front of card two is not a slightly
 *    worse post, it is an incoherent one. The picker sorts by filename, so the files are numbered
 *    and every set prints its own order beside what each card actually says.
 *
 * 2. THE URL, IN THE TEXT, EVERY TIME. An organic post has no tappable link. The caption and the
 *    bio are the only two routes to the waitlist that exist, and a caption that says "link on the
 *    last card" is a promise nothing on a PNG can keep.
 *
 * 3. THE CAPTION IS NOT THE HEADLINES REPEATED. A set carries between eight and twenty-two words
 *    in total. Restating them wastes the one place in the post where a full sentence is allowed,
 *    so each caption says its own argument end to end for the reader who never swipes, and each
 *    one is that SET's argument rather than a house paragraph pasted ten times.
 *
 * 4. NO NEGATIONS AND NOTHING CATEGORY-ADJACENT, in the copy or in the tags. The campaign spent a
 *    whole script learning that naming the category is what files you under it, and a hashtag is
 *    the part of a post an algorithm reads AS a category.
 *
 * THE TAGS ARE DERIVED FROM THE PIXELS RATHER THAN TYPED. A tag naming something visible in the
 * post is the only kind worth adding, so `#rocketleague` is added exactly when a set draws a
 * piece that carries the playstyle chip and `#valorant` exactly when it draws the gameplay plate.
 * Typed by hand they would be right today and wrong the first time a set's pieces change.
 */
import type { Cta } from "@/config/phase";

import { SETS, SIGNATURE_LABEL, type CarouselSet, type SetCard } from "./sets";

/** The five established tags, unchanged from src/config/captions.ts so the carousels are filed
 * with the videos and with the shipped six. */
const HOUSE = ["#gaming", "#soloqueue", "#lfg", "#duo", "#gamerfriends"] as const;

const TIKTOK_TAGS = 5;

/** Which title a piece puts on the frame, if any. `card` and `role` both carry "ROCKET LEAGUE .
 * Ranked Grinder" at legible size; `play` is a Valorant capture. Nothing else names a game. */
const TITLE_TAG: Partial<Record<string, string>> = {
  card: "#rocketleague",
  role: "#rocketleague",
  play: "#valorant",
};

const tagsFor = (set: CarouselSet): string[] => {
  const seen = new Set<string>();
  for (const card of set.cards) {
    for (const piece of card.pieces ?? []) {
      const tag = TITLE_TAG[piece.piece];
      if (tag !== undefined) {
        seen.add(tag);
      }
    }
  }
  return [...HOUSE, ...[...seen].sort()];
};

export interface SetCaptions {
  instagram: string;
  tiktok: string;
}

export const captionsFor = (set: CarouselSet, cta: Cta): SetCaptions => {
  const call = `${cta.line}: ${cta.url}`;
  const tags = tagsFor(set);
  return {
    instagram: [
      set.caption.hook,
      "",
      set.caption.body.join("\n\n"),
      "",
      call,
      "",
      tags.join(" "),
    ].join("\n"),
    tiktok: [
      set.caption.short,
      call,
      tags.slice(0, TIKTOK_TAGS).join(" "),
    ].join(" "),
  };
};

/** The label, as a filename. The number in front is what the upload picker sorts on; the words
 * after it are what a human recognises the file by. */
export const fileFor = (set: CarouselSet, index: number): string => {
  const label = set.cards[index]?.label ?? SIGNATURE_LABEL;
  return `${String(index + 1).padStart(2, "0")}-${label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}.png`;
};

const saysOf = (card: SetCard | undefined): string =>
  card === undefined
    ? "the lockup, the call to action and the url"
    : [card.figure, ...card.lines].filter((part) => part !== undefined).join(" ");

const deviceOf = (card: SetCard | undefined): string => {
  if (card === undefined) {
    return "signature";
  }
  const pieces = (card.pieces ?? []).map((piece) => piece.piece).join(" + ");
  const bits = [card.layout, pieces === "" ? "bare" : pieces];
  if (card.stamp ?? false) {
    bits.push("STAMP");
  }
  if (card.callouts !== undefined) {
    bits.push("callouts");
  }
  return bits.join(", ");
};

/**
 * THE POSTING ORDER, which is not the order the sets are declared in.
 *
 * Ten posts is ten to fifteen days of a feed, and the first two decide whether anybody sees the
 * other eight. The order is card one at 150px first, argument second, and no two consecutive
 * posts leading on the same object third.
 *
 * THE ORDER CHANGED WHEN THE THUMBNAILS WERE ACTUALLY SHRUNK. This comment used to open on
 * `gaming-app`, on the reasoning that a sentence over a real photograph with two leaders coming
 * out of it is the most arresting frame in the campaign. At full size that is true. At 150px the
 * leaders and their 26px mono callouts are sub-pixel mush, the headline is 119 across two lines,
 * and the set ranks eighth of ten on the only test that decides whether the post is opened. It
 * is third now, which is early enough to do the 2.3.6 job while the account is still being
 * worked out, and its callouts are spent where they are legible: in the caption and on the card
 * itself once somebody has tapped in.
 *
 * `zero` leads because a 412px numeral and one olive word is the most legible thing in the ten
 * and it states a problem rather than describing an arrangement. `sorted` is second because the
 * cascade is the only silhouette in the campaign that is not a rectangle, and because it answers
 * "how is this different from an LFG channel" before anybody asks it out loud.
 *
 * The last three are last for two different reasons. `two` and `seriously` are the weakest
 * arguments and that is where they do the least damage if they are cut. `early` is last because
 * it is GATED rather than weak: see the note above it.
 */
export const POSTING_ORDER = [
  "zero",
  "sorted",
  "gaming-app",
  "opener",
  "backwards",
  "midnight",
  "sentence",
  "two",
  "seriously",
  "early",
] as const;

const orderedSets = (): CarouselSet[] => {
  const byName = new Map(SETS.map((set) => [set.name, set]));
  const ordered = POSTING_ORDER.map((name) => byName.get(name)).filter(
    (set): set is CarouselSet => set !== undefined,
  );
  // Anything added to ./sets and not to the order above still ships, at the end, rather than
  // silently vanishing out of the caption file.
  return [...ordered, ...SETS.filter((set) => !POSTING_ORDER.includes(set.name as never))];
};

/**
 * The two judgements that belong in the file somebody schedules from, rather than in a report
 * that gets read once.
 */
const NOTES = [
  "## Two notes before any of this goes up",
  "",
  "**`early` promises a WHEN.** Its card five says the app opens all at once. That is true of a",
  "waitlist and it is a scarcity argument that works, but it must not be posted until there is a",
  "date behind it, and it should come down the week the app is live: the day after launch, telling",
  "a stranger the deck is small stops being a reason to join and starts being a reason not to.",
  "",
  "**`seriously` and `two` are the weakest of the ten and they are ninth and eighth for that",
  "reason.** `seriously` is `sorted` viewed closer: mismatched intensity is a real fear that nobody",
  "in the category addresses, but its whole evidence is one chip that says two words. It is four",
  "cards rather than five because the fifth was `sorted`'s own card four in different words. `two`",
  "argues something a stranger already assumes, and its safety signal is delivered harder and",
  "three cards earlier by",
  "`gaming-app`. Both are complete and both are postable. The higher-value move than posting them",
  "is thirty seconds of recording: src/pro/angles.ts already names the profile detail sheet as the",
  "highest value footage this campaign could shoot next, and it unlocks two sets that beat both,",
  "shared hours WITH a picture (which would close the one bare claim in `midnight`) and how they",
  "handle losing, which is a real field with real strings and a differentiator no competitor has.",
] as const;

export const captionsMarkdown = (cta: Cta): string => {
  const sets = orderedSets();
  const lines: string[] = [
    "# Ten carousels  (1080x1350, 4:5)",
    "",
    `Ten sets, ${String(sets.reduce((sum, set) => sum + set.cards.length + 1, 0))} cards, one signature.`,
    "Every set ends on the same last card and that file is byte for byte identical in all ten:",
    "the mark, the wordmark, the ask on its off-black slab, and the url. It is the campaign's",
    "signature, so it carries no page counter, which is the one element that would otherwise",
    "differ between a four-card set and a six-card one.",
    "",
    "Upload in filename order. The picker sorts by filename, so the numbers ARE the order.",
    "",
    "Listed below in POSTING order, which is by the strength of card one at thumbnail size. The",
    "declaration order in src/carousels/sets.ts is the order they were designed in and means",
    "nothing.",
    "",
    ...NOTES,
    "",
  ];

  sets.forEach((set, position) => {
    const captions = captionsFor(set, cta);
    const total = set.cards.length + 1;
    const rows = Array.from({ length: total }, (unused, index) => {
      const card = set.cards[index];
      return `${String(index + 1).padStart(2, "0")}  ${fileFor(set, index).padEnd(22)}  ${(
        card?.label ?? SIGNATURE_LABEL
      ).padEnd(14)}  ${deviceOf(card).padEnd(34)}  ${saysOf(card)}`;
    });

    lines.push(
      "---",
      "",
      `## ${String(position + 1)}. \`${set.name}\`  -  ${String(total)} cards`,
      "",
      `**Shape.** ${set.shape}`,
      "",
      `**Why this one is not one of the others.** ${set.why}`,
      "",
      "```",
      `out/_carousels/${set.name}/`,
      ...rows,
      "```",
      "",
      "### Instagram",
      "",
      captions.instagram,
      "",
      "### TikTok",
      "",
      captions.tiktok,
      "",
    );
  });

  return `${lines.join("\n")}\n`;
};
