/**
 * TEN SETS, ONE TYPEFACE, ONE GROUND, ONE CAMERA, AND SIX LAYOUT LAWS.
 *
 * =====================================================================================
 * WHY THIS IS A SECOND DIRECTORY AND NOT AN EXTENSION OF src/carousel/
 * =====================================================================================
 *
 * out/_carousel/ is a live asset. Cameron is about to post it. Every number in
 * src/carousel/plan.ts was arrived at by measuring a render, and the six PNGs on disk are the
 * output of that file at a particular commit. Adding a `layout` discriminant to `CarouselCard`
 * and teaching `Card.tsx` five new laws would put the live set's pixels downstream of a
 * refactor, and the only way to prove it had not moved would be to re-render and diff it.
 *
 * So the shipped set's six files are not touched at all. This directory imports the parts of it
 * that are DATA rather than layout - the ground, the inks, the grid constants, the type baseline,
 * the furniture voice, and the `Lockup` verbatim - and implements the six laws on top of them.
 * `pnpm carousel` and `pnpm carousels` share a ground and a signature and nothing else.
 *
 * =====================================================================================
 * WHAT IS CONSTANT ACROSS ALL TEN, NO EXCEPTIONS
 * =====================================================================================
 *
 * Ten recolours of one carousel is one ad posted ten times. Ten unrelated designs is ten
 * companies, and that is the worse failure, because recognition across repeat exposures is the
 * only reason to run ten of anything. So the visual DNA is fixed and the ARGUMENT SHAPE is what
 * varies, which is how a magazine runs one typeface across a hundred layouts.
 *
 *   the ground        GROUND.base + GROUND.sweep + POOL + Grain, from src/pro/ground.ts
 *   the inks          INK.type / dim / accent / brand / app, the app's own five
 *   the type system   Manrope ExtraBold, tracking -0.022em, leading 1.06, size FITTED to the
 *                     745px measure and clamped, never chosen
 *   the fragments     src/pro/media.tsx's own table. Zero new footage, zero re-cuts
 *   the camera        Stage + Plane at perspective 1400, origin 50% 45%, with elevation() and
 *                     sheen() computed from the live pose
 *   the furniture     mark left / counter right at the head, label left / cue right at the foot,
 *                     all four on INSET 100, mono at 26/32/0.18em uppercase
 *   the frame         1080x1350
 *   the last card     ./Signature, which is src/carousel/Lockup.tsx verbatim
 *
 * A stranger seeing their third one recognises it before reading it. That is the whole test.
 *
 * =====================================================================================
 * THE SIX LAWS, AND WHAT EACH ONE IS FOR
 * =====================================================================================
 *
 * L1 STATEMENT is the shipped law and the default: the type block hangs from a fixed BOTTOM
 *    baseline at 520 and the object hangs under it, centred on 860 and clamped 600-740. It is
 *    the law for a card whose picture is the evidence for a sentence.
 *
 * L2 INVERTED puts the object high and small and the type low and large. It exists because of a
 *    measured problem rather than for variety: `games` drawn at the measure is 152px tall and
 *    `role` is 95px, and a single chip under L1 is a thin bar centred on a field of nothing.
 *    src/carousel/ground.ts solves that by never drawing one alone. This solves it the other
 *    way, by making the bar a masthead rule with the sentence as its body, which is a real
 *    editorial shape rather than a rescue. It carries a floor: the type block must be at least
 *    L2_MIN_SIZE, because the gap between the two zones only reads as air when the lower one is
 *    heavy.
 *
 * L3 FIGURE sets a display numeral and its caption as ONE optically centred group, on bare
 *    paper. It is the only law that spends the frame on a number.
 *
 * L4 CASCADE draws one piece as three planes at three depths in one shared pose. It is the only
 *    picture of POSITION this footage can make, which is why it belongs to the set whose
 *    argument is that the deck is ordered.
 *
 * L5 ANNOTATED is L1 with mono callouts on hairline leaders terminating inside the object. It is
 *    the only place in the campaign where the furniture voice enters the content column, and it
 *    is what makes the platonic read STRUCTURAL rather than a line of copy.
 *
 * L6 PLATE is type alone, optically centred, no object. A carousel is the one format that can
 *    spend a whole card on half a sentence, and an unfinished clause is the strongest swipe
 *    driver there is.
 */
import { STAMP } from "@/static/plan";

import {
  CARD_H,
  CARD_W,
  CUE,
  FOOT_TOP,
  INSET,
  LABEL,
  MARK_W,
  MEASURE,
  STAGE_CY,
  TOP_MAX,
  TOP_MIN,
  TYPE_BASE,
  part,
} from "@/carousel/ground";

export {
  CAMERA,
  CARD_H,
  CARD_W,
  CENTRE_X,
  CUE,
  FOOT_BOTTOM,
  FOOT_TOP,
  GROUND,
  INK,
  INSET,
  LABEL,
  MARK_W,
  MEASURE,
  OBJECT_MAX_W,
  POOL,
  STAGE_CY,
  TOP_MAX,
  TOP_MIN,
  TYPE,
  TYPE_BASE,
  part,
} from "@/carousel/ground";

/**
 * The bottom of the head row, which is the ceiling every law has to clear.
 *
 * `Card.tsx` gives the head row a height of round(MARK_W * 0.62), so the mark's own bottom edge
 * is here. Every law below is solved against this line rather than against the frame's top, so
 * "optically centred" means centred in the band the content actually owns.
 */
export const HEAD_BOTTOM = INSET + Math.round(MARK_W * 0.62);

/** The band between the two rows of furniture, and its middle. 140 to 1198 on a 1350 frame. */
export const BAND_MID = Math.round((HEAD_BOTTOM + FOOT_TOP) / 2);

/**
 * THE SHADOW'S LONG CAST, measured at about 74px under a flat object at these alphas.
 *
 * src/carousel/ground.ts arrives at the same number and uses it to prove its own five objects
 * clear the foot row. Here it is a named constant because six laws have to clear the same line
 * and a number repeated six times is a number that will disagree with itself once.
 */
export const CAST = 74;

/** The lowest an object's bottom edge may sit before its shadow reaches the foot row's ink. */
export const OBJECT_FLOOR = FOOT_TOP - CAST;

/**
 * =====================================================================================
 * L2 INVERTED
 * =====================================================================================
 *
 * ONE FIXED ANCHOR AND ONE DISTRIBUTED ONE, which is the only arrangement that survives both
 * failure modes.
 *
 * The mirror of L1 was tried first and it does not work, because a 4:5 frame is not symmetric
 * about its content: reflecting L1's two numbers puts a one-line block at 818 to 964 with 234px
 * of bare paper under it. The hole moves, exactly as src/carousel/ground.ts records its clamp
 * doing.
 *
 * TWO FIXED ANCHORS WERE TRIED SECOND AND RENDERED, which is how the real defect was found. With
 * the object pinned at 520 and the type at 985, the `send` bar - 143px tall, the shortest object
 * in the ten - sat with 309px of empty paper above it and 325 below, and the card read as three
 * things floating rather than as a composition. A 143px object on a 1350px frame will always
 * leave about 600px of paper; the only question is whether it is distributed or pooled.
 *
 * So: THE TYPE BLOCK'S INK IS PINNED AT 920 AND THE OBJECT IS CENTRED IN WHATEVER PAPER IS LEFT
 * ABOVE IT. The type does not jump across the swipe, which is the whole vertical law of the
 * shipped set and the reason it does not read as restless; and the paper above the type is split
 * evenly by the object rather than pooling on one side of it. Across the four cards of `opener`
 * that puts the bands at 273/274, 227/228, 213/213 and 114/114, and the tallest object's shadow
 * still clears the type block by 40px.
 *
 * L2_MIN_SIZE is the floor that keeps the law honest. Under it the lower zone stops outweighing
 * the upper one and the card reads as a caption stranded under a clipping.
 */
export const TYPE_MID_INV = 920;
export const L2_MIN_SIZE = 109;

/**
 * =====================================================================================
 * L3 FIGURE
 * =====================================================================================
 *
 * A display numeral and its caption, set as ONE group and optically centred in the band.
 *
 * FIGURE_MAX is not TYPE.max. The 138px clamp exists so a one-word clause cannot fill the frame
 * edge to edge, and it binds at ten characters or fewer, which is every figure this law sets. A
 * figure is not a short headline; it is the picture on the card, and the whole reason to spend a
 * card on a number is that the number is the size of an object. 412 is 38% of the frame width and
 * its cap lands at 297px, which is what survives a 150px thumbnail.
 *
 * FIGURE_GAP is a fraction of the figure rather than a constant, so a 412px "4" and a 310px
 * "1 AM" hold the same relationship to their caption instead of the same pixel count.
 */
export const FIGURE_MAX = 412;
export const FIGURE_GAP = 0.1;

/**
 * =====================================================================================
 * OPTICAL CENTRING, AND WHY IT IS ARITHMETIC RATHER THAN A NUDGE
 * =====================================================================================
 *
 * Two of the six laws centre a block of type in a band, and a block of type is not its own line
 * boxes. Read off Manrope ExtraBold's own tables - upem 2000, hhea ascender 2132 and descender
 * -600, OS/2 capHeight 1440 and xHeight 1080 - the face's content height is 1.366em against a
 * leading of 1.06em, so every line box in this campaign clips its own face at both ends by about
 * 15%. The ink inside a box therefore does not sit where the box does.
 *
 * Worked for the group on `four` card one, a 412px numeral over a 138px caption: the box is 624
 * tall, the numeral's cap starts 80px inside its top, and the caption's descender hangs 8px past
 * its bottom, so the ink's centre is 44px BELOW the box's. Centring the box put the ink 44 low,
 * and the rendered card measured 73 low, because the first version also carried a 33px
 * "descender correction" pointing the wrong way. Both are gone. The offset is computed from the
 * metrics, and a figure card and a plate card get the same treatment without either of them
 * carrying a number somebody tuned by eye.
 *
 * `tail` is the depth a lowercase g, y or p actually reaches rather than the face's full 0.300
 * descender, because no headline in the ten ends on a glyph that uses all of it. Measured off the
 * rendered "strangers": 26px on a 138px line, which is 0.19em, rounded up.
 */
export const FACE = { ascender: 1.066, descender: 0.3, cap: 0.72, tail: 0.2 } as const;

/** The first baseline inside a line box, as an offset from the box's top. A negative half-leading
 * is normal at this leading and is the clipping described above. */
export const baselineIn = (size: number, leading: number): number =>
  (leading - size * (FACE.ascender + FACE.descender)) / 2 + size * FACE.ascender;

/** One run of lines set at one size: what it contributes to the box, and where its ink is. */
export interface Run {
  size: number;
  leading: number;
  count: number;
  /** Paper under this run before the next one starts. */
  gap?: number;
}

/**
 * The top edge to give a stack of runs so that its INK centres on `centre`.
 *
 * The box is the sum of the runs and their gaps; the ink runs from the first run's cap down to
 * the last run's tail. It returns a top rather than an offset so that no caller has to know
 * either of those two facts.
 */
export const centredTop = (runs: readonly Run[], centre: number): number => {
  let box = 0;
  let inkTop = 0;
  let inkBottom = 0;
  runs.forEach((run, index) => {
    const first = baselineIn(run.size, run.leading);
    if (index === 0) {
      inkTop = box + first - run.size * FACE.cap;
    }
    inkBottom = box + (run.count - 1) * run.leading + first + run.size * FACE.tail;
    box += run.count * run.leading + (run.gap ?? 0);
  });
  const lift = (inkTop + inkBottom) / 2 - box / 2;
  return Math.round(centre - box / 2 - lift);
};

/**
 * =====================================================================================
 * L4 CASCADE
 * =====================================================================================
 *
 * Three planes of one piece, at three depths, in ONE pose.
 *
 * The pose is shared and its rotZ is zero, per the wedge finding in src/static/plan.ts: three
 * objects at three rotations read as a spill, and three objects at one rotation and three depths
 * read as a stack. Depth is carried by translateZ inside the film's own 1400px perspective, so
 * the rear planes are genuinely smaller and genuinely offset rather than scaled by hand.
 *
 * WASH is the film's own recede, in the direction src/pro/ground.ts's header states it: on paper
 * distance lightens an object toward PAPER rather than darkening it toward a field. Each rear
 * plane carries a scrim of the ground's own colour at its own alpha, and the same alpha is
 * handed to `Plane` as `veil` so the shadow and the rim recede with the face instead of
 * surviving it.
 *
 * The two sets that use this law do not share its numbers. `sorted` fans the stack out, because
 * its argument is that the deck is ORDERED and an order has to be visible as separation.
 * `early` stacks it nearly square with almost no fan, because its argument is that a deck FILLS,
 * and a pile that has just started is a pile rather than a spread hand.
 */
export interface Cascade {
  /** Horizontal step between adjacent planes, front plane at zero. */
  dx: number;
  /**
   * Vertical step, and the REAR planes are the ones it lifts. That direction was found by
   * rendering the other one: `card` is cropped to stop just under the playstyle chip, so a stack
   * that exposes the rear planes' BOTTOMS prints "ROCKET LEAGUE . Ranked Grinder" three times in
   * a column, and a deck of three identical cards is not a deck. Exposing their TOPS shows plain
   * photograph and the app's own overflow control, which is what the top of a card sitting under
   * another card actually looks like.
   */
  dy: number;
  /** Depth step in the stage's own perspective. */
  dz: number;
  /** How far each plane behind the front one is washed toward the paper, back to front. */
  wash: readonly [number, number];
}

/**
 * =====================================================================================
 * L5 ANNOTATED
 * =====================================================================================
 *
 * Mono callouts on hairline leaders, terminating on a named point INSIDE the object.
 *
 * The target is stated as a fraction of the piece's own source rectangle, so the leader follows
 * the piece if it is ever re-drawn at another width. `card` is 1032x660 and its playstyle chip
 * runs x 60-694, y 558-645: "ROCKET LEAGUE" centres at 0.211 of the width and "Ranked Grinder"
 * at 0.503, both at 0.913 of the height.
 *
 * TWO THINGS THIS LAW COSTS, AND BOTH ARE PAID DELIBERATELY.
 *
 * The pose has to be gentle. A leader that lands 20px off its chip is a leader pointing at a
 * photograph, and a 671px plane at GESTURE 0.35 moves a point near its bottom edge by about
 * that. The annotated card is set at ARRIVAL 0.22, the shallowest pose the shipped set spends,
 * where the projected drift is a few pixels and the chip is 55px tall.
 *
 * The labels have to be short. IBM Plex Mono advances 0.6em and the furniture adds 0.18em of
 * tracking, so a character is 20.28px at 26. The two callouts are 8 and 13 characters, which is
 * 162 and 264px, and they are staggered on two rails so the wider one clears the narrower one's
 * leader by 115px rather than by luck.
 */
export interface Callout {
  /** What the leader points at, as a fraction of the piece's own source rectangle. */
  at: { x: number; y: number };
  /** The rail the label sits on, as an absolute y on the frame. */
  rail: number;
  text: string;
}

/** The two rails, far enough apart that a label on one clears the other's ink by 28px. */
export const CALLOUT_RAILS = [1042, 1102] as const;

/** The leader's own weight. One pixel of INK.dim is a hairline at this scale; two is a rule. */
export const LEADER_W = 1;

/** Air between the leader's foot and the top of the label's line box. */
export const LEADER_GAP = 8;

/**
 * =====================================================================================
 * L5's OWN TWO ANCHORS, AND THEY ARE THE ONLY NUMBERS IN THE SIX LAWS THAT ARE NOT L1's
 * =====================================================================================
 *
 * An annotation needs paper UNDER the object, and L1 has none: `card` at the measure centres on
 * 860 and ends at 1098, which leaves 100px before the foot row, and two mono rails need 160.
 * Raising the object inside L1 instead would close the band between the type and the picture to
 * 26px against a measured 84-180.
 *
 * So the whole composition moves up by fifty. `card` at 671 then runs 571 to 1000, the band above
 * it is 101, the two rails are at 1036 and 1096, and the lower label's ink stops 70px clear of
 * the foot row. Every other proportion in the card is L1's. They live here rather than beside the
 * component so `pnpm validate` can check the clearances without rendering anything.
 */
export const ANNOTATED_TYPE_BASE = 470;
export const ANNOTATED_CY = 785;

/**
 * =====================================================================================
 * THE PLATONIC STAMP
 * =====================================================================================
 *
 * src/static/plan.ts's own string, in the foot-left slot, in place of the spine label.
 *
 * It is the sheet's stamp rather than a second one, and the separators are the one thing that
 * changed. The sheet sets it alone on its own line and can afford "A GAMING APP  .  18+  .
 * PLATONIC" at two spaces a side; this row is 880px wide and already carries a 214px cue, and at
 * 20.28px a character the wide version is 664px, which leaves 2px of air. Collapsed to single
 * spaces it is 583px and clears the cue by 83.
 *
 * WHY IT IS IN THE FOOT-LEFT SLOT AND NOT ADDED SOMEWHERE. DuoQueue was rejected once under
 * guideline 2.3.6 and a carousel of profile cards is the exact shape a reviewer pattern-matches
 * to dating. The answer is an existing voice at an existing size in an existing slot, so the
 * card gains a fact and not a badge. Every set has at least one, and the position moves: cards
 * 1, 2, 3 and 4 of sets of four, five and six.
 */
export const CAROUSEL_STAMP = STAMP.replace(/\s+/g, " ");

/**
 * =====================================================================================
 * THE MEASURED LUMA BANDS, WHICH ARE NOT THE FILM'S AND ARE NOT ONE BAND
 * =====================================================================================
 *
 * Measured off the six shipped PNGs with signalstats YAVG, one frame each: 01-the-deck 198.0,
 * 02-the-match 196.5, 03-the-duo 200.0, 04-the-thread 206.4, 05-the-game 197.6, 06-the-waitlist
 * 211.2. Mean 201.6.
 *
 * THE FILM'S 229 TO 232 IS THE NUMBER FOR A CARD WITH THE PRODUCT DELETED OFF IT. A film averages
 * hundreds of frames of which most carry no object; a card carries its object in the only frame
 * it has. Derived from card one - a 745px `card` is 24.3% of the frame at an interior of about
 * 100 - a 4:5 card with nothing on it but a headline measures about 229.5. Matching that number
 * on a card is the instruction to take the app off it.
 *
 * THERE ARE TWO BANDS BECAUSE THE TEN CONTAIN A KIND OF CARD THE SHIPPED SIX DO NOT: five of them
 * are bare paper and type, which no card in out/_carousel/ is. Measured across the forty-nine:
 *
 *   object-bearing   193.3 to 215.5   (darkest: `sentence` 02, the gameplay plate under a three
 *                                      line block. Brightest: `opener` 01, a 143px chartreuse bar
 *                                      under one line)
 *   bare paper       210.8 to 217.7   which sits between the campaign's own two type-only stills,
 *                                      reel-pain-cover at 213.6 and reel-objection-cover at 222.9
 *   the signature    211.3            one file, ten times
 *
 * The bands below are those ranges with about three points of slack at each end, which is the
 * width at which the gate does what it is for and nothing else. It exists because a batch of this
 * campaign once came back at 19, and because card five of the shipped set once rendered at 181.7:
 * a floor of 190 catches both. It does not exist to argue about three points, which is a
 * difference no eye has ever seen on warm paper.
 */
export const LUMA_BAND = {
  object: { floor: 190, ceiling: 220 },
  bare: { floor: 205, ceiling: 226 },
} as const;

/** The shipped set, printed beside a measurement so "match the family" is a number a run prints
 * rather than a sentence somebody remembers wrong. */
export const SHIPPED_LUMA = { min: 196.5, max: 211.2, mean: 201.6 } as const;

/** Re-exported for the plan and the validator, which both reason about the L1 geometry. */
export const L1 = { typeBase: TYPE_BASE, stageCy: STAGE_CY, topMin: TOP_MIN, topMax: TOP_MAX };

/** The measure, and a fraction of it, so a width in a set reads as a decision. */
export const widthOf = part;

/** The frame, for the validator, which cannot import a component. */
export const FRAME = { w: CARD_W, h: CARD_H, cue: CUE, label: LABEL, measure: MEASURE } as const;
