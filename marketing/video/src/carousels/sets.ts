/**
 * THE TEN, AS A TABLE.
 *
 * =====================================================================================
 * THE BRIEF IN ONE LINE
 * =====================================================================================
 *
 * The visual DNA is constant and the ARGUMENT SHAPE is not. Everything a stranger uses to
 * recognise a brand across three exposures - the paper, the inks, the typeface, the fitting law,
 * the camera, the footage, the furniture, the frame and the last card - is identical in all ten.
 * What changes is the SHAPE OF THE ARGUMENT, and therefore the composition it needs.
 *
 * =====================================================================================
 * WHAT WAS CHECKED BEFORE ANY OF THIS WAS WRITTEN
 * =====================================================================================
 *
 * 1. THE FITTING CONSTANT. Measured off 01-the-deck.png by ink bands, card two's three-line stack
 *    has band starts at y=317/388/460, so its leading is 71.5 and its size is 67.5 on a
 *    21-character longest line. That fixes size ~= 1418 / longest-line characters. The 138 clamp
 *    therefore binds at TEN CHARACTERS OR FEWER, not at three words, and six of the ten put a
 *    <=10 character line on the card that has to survive a 150px thumbnail. Two constants fall
 *    out of it and are enforced in `pnpm validate`: a 138px block is at most two lines, because
 *    3 x 1.06 x 138 = 439 and the head row's ink is at 140; and a three-line block is at most
 *    107, which leaves 40px of air.
 *
 * 2. THE LUMA BAND. See ./ground. The film's 229-232 is the number for a card with the product
 *    deleted off it. The shipped six measure 196.5 to 211.2.
 *
 * 3. EVERY FRAGMENT, AT 1:1, FOR WHAT IS ACTUALLY LEGIBLE IN IT. `card` carries a photograph, a
 *    chartreuse NO. 001, an avatar ring with an online dot, "Kofi, 26 . Africa . EN" and
 *    "ROCKET LEAGUE . Ranked Grinder", and it stops above the prompt. `games` is ">> 3 GAMES IN
 *    COMMON" in the app's amber. `role` is the playstyle chip and needs the shipped crop. `duo`
 *    is a SETTLED "DUO LOCKED" over the photograph and carries no game title. `send` is the raw
 *    chartreuse button. `bubble` reads "Hey you on tn?" with a chartreuse SENT and no name.
 *    `play` is a doorway, a sea and a first-person weapon and needs the shipped redaction crop.
 *    No line below claims anything its own card's pixels do not carry.
 *
 * =====================================================================================
 * ZERO NEW FOOTAGE, AND THE THREE FRAGMENTS THAT STAY OUT
 * =====================================================================================
 *
 * The ten use SEVEN pieces and they are exactly the seven already in src/carousel/plan.ts's
 * `PIECES`. Nothing in src/pro/media.tsx or src/data/clips.ts is edited, and no crop is re-cut.
 *
 * Deliberately unused: `locked`, because a still wants the banner closed and its first frame is
 * mid-animation, which is what `duo` exists for; `actions`, because the anti-obligation argument
 * it would carry lands about level with `two` and is not worth an eleventh set; `screen`, because
 * a whole phone contradicts the fragment method the whole campaign is built on.
 *
 * Permanently barred: `prompt` and `card-lower`, both of which carry "SOLO QUEUE" at legible
 * size inside a set about finding a duo, and `highlights`, which is four real faces in a row and
 * is the most category-shaped object in the footage.
 *
 * =====================================================================================
 * THE PLATONIC READ: FOUR POSITIONS, FOUR DEVICES
 * =====================================================================================
 *
 *   gaming-app  card 1 of 5   the HEADLINE itself, plus two callouts naming the game and the
 *                             playstyle, and a second stamp on card 4
 *   sorted      card 2 of 5   ">> 3 GAMES IN COMMON" + the stamp
 *   opener      card 2 of 5   ">> 3 GAMES IN COMMON" + the stamp
 *   seriously   card 2 of 4   the playstyle chip over the overlap chip + the stamp
 *   backwards   card 3 of 4   both chips + the stamp
 *   zero        card 3 of 5   both chips + the stamp
 *   midnight    card 3 of 4   the whole card, age and game and playstyle + the stamp
 *   two         card 3 of 4   both chips + the stamp
 *   sentence    card 4 of 6   both chips + the stamp
 *   early       card 4 of 6   both chips + the stamp
 *
 * It is never the same card in the same position twice running, and the stamp is the campaign's
 * own string in the campaign's own voice in a slot that already exists.
 *
 * =====================================================================================
 * FIVE DUPLICATIONS CAUGHT DURING DESIGN AND KILLED, RATHER THAN AFTER
 * =====================================================================================
 *
 * 1. "The four taps" and "the receipt" are both the shipped walkthrough in different clothes.
 *    out/_carousel/ is that post and it goes up this week. Neither became a set.
 * 2. The brief's "solo queue against a duo, two columns" cannot be built honestly. There is no
 *    footage of solo queue and none of an LFG channel, so the second column would have to be
 *    invented UI, which is a harder version of "a claim over a screenshot that says otherwise".
 *    The comparison survives only where both halves are real: as NUMBERS (`zero`) and as TIMES
 *    (`midnight`).
 * 3. The objection set and an anatomy set were one argument separated by a headline. Merged: the
 *    callout device moved into `gaming-app` as the evidence for its sentence.
 * 4. `zero` and `midnight` shared a skeleton. `zero` was cut back to a single figure so the
 *    DOUBLING belongs to `midnight`, where two numbers are the argument.
 * 5. `sorted` and `seriously` are one argument at two zoom levels. Both survive because ten were
 *    asked for, and verification cut `seriously` to four cards so that at least they no longer
 *    share a PICTURE of it. It is still the weakest of the ten and the note is in ./captions.
 */
import type { CardPose, Crop, PieceName } from "@/carousel/plan";

import { CALLOUT_RAILS, part, type Callout, type Cascade } from "./ground";

export type { CardPose, Crop, PieceName };

/** Which of the six laws a card is set under. See the header of ./ground. */
export type Layout = "statement" | "inverted" | "figure" | "cascade" | "annotated" | "plate";

export interface Placed {
  piece: PieceName;
  /** In frame pixels. Every width in the ten is the measure or a stated fraction of it. */
  width: number;
  radius: number;
  crop?: Crop;
}

/**
 * `frag-play` is a redaction that is 44px short: a 20x23 rectangle of another game's own chrome
 * survives at the crop's left edge and is invisible under a moving object and flat and grey when
 * held. `x: 48` is the shipped offset and is not negotiable. See `Crop` in src/carousel/plan.ts.
 */
export const PLAY_CROP: Crop = { x: 48, y: 0, width: 1612, height: 934 };

/**
 * The playstyle chip cut to ITSELF. The film's rectangle carries 17px of the photograph on one
 * side and 19 on the other, clips the chip's top border and keeps its bottom one, and held on
 * paper that is a hairline leaving the top right corner at an angle. Also the shipped crop.
 */
export const ROLE_CROP: Crop = { x: 18, y: 0, width: 630, height: 80 };

export interface SetCard {
  /** The spine, foot left, unless `stamp` takes the slot. Lower case here, drawn upper case. */
  label: string;
  /** The headline in its authored break. Never one word alone at the end of a stack. */
  lines: string[];
  /** The one word set in the light theme's volt. Whole-word, case insensitive. */
  key?: string;
  layout: Layout;
  /** Top to bottom, which is the order the eye reads them. Absent on `figure` and `plate`. */
  pieces?: Placed[];
  pose?: CardPose;
  /** `figure` only: the display numeral. */
  figure?: string;
  /** `cascade` only. */
  cascade?: Cascade;
  /** `annotated` only. Fractions are of the FIRST piece's own source rectangle. */
  callouts?: readonly Callout[];
  /** Swaps the platonic stamp into the foot-left slot in place of the spine label. */
  stamp?: boolean;
  /**
   * A ceiling under TYPE.max, for a block whose LINE COUNT rather than whose width is what
   * constrains it. A three-line block fitted to the measure comes back at up to 138 and 3 x 1.06
   * x 138 = 439 walks into the head row.
   */
  max?: number;
  /**
   * Cards that must be set at ONE solved size, because the comparison between them is the
   * argument. Only `midnight` uses it, and there the two times are a matched pair.
   */
  solve?: string;
}

export interface SetCaption {
  /** One line, for the reader looking at card one and deciding. */
  hook: string;
  /** The argument, end to end, for the reader who never swipes. */
  body: readonly string[];
  /** One breath, for a platform that shows three lines. */
  short: string;
}

export interface CarouselSet {
  /** The directory under out/_carousels/. */
  name: string;
  /** The argument shape, in one line, printed into captions.md. */
  shape: string;
  /** Why this composition and not the shipped one. Printed into captions.md. */
  why: string;
  cards: readonly SetCard[];
  caption: SetCaption;
}

const CARD_R = 24;
const CHIP_R = 18;
const DUO_R = 26;
const PLAY_R = 22;
const BUBBLE_R = 22;
const SEND_R = 22;

/** The chip pair, in the shipped order: the reason arrives before the person does. */
const OVERLAP_THEN_ROLE: Placed[] = [
  { piece: "games", width: part(1), radius: CHIP_R },
  { piece: "role", width: part(1), radius: 16, crop: ROLE_CROP },
];

/** The same pair inverted, for the two sets whose argument is the playstyle rather than the
 * library. Two crops sharing a left edge and a right edge read as one object either way round;
 * which one is on top is which claim the card is making. */
const ROLE_THEN_OVERLAP: Placed[] = [
  { piece: "role", width: part(1), radius: 16, crop: ROLE_CROP },
  { piece: "games", width: part(1), radius: CHIP_R },
];

const HERO = (width: number): Placed[] => [{ piece: "card", width, radius: CARD_R }];
const GAMEPLAY = (width: number): Placed[] => [
  { piece: "play", width, radius: PLAY_R, crop: PLAY_CROP },
];

/**
 * =====================================================================================
 * 1. `zero` - the arithmetic of solo queue
 * =====================================================================================
 *
 * A single figure as the hook, then the turn, then the evidence. The pain angle, counted.
 *
 * WHY THE FIGURE IS 0 AND NOT 4. The first draft counted the strangers in a lobby. "4" is a
 * five-a-side shape, and the chip every other card in this set stands on says ROCKET LEAGUE,
 * which is three-a-side. No single card contradicted its own pixels - card one is bare paper -
 * but a reader who swipes 01 into 02 assembles the two, and a cross-card inference is still a
 * contradiction. A count of who is ON is true of every game at every team size, so no frame in
 * the footage can disagree with it, and it STATES the pain instead of merely describing the
 * arrangement. "on" rather than "online" because it is the app's own word for it: the message
 * bubble two sets over reads "Hey you on tn?".
 */
const ZERO: CarouselSet = {
  name: "zero",
  shape: "one figure, then the turn, then the evidence",
  why: "the only set that opens on a number, and the only one whose card one has no picture at all. A 412px numeral and one olive word is the most legible thing in the campaign at 150px.",
  cards: [
    {
      label: "nobody on",
      layout: "figure",
      figure: "0",
      lines: ["friends on"],
      key: "friends",
    },
    {
      label: "the pick",
      layout: "statement",
      lines: ["so pick one", "on purpose"],
      key: "purpose",
      pieces: HERO(part(1)),
      pose: { kind: "arrival", amount: 0.3 },
    },
    {
      label: "the reason",
      layout: "statement",
      lines: ["you pick on", "what you both play"],
      key: "both",
      pieces: OVERLAP_THEN_ROLE,
      pose: { kind: "gesture", amount: 0.35 },
      stamp: true,
    },
    {
      label: "the duo",
      layout: "statement",
      lines: ["and then", "it is a duo"],
      key: "duo",
      pieces: [{ piece: "duo", width: part(0.56), radius: DUO_R }],
      pose: { kind: "arrival", amount: 0.3 },
    },
  ],
  caption: {
    hook: "zero friends on, and the queue button is right there.",
    body: [
      "so you queue alone, and the game hands you somebody at random. duoqueue is the other order: a deck of one person at a time, and you pick.",
      "the pick is on the games you both play and how hard you both play them, because that is what a queue actually needs to have in common.",
      "18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "zero friends on, and the queue button is right there. pick somebody on purpose instead.",
  },
};

/**
 * =====================================================================================
 * 2. `sorted` - the ordering carries the information
 * =====================================================================================
 *
 * The mechanic, and the only asset in the campaign that answers "how is this different from an
 * LFG channel". src/static/sheets.ts already argues that a mechanism is the BEST still angle
 * even though it is the worst film, because a still is held and a mechanism rewards being held.
 *
 * THE PICTURE IS THE ARGUMENT HERE AND NOWHERE ELSE. Sortedness is position, the only picture of
 * position is a stack, and that is why the cascade belongs to this set rather than being spread
 * around for variety.
 *
 * EVERY WORD IS CHECKED AGAINST `get_deck` in supabase/migrations/0020_play_window_matching.sql
 * lines 249-264: shared_games x 10 + skill_match x 2 + shared_shows x 5 + shared_languages x 2 +
 * region + least(play_window_overlap_hours, 6) + boost, ordered by score desc. "the top card
 * matches yours" is the ORDER BY. It is not a claim that anything is filtered out.
 */
const SORTED: CarouselSet = {
  name: "sorted",
  shape: "the mechanic: what the order of the deck is made of",
  why: "the cascade is the only picture of POSITION this footage can make, and position is what sortedness is. It is the answer to the one question an LFG channel makes a stranger ask.",
  cards: [
    {
      label: "the deck",
      layout: "cascade",
      lines: ["your deck", "is sorted"],
      key: "sorted",
      pieces: HERO(part(0.72)),
      pose: { kind: "gesture", amount: 0.3 },
      cascade: { dx: 62, dy: 44, dz: 45, wash: [0.42, 0.22] },
    },
    {
      label: "the games",
      layout: "inverted",
      lines: ["sorted by", "shared games"],
      key: "shared",
      pieces: [{ piece: "games", width: part(1), radius: CHIP_R }],
      pose: { kind: "arrival", amount: 0.38 },
      stamp: true,
    },
    {
      label: "the playstyle",
      layout: "statement",
      lines: ["and by how", "hard you play"],
      key: "hard",
      pieces: ROLE_THEN_OVERLAP,
      pose: { kind: "gesture", amount: 0.35 },
    },
    {
      label: "the top card",
      layout: "statement",
      lines: ["and the top card", "matches yours"],
      key: "matches",
      pieces: HERO(part(1)),
      pose: { kind: "arrival", amount: 0.22 },
    },
  ],
  caption: {
    hook: "the deck is sorted, and that is the whole difference.",
    body: [
      "a channel is a list in the order people typed in it. duoqueue orders your deck by what you actually share: the games you both own, how hard you each play them, the hours you are both awake.",
      "so the card on top is the closest fit in the deck, not the person who posted most recently.",
      "18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "a channel is sorted by who typed last. a deck is sorted by what you share. swipe.",
  },
};

/**
 * =====================================================================================
 * 3. `gaming-app` - the category stated first, evidenced after
 * =====================================================================================
 *
 * The objection angle, de-risked. src/static/sheets.ts cut the objection from the sheets because
 * "the correction is a second beat and a still has none". A CAROUSEL HAS ONE: the swipe. But
 * card one is also the permanent, screenshottable thumbnail, so the fix is to put the CORRECTION
 * on card one and never name the wrong category anywhere in the set.
 *
 * The callouts are why this set exists. They are the only place in the campaign where the mono
 * voice enters the content column, and they make the platonic read STRUCTURAL rather than a line
 * of copy: two leaders land on the two halves of a chip that is actually in the picture, and
 * they name a game and a way of playing it. Screenshotted alone with no caption, this is the
 * strongest 2.3.6 asset the campaign has.
 *
 * THE STAMP IS ON CARD FOUR AND NOT ON CARD ONE, which is the correction the plan took. Card one
 * already says "a gaming app" at 118px; stamping "A GAMING APP . 18+ . PLATONIC" under it prints
 * the same three words twice on one frame. Card four is where the DUO LOCKED banner is, which is
 * the frame a reviewer's eye actually stops on, and two devices in two positions beat one device
 * doubled.
 */
const GAMING_APP: CarouselSet = {
  name: "gaming-app",
  shape: "the objection, corrected on card one and evidenced after",
  why: "the only annotated set. Two hairline leaders land inside the object and name what the app matches on, so the category is shown rather than asserted.",
  cards: [
    {
      label: "the card",
      layout: "annotated",
      lines: ["this is", "a gaming app"],
      key: "gaming",
      pieces: HERO(part(0.9)),
      pose: { kind: "arrival", amount: 0.22 },
      callouts: [
        { at: { x: 0.211, y: 0.958 }, rail: CALLOUT_RAILS[0], text: "THE GAME" },
        { at: { x: 0.503, y: 0.958 }, rail: CALLOUT_RAILS[1], text: "HOW THEY PLAY" },
      ],
    },
    {
      label: "the overlap",
      layout: "inverted",
      lines: ["it matches", "on games"],
      key: "games",
      pieces: [{ piece: "games", width: part(1), radius: CHIP_R }],
      pose: { kind: "arrival", amount: 0.38 },
    },
    {
      label: "the playstyle",
      layout: "statement",
      lines: ["the game", "and the level"],
      key: "level",
      pieces: ROLE_THEN_OVERLAP,
      pose: { kind: "gesture", amount: 0.35 },
    },
    {
      label: "the duo",
      layout: "statement",
      lines: ["someone to", "queue with"],
      key: "queue",
      pieces: [{ piece: "duo", width: part(0.5), radius: DUO_R }],
      pose: { kind: "arrival", amount: 0.3 },
      stamp: true,
    },
  ],
  caption: {
    hook: "this is a gaming app. the card tells you what they play and how they play it.",
    body: [
      "a profile in duoqueue is a library and a playstyle. rocket league, ranked grinder, three games in common with you.",
      "you pick, they pick, and then there is somebody to queue with.",
      "18 plus and platonic. it is for finding a duo, and the card is built to prove it.",
    ],
    short: "this is a gaming app. the card says what they play and how hard they play it. 18 plus, platonic.",
  },
};

/**
 * =====================================================================================
 * 4. `midnight` - the hours, with time as the device
 * =====================================================================================
 *
 * A mismatch needs two numbers, so the figure device is spent TWICE as a matched pair, and that
 * doubling is the argument. It is what separates this set from `zero`'s single figure.
 *
 * BOTH FIGURES ARE REAL. `PLAY_WINDOW_PRESETS` in apps/mobile defines "Night (9pm-1am)", and
 * 1 AM and 9 PM are its two ends: two people can both answer "Night" and still never be awake at
 * the same time, which is exactly what `play_window_overlap_hours` scores and exactly what a
 * channel cannot see.
 *
 * THIS IS THE SET WITH NO PICTURE BEHIND ITS CENTRAL CLAIM, and two bare cards is the honest
 * answer rather than a gap. src/pro/angles.ts records that shared hours has no chip in any of
 * the four recordings, so the alternative is a decorative stand-in, and a decorative stand-in
 * over a claim is the exact failure this campaign has been bitten by twice.
 *
 * It is also the brightest set of the ten, at about 217 against a family mean of 202. In a feed
 * of dark gaming content that is not a defect.
 */
const MIDNIGHT: CarouselSet = {
  name: "midnight",
  shape: "two times, as a matched pair, then the deck that closes the gap",
  why: "the only set that spends two cards on one comparison, and the only one that solves one type size across two cards so the pair reads as a pair.",
  cards: [
    {
      label: "your hours",
      layout: "figure",
      figure: "1 AM",
      lines: ["when you play"],
      key: "you",
      solve: "hours",
    },
    {
      label: "their hours",
      layout: "figure",
      figure: "9 PM",
      lines: ["when they play"],
      key: "they",
      solve: "hours",
    },
    {
      label: "the deck",
      layout: "statement",
      lines: ["people awake", "when you are"],
      key: "awake",
      pieces: HERO(part(1)),
      pose: { kind: "gesture", amount: 0.35 },
      stamp: true,
    },
  ],
  caption: {
    hook: "your friends play at nine. you play at one.",
    body: [
      "duoqueue scores the hours you are both actually online, not the box you both ticked. two people can each answer night and never once be awake together.",
      "so the deck is people who are up when you are, on the games you both own.",
      "18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "your friends play at nine. you play at one. the deck is people who are up when you are.",
  },
};

/**
 * =====================================================================================
 * 5. `opener` - the first message
 * =====================================================================================
 *
 * The friction is not finding somebody, it is saying the first thing.
 *
 * L2 ON EVERY CONTENT CARD, and no other set does that. The inversion is this set's signature:
 * the object floats in the upper field and the sentence anchors the bottom, which is the shape a
 * specimen and its caption make. It also means the campaign's largest area of raw chartreuse
 * lands in the upper third of card one, where a 150px thumbnail reads colour before type.
 *
 * ONE COPY CORRECTION MADE DURING DESIGN. The first draft said "you open with one of the games",
 * which the pixels contradict: the bubble asks about TONIGHT, not a title. src/pro/angles.ts had
 * already written the true line, and the argument is stronger for it - the opener is four words
 * because the card has already done the introducing.
 */
const OPENER: CarouselSet = {
  name: "opener",
  shape: "the friction is the first message, and it is four words",
  why: "the only set inverted on every card. Object high, sentence low, and the chartreuse button reads before any type does at thumbnail size.",
  cards: [
    {
      label: "the button",
      layout: "inverted",
      lines: ["the opener"],
      key: "opener",
      pieces: [{ piece: "send", width: part(1), radius: SEND_R }],
      pose: { kind: "arrival", amount: 0.38 },
    },
    {
      label: "the overlap",
      layout: "inverted",
      lines: ["you share", "three games"],
      key: "three",
      pieces: [{ piece: "games", width: part(1), radius: CHIP_R }],
      pose: { kind: "arrival", amount: 0.3 },
      stamp: true,
    },
    {
      label: "the message",
      layout: "inverted",
      lines: ["so ask if", "they are on"],
      key: "on",
      pieces: [{ piece: "bubble", width: part(0.62), radius: BUBBLE_R }],
      pose: { kind: "gesture", amount: 0.35 },
    },
    {
      label: "the game",
      layout: "inverted",
      lines: ["and then", "you play"],
      key: "play",
      pieces: GAMEPLAY(part(0.9)),
      pose: { kind: "arrival", amount: 0.22 },
    },
  ],
  caption: {
    hook: "finding somebody is the easy half. the opener is the hard one.",
    body: [
      "by the time the button is there you already share three games with them, so the first message does not have to do any introducing.",
      "hey you on tn. four words. then you are both in a lobby.",
      "18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "the card does the introducing, so the opener gets to be four words. hey you on tn.",
  },
};

/**
 * =====================================================================================
 * 6. `two` - it takes two
 * =====================================================================================
 *
 * Mutual consent, and it is verified rather than assumed: supabase/migrations/0003_matching.sql
 * creates a match on mutual likes.
 *
 * THE HONEST NOTE, because it belongs beside the set and not in a postmortem. A stranger assumes
 * this - every matching product on earth is mutual - so the set spends four cards on something
 * nobody doubted. Its real work is the safety signal, and `gaming-app` delivers that harder and
 * three cards earlier. It is in the ten because ten were asked for, and it is the second weakest
 * of them. See ./captions for what would go up instead.
 */
const TWO: CarouselSet = {
  name: "two",
  shape: "mutual consent, told as arithmetic",
  why: "the only set that opens on the portrait object, and the shortest route from a locked duo back to the reason it locked.",
  cards: [
    {
      label: "the lock",
      layout: "statement",
      lines: ["it takes two"],
      key: "two",
      pieces: [{ piece: "duo", width: part(0.56), radius: DUO_R }],
      pose: { kind: "arrival", amount: 0.3 },
    },
    {
      label: "the pick",
      layout: "statement",
      lines: ["you pick them", "and they pick you"],
      key: "they",
      pieces: HERO(part(1)),
      pose: { kind: "gesture", amount: 0.35 },
    },
    {
      label: "the reason",
      layout: "statement",
      lines: ["you both picked", "the same three"],
      key: "same",
      pieces: ROLE_THEN_OVERLAP,
      pose: { kind: "gesture", amount: 0.3 },
      stamp: true,
    },
  ],
  caption: {
    hook: "a duo locks when both of you picked.",
    body: [
      "duoqueue does not put anybody in your lobby. you pick them, they pick you, and only then is there a thread.",
      "the pick is on the games you both play and how hard you both play them.",
      "18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "a duo locks when both of you picked, on the same three games.",
  },
};

/**
 * =====================================================================================
 * 7. `seriously` - matched on how hard you play
 * =====================================================================================
 *
 * Skill match. `skill_match_count x 2` is a real scored term and `SKILL_LABELS` is Casual /
 * Intermediate / Competitive / Ranked Grinder, so "Ranked Grinder" on the chip is a SKILL LEVEL
 * rather than a mood, and the card two headline quotes it verbatim.
 *
 * WHAT VERIFICATION CHANGED, AND WHY. The set used to open on a SMALL card low under mid-sized
 * type, which was the only compositional idea it owned. Shrunk to 150px that card one was a grey
 * smear under two lines of 110, and it ranked last of the ten on the thumbnail test, so the idea
 * cost more than it was worth. Card one is now the shortest headline in the campaign - two
 * eight-character lines, so the fitter clamps both at 138 - over the hero card at full width.
 *
 * IT ALSO LOST A CARD. "so the top card plays like you" was `sorted` card four ("and the top
 * card matches yours") in different words, on the same fragment at the same width under the same
 * law. Two sets may share an argument; they may not share a picture of it. The set is four cards
 * now, which is the length its single piece of evidence can actually carry.
 *
 * THE HONEST NOTE. Mismatched intensity is the loudest unspoken fear in LFG and nobody in the
 * category addresses it, so the argument is genuinely good - but it is `sorted` viewed closer,
 * and its whole evidence is one chip that says two words. See ./captions.
 */
const SERIOUSLY: CarouselSet = {
  name: "seriously",
  shape: "intensity, matched rather than guessed",
  why: "the only set whose headline quotes the app's own chip word for word, and the shortest route in the ten from a question to a locked duo.",
  cards: [
    {
      label: "the player",
      layout: "statement",
      lines: ["how hard", "you play"],
      key: "hard",
      pieces: HERO(part(1)),
      pose: { kind: "arrival", amount: 0.38 },
    },
    {
      label: "the tag",
      layout: "statement",
      lines: ["ranked grinder", "is a skill level"],
      key: "skill",
      pieces: ROLE_THEN_OVERLAP,
      pose: { kind: "gesture", amount: 0.35 },
      stamp: true,
    },
    {
      label: "the duo",
      layout: "statement",
      lines: ["so the duo", "plays like you"],
      key: "plays",
      pieces: [{ piece: "duo", width: part(0.56), radius: DUO_R }],
      pose: { kind: "arrival", amount: 0.3 },
    },
  ],
  caption: {
    hook: "the worst duo is the one who wanted a different evening than you did.",
    body: [
      "ranked grinder is a field in duoqueue, next to casual, intermediate and competitive. it is scored, so the deck puts people who play at your intensity nearer the top.",
      "same games, same seriousness, and the duo you lock plays the way you do.",
      "18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "same games is half of it. the other half is how hard you both play them.",
  },
};

/**
 * =====================================================================================
 * 8. `backwards` - it ends in a game
 * =====================================================================================
 *
 * The loop told in reverse, from the payoff back to the cause. The only set whose reading order
 * runs against the product's own order, and the only one whose card one is not the app.
 *
 * THE GRAMMAR IS THE SWIPE DRIVER. Every card after the first opens with "before that", so the
 * sentence itself hands the reader down the stack and there is no card at which the argument has
 * finished.
 *
 * THE REVERSE TELLING IS THE ARGUMENT AND NOT A GIMMICK: it says the success condition is that
 * you CLOSE THE APP, which is the most disarming thing this campaign can say and the only place
 * in it that says so.
 */
const BACKWARDS: CarouselSet = {
  name: "backwards",
  shape: "the loop in reverse, from the payoff back to the cause",
  why: "the only set whose card one is not the app, and the only one whose grammar rather than whose layout does the asking.",
  cards: [
    {
      label: "the game",
      layout: "statement",
      lines: ["it ends in", "a game"],
      key: "game",
      pieces: GAMEPLAY(part(0.9)),
      pose: { kind: "arrival", amount: 0.22 },
    },
    {
      label: "the message",
      layout: "statement",
      lines: ["before that,", "four words"],
      key: "words",
      pieces: [{ piece: "bubble", width: part(0.62), radius: BUBBLE_R }],
      pose: { kind: "gesture", amount: 0.35 },
    },
    {
      label: "the match",
      layout: "statement",
      lines: ["and before that,", "three games"],
      key: "three",
      pieces: OVERLAP_THEN_ROLE,
      pose: { kind: "gesture", amount: 0.3 },
      stamp: true,
    },
  ],
  caption: {
    hook: "it ends with the app closed and a game open.",
    body: [
      "before that, four words in a thread. hey you on tn.",
      "before that, a card with three games on it you both own and a playstyle that looks like yours.",
      "that is the whole product. 18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "it ends with the app closed and a game open. everything before that is four words and a card.",
  },
};

/**
 * =====================================================================================
 * 9. `sentence` - the campaign's best line, broken across the swipe
 * =====================================================================================
 *
 * src/carousel/plan.ts says the film's opening line is the best sentence in the campaign and
 * cannot be a card, because eleven words set at the measure is three lines of 72px type, which
 * is thirteen display pixels in a feed. It put three words on card one instead and sent the
 * sentence to the caption.
 *
 * A CAROUSEL IS THE ONE FORMAT THAT CAN SPEND TWO CARDS ON ONE SENTENCE. Card one is five words
 * at 138 and it is an unfinished clause, which is the strongest swipe driver there is, because
 * the grammar does the asking rather than a cue.
 *
 * THE STRUCTURAL MOVE: cards two and five are the same picture in opposite tenses, the game you
 * remember and the next one. That rhyme costs nothing and it is the argument.
 */
const SENTENCE: CarouselSet = {
  name: "sentence",
  shape: "one sentence, broken across two cards, then the mechanism",
  why: "the only set whose card one is type alone, and the only one that draws the same picture twice on purpose, in two tenses.",
  cards: [
    {
      label: "the memory",
      layout: "plate",
      lines: ["your best", "games were"],
      key: "best",
    },
    {
      label: "the reason",
      layout: "statement",
      lines: ["the ones you", "played with", "someone else"],
      key: "someone",
      max: 107,
      pieces: GAMEPLAY(part(0.9)),
      pose: { kind: "arrival", amount: 0.22 },
    },
    {
      label: "the app",
      layout: "statement",
      lines: ["duoqueue is where", "the next one is"],
      key: "duoqueue",
      pieces: HERO(part(1)),
      pose: { kind: "gesture", amount: 0.35 },
    },
    {
      label: "the match",
      layout: "statement",
      lines: ["on the games", "you both play"],
      key: "both",
      pieces: [{ piece: "games", width: part(1), radius: CHIP_R }],
      pose: { kind: "gesture", amount: 0.3 },
      stamp: true,
    },
    {
      label: "the next one",
      layout: "statement",
      lines: ["and you", "go play it"],
      key: "play",
      pieces: GAMEPLAY(part(0.9)),
      pose: { kind: "arrival", amount: 0.3 },
    },
  ],
  caption: {
    hook: "your best games were the ones you played with someone else.",
    body: [
      "duoqueue is where you find the next one. a deck of one person at a time, ordered by the games you both own and how hard you each play them.",
      "you pick, they pick, four words in a thread, and then you are both in a lobby.",
      "18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "your best games were the ones you played with someone else. duoqueue is where the next one is.",
  },
};

/**
 * =====================================================================================
 * 10. `early` - the founding deck
 * =====================================================================================
 *
 * The density problem stated as the ask. A matching app is worth what is in it, so the honest
 * reason to join a waitlist is that everybody arrives together.
 *
 * CARD ONE IS THE PICTURE OF ITS OWN HEADLINE. The chartreuse "NO. 001" is on Kofi's card in the
 * footage already, and "be early" over a card serialised 001 is a claim standing on its own
 * evidence. It is set at the steepest pose in the campaign, GESTURE 0.45, because it is the one
 * card whose object should look like it is still being dealt.
 *
 * CARD FIVE IS BARE, and that is a pacing decision rather than a gap: it is the brightest card in
 * the set at about 229 and it puts a breath between four dark rectangles and the lockup, so the
 * ask lands after air rather than after another dark rectangle.
 *
 * RISK FLAGGED AND NOT RESOLVED HERE. This set tells a stranger the deck is small. In a waitlist
 * that is scarcity; the day after launch it is a liability. It is also the only set that promises
 * a WHEN, so it must not go up until there is a date behind "all at once". That note is in
 * ./captions where whoever schedules the post will see it.
 */
const EARLY: CarouselSet = {
  name: "early",
  shape: "the density problem, stated as the reason to be on the list",
  why: "the only set that argues for the waitlist itself rather than for the product, and the only one that puts a bare card immediately before the ask.",
  cards: [
    {
      label: "no. 001",
      layout: "statement",
      lines: ["be early"],
      key: "early",
      pieces: HERO(part(1)),
      pose: { kind: "gesture", amount: 0.45 },
    },
    {
      label: "the deck",
      layout: "cascade",
      lines: ["a deck fills", "one at a time"],
      key: "one",
      pieces: HERO(part(0.72)),
      pose: { kind: "gesture", amount: 0.18 },
      cascade: { dx: 26, dy: 22, dz: 30, wash: [0.46, 0.26] },
    },
    {
      label: "the pair",
      layout: "statement",
      lines: ["and a duo", "needs two"],
      key: "two",
      pieces: [{ piece: "duo", width: part(0.5), radius: DUO_R }],
      pose: { kind: "arrival", amount: 0.3 },
    },
    {
      label: "the match",
      layout: "statement",
      lines: ["you match on games", "and how you play"],
      key: "match",
      pieces: OVERLAP_THEN_ROLE,
      pose: { kind: "gesture", amount: 0.35 },
      stamp: true,
    },
    {
      label: "all at once",
      layout: "plate",
      lines: ["so it opens", "all at once"],
      key: "once",
    },
  ],
  caption: {
    hook: "a deck is worth exactly what is in it, so everybody goes in together.",
    body: [
      "duoqueue deals you one card at a time and a duo needs two of you, which means an app like this is worth nothing on its own and everything on the day it fills.",
      "that is what the list is for. you match on the games you both own and how hard you each play them.",
      "18 plus and platonic, for people who want somebody to queue with.",
    ],
    short: "a deck is worth what is in it, and a duo needs two. so everybody goes in together.",
  },
};

/** The ten, in the order they were designed rather than in the order they should be posted. See
 * ./captions for the posting order, which puts the two strongest thumbnails first. */
export const SETS: readonly CarouselSet[] = [
  ZERO,
  SORTED,
  GAMING_APP,
  MIDNIGHT,
  OPENER,
  TWO,
  SERIOUSLY,
  BACKWARDS,
  SENTENCE,
  EARLY,
];

/** The signature card is not in any set's `cards`, because it is not that set's card: it is the
 * campaign's, and it is byte for byte the same file ten times. Every set is its cards plus this. */
export const SIGNATURE_LABEL = "the waitlist";

export const cardCountOf = (set: CarouselSet): number => set.cards.length + 1;

export const setNamed = (name: string): CarouselSet => {
  const found = SETS.find((set) => set.name === name);
  if (!found) {
    throw new Error(`There is no carousel set called "${name}". See src/carousels/sets.ts.`);
  }
  return found;
};
