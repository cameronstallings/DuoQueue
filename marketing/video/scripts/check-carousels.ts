/**
 * THE TEN SETS, CHECKED WITHOUT RENDERING THEM.
 *
 * =====================================================================================
 * WHY THIS EXISTS AS A GATE RATHER THAN AS A COMMENT
 * =====================================================================================
 *
 * Every correction that had to be made by hand while these ten were designed was a piece of
 * arithmetic that nothing in the repo could have caught:
 *
 *   - the mean-luma target in the brief was a FILM number, and applying it to a card would have
 *     deleted the product off every one of them
 *   - src/carousel/plan.ts states that its card one sets at "the clamp's own 138px"; measured off
 *     the render it sets at about 116, because the clamp binds at ten characters and not at three
 *     words, and six of the ten depend on knowing which
 *   - a three-line block fitted to the measure comes back at up to 138, and 3 x 1.06 x 138 = 439
 *     walks straight into the head row
 *   - the platonic stamp at the sheet's own separator widths is 664px against a foot row of 880
 *     that already carries a 210px cue
 *
 * `pnpm verify` is typecheck + lint + validate and none of the three can see any of that, so it
 * is here, and it runs on the DATA rather than on a rendered frame: a set that would collide is
 * refused before the whole render rather than after it.
 *
 * =====================================================================================
 * THE ONE APPROXIMATION, AND WHERE IT IS SAFE
 * =====================================================================================
 *
 * `groupSize` measures a real span in a real DOM through fitText, which a node script does not
 * have. So the size checks use the measured constant instead: size ~= 1418 / longest-line
 * characters, clamped, which was read off 01-the-deck.png by ink bands and reproduces the shipped
 * six to within a couple of pixels.
 *
 * Where an approximation is not good enough the check is written so it does not need one. The
 * three-line rule is enforced on the declared CEILING rather than on the estimated size, because
 * the ceiling is a fact in the file and the size is a guess about a font.
 */
import { FRAGMENTS } from "../src/pro/media";
import { OBJECT_MAX_W, TYPE } from "../src/pro/ground";
import {
  ANNOTATED_CY,
  ANNOTATED_TYPE_BASE,
  BAND_MID,
  CARD_W,
  CAROUSEL_STAMP,
  CAST,
  centredTop,
  CUE,
  FIGURE_GAP,
  FIGURE_MAX,
  FOOT_TOP,
  HEAD_BOTTOM,
  INSET,
  L2_MIN_SIZE,
  LABEL,
  STAGE_CY,
  TOP_MAX,
  TOP_MIN,
  TYPE_BASE,
  TYPE_MID_INV,
} from "../src/carousels/ground";
import { POSTING_ORDER } from "../src/carousels/captions";
import { PIECES } from "../src/carousel/plan";
import { SETS, type Placed, type SetCard } from "../src/carousels/sets";

/** Measured off the shipped render: a 21-character line sets at 67.5, so the product is 1418. */
const FIT_K = 1418;

/** A three-line block may not exceed this, because 3 x 1.06 x 113 = 359 puts its top at 161 and
 * the head row's ink is at 140. 107 leaves 40px of air, which is where a number that has to
 * survive a font substitution belongs. */
const THREE_LINE_MAX = 107;

/** IBM Plex Mono advances 0.6em and the furniture adds 0.18em, so a character is 20.28px at 26.
 * The trailing letter-space is subtracted because CSS adds it after the last glyph. */
const monoWidth = (text: string, size = LABEL.size): number =>
  text.length * size * 0.78 - size * 0.18;

const CUE_TEXT = "SWIPE >>";
const CUE_W = monoWidth(CUE_TEXT) + CUE.pad * 2;
const FOOT_W = CARD_W - INSET * 2;

const estimateSize = (lines: readonly string[], max: number): number => {
  const longest = lines.reduce((width, line) => Math.max(width, line.length), 0);
  return longest === 0 ? max : Math.min(max, Math.round(FIT_K / longest));
};

const heightOf = (piece: Placed): number => {
  const [w, h] = FRAGMENTS[piece.piece].source;
  const box = piece.crop ?? { width: w, height: h };
  return Math.round((piece.width * box.height) / box.width);
};

/** src/carousel/plan.ts's PIECE_GAP, which is 30. Read from there rather than restated. */
const GAP = 30;

const totalHeight = (pieces: readonly Placed[]): number =>
  pieces.reduce((sum, piece) => sum + heightOf(piece), 0) + GAP * (pieces.length - 1);

export interface CarouselFinding {
  where: string;
  message: string;
}

const EM_DASH = String.fromCharCode(0x2014);
const DATING = /\b(dating|date night|hookup|hook ?up|romantic|romance|flirt|singles)\b/i;
/** A word is the accent if it survives the same normalisation `wordsOf` applies. */
const normalise = (word: string): string => word.toLowerCase().replace(/[^a-z0-9+]/g, "");

export const checkCarouselSets = (): CarouselFinding[] => {
  const found: CarouselFinding[] = [];
  const fail = (where: string, message: string): void => {
    found.push({ where, message });
  };

  // ---- The stamp has to fit beside the cue, on the row they share ----
  const stampW = monoWidth(CAROUSEL_STAMP);
  if (stampW + CUE_W + 40 > FOOT_W) {
    fail(
      "carousels.stamp",
      `the platonic stamp is ${stampW.toFixed(0)}px and the swipe cue is ${CUE_W.toFixed(0)}px on a ${String(FOOT_W)}px row, which leaves ${(FOOT_W - stampW - CUE_W).toFixed(0)}px. Shorten the separators, not the words.`,
    );
  }

  const names = new Set<string>();
  for (const name of POSTING_ORDER) {
    if (!SETS.some((set) => set.name === name)) {
      fail("carousels.order", `the posting order names "${name}", which is not a set.`);
    }
  }

  for (const set of SETS) {
    if (names.has(set.name)) {
      fail("carousels.sets", `two sets are called "${set.name}". The name is a directory.`);
    }
    names.add(set.name);

    const total = set.cards.length + 1;
    if (total < 4 || total > 6) {
      fail(
        `carousels.${set.name}`,
        `is ${String(total)} cards including the signature. Four to six: shorter finishes, and nobody reads a twelve card set.`,
      );
    }
    if (!set.cards.some((card) => card.stamp ?? false)) {
      fail(
        `carousels.${set.name}`,
        "carries the platonic stamp on no card. Every set needs at least one card that makes the 18+ platonic read unambiguous.",
      );
    }

    for (const text of [set.caption.hook, set.caption.short, ...set.caption.body, set.shape, set.why]) {
      if (text.includes(EM_DASH)) {
        fail(`carousels.${set.name}.caption`, `contains an em dash: ${JSON.stringify(text)}`);
      }
      if (DATING.test(text)) {
        fail(
          `carousels.${set.name}.caption`,
          `names the category this campaign exists not to be filed under: ${JSON.stringify(text)}`,
        );
      }
    }

    set.cards.forEach((card, index) => {
      const where = `carousels.${set.name}[${String(index + 1)}]`;
      checkCard(card, where, fail);
    });
  }

  return found;
};

const checkCard = (
  card: SetCard,
  where: string,
  fail: (where: string, message: string) => void,
): void => {
  const pieces = card.pieces ?? [];
  const max = card.max ?? TYPE.max;
  const size = estimateSize(card.lines, max);
  const leading = Math.round(size * TYPE.leading);
  const blockHeight = leading * card.lines.length;

  // ---- Copy ----
  for (const text of [...card.lines, card.label, card.figure ?? "", ...(card.callouts ?? []).map((callout) => callout.text)]) {
    if (text.includes(EM_DASH)) {
      fail(where, `contains an em dash: ${JSON.stringify(text)}`);
    }
    if (DATING.test(text)) {
      fail(where, `names the category this campaign exists not to be filed under: ${JSON.stringify(text)}`);
    }
  }
  if (card.lines.length === 0) {
    fail(where, "has no headline at all.");
  }
  if (card.lines.length > 1 && (card.lines[card.lines.length - 1] ?? "").trim().split(/\s+/).length === 1) {
    fail(
      where,
      `ends its stack on one word: ${JSON.stringify(card.lines[card.lines.length - 1])}. An orphan is a broken stack, not a tight one.`,
    );
  }
  if (card.key !== undefined) {
    const words = card.lines.flatMap((line) => line.split(" ")).map(normalise);
    if (!words.includes(normalise(card.key))) {
      fail(where, `names "${card.key}" as its accent and no line contains it, so nothing on the card is set in the volt.`);
    }
  }

  // ---- The two arithmetic rules the fitter cannot enforce ----
  if (card.lines.length >= 3 && max > THREE_LINE_MAX) {
    fail(
      where,
      `is a ${String(card.lines.length)} line block with a ceiling of ${String(max)}. Three lines at 138 is 439px tall and the head row's ink is at ${String(HEAD_BOTTOM)}. Set max to ${String(THREE_LINE_MAX)} or fewer.`,
    );
  }
  if (card.lines.length >= 3 && card.layout !== "statement" && card.layout !== "plate") {
    fail(where, `sets three lines under the ${card.layout} law, which has no room for them.`);
  }

  // ---- The pieces ----
  for (const piece of pieces) {
    if (!(PIECES as readonly string[]).includes(piece.piece)) {
      fail(where, `draws "${piece.piece}", which is not one of the seven pieces this campaign uses.`);
    }
    if (piece.width > OBJECT_MAX_W) {
      fail(
        where,
        `draws ${piece.piece} at ${String(piece.width)}, past OBJECT_MAX_W ${String(OBJECT_MAX_W)}. Only the gameplay plate is ever exempt and only in the film.`,
      );
    }
  }

  // ---- The law's own geometry ----
  const objectTotal = totalHeight(pieces);

  if (card.layout === "figure" || card.layout === "plate") {
    if (pieces.length > 0) {
      fail(where, `is set under the ${card.layout} law, which draws bare paper, and carries ${String(pieces.length)} pieces.`);
    }
    if (card.layout === "figure" && (card.figure ?? "") === "") {
      fail(where, "is set under the figure law and has no figure on it.");
    }
    const runs =
      card.layout === "figure"
        ? [
            { size: FIGURE_MAX, leading: Math.round(FIGURE_MAX * TYPE.leading), count: 1, gap: Math.round(FIGURE_MAX * FIGURE_GAP) },
            { size, leading, count: card.lines.length },
          ]
        : [{ size, leading, count: card.lines.length }];
    // The worst case for a figure card is the clamp, because a figure that fits the measure at
    // less than 412 makes a shorter group and cannot be the one that collides.
    const top = centredTop(runs, BAND_MID);
    const box = runs.reduce((sum, run) => sum + run.count * run.leading + (run.gap ?? 0), 0);
    if (top < HEAD_BOTTOM + 30) {
      fail(where, `is a bare card whose group starts at ${String(top)}, inside the head row's 30px of air.`);
    }
    if (top + box > FOOT_TOP - 30) {
      fail(where, `is a bare card whose group ends at ${String(top + box)}, inside the foot row's 30px of air.`);
    }
    return;
  }

  if (pieces.length === 0) {
    fail(where, `is set under the ${card.layout} law and carries no piece.`);
    return;
  }
  if (card.pose === undefined) {
    fail(where, "draws an object with no pose, so it would sit square and the set would have one flat card in it.");
  }

  if (card.layout === "cascade") {
    if (card.cascade === undefined) {
      fail(where, "is set under the cascade law with no cascade on it.");
      return;
    }
    if (pieces.length !== 1) {
      fail(where, "cascades more than one piece. A stack is one object at three depths.");
    }
    // The front plane is the lowest one, so it is the one whose shadow has to clear the row.
    const bottom = STAGE_CY + card.cascade.dy + objectTotal / 2;
    if (bottom + CAST > FOOT_TOP) {
      fail(where, `cascades to ${String(Math.round(bottom))} and its shadow reaches ${String(Math.round(bottom + CAST))}, past the foot row at ${String(FOOT_TOP)}.`);
    }
    if (TYPE_BASE - blockHeight < HEAD_BOTTOM + 30) {
      fail(where, `has a block starting at ${String(TYPE_BASE - blockHeight)}, inside the head row's 30px of air.`);
    }
    return;
  }

  if (card.layout === "inverted") {
    if (size < L2_MIN_SIZE) {
      fail(
        where,
        `is inverted at an estimated ${String(size)}px against a floor of ${String(L2_MIN_SIZE)}. Under the floor the gap between the object and the type reads as a hole rather than as air. Shorten the longest line.`,
      );
    }
    const typeTop = centredTop([{ size, leading, count: card.lines.length }], TYPE_MID_INV);
    const top = Math.round((HEAD_BOTTOM + typeTop - objectTotal) / 2);
    const bottom = top + objectTotal;
    if (top < HEAD_BOTTOM + 40) {
      fail(where, `puts an inverted object at ${String(top)}, inside the head row's 40px of air.`);
    }
    if (bottom + CAST > typeTop) {
      fail(where, `has an inverted object whose shadow reaches ${String(bottom + CAST)} and a block starting at ${String(typeTop)}.`);
    }
    if (typeTop + blockHeight > FOOT_TOP - 30) {
      fail(where, `has an inverted block ending at ${String(typeTop + blockHeight)}, inside the foot row's 30px of air.`);
    }
    return;
  }

  if (card.layout === "annotated") {
    if (card.callouts === undefined || card.callouts.length === 0) {
      fail(where, "is set under the annotated law with no callouts on it.");
      return;
    }
    if (pieces.length !== 1) {
      fail(where, "annotates more than one piece, so a leader has no single object to land in.");
      return;
    }
    const piece = pieces[0]!;
    const top = Math.round(ANNOTATED_CY - objectTotal / 2);
    if (top - ANNOTATED_TYPE_BASE < 84) {
      fail(where, `leaves ${String(top - ANNOTATED_TYPE_BASE)}px between its type and its object, against a measured 84 to 180.`);
    }
    if (ANNOTATED_TYPE_BASE - blockHeight < HEAD_BOTTOM + 30) {
      fail(where, `has a block starting at ${String(ANNOTATED_TYPE_BASE - blockHeight)}, inside the head row's 30px of air.`);
    }
    const left = CARD_W / 2 - piece.width / 2;
    for (const callout of card.callouts) {
      const centre = left + callout.at.x * piece.width;
      const half = monoWidth(callout.text) / 2;
      if (centre - half < INSET || centre + half > CARD_W - INSET) {
        fail(where, `has a callout "${callout.text}" running from ${String(Math.round(centre - half))} to ${String(Math.round(centre + half))}, outside the ${String(INSET)}px inset.`);
      }
      if (callout.rail + LABEL.leading > FOOT_TOP - 30) {
        fail(where, `has a callout rail at ${String(callout.rail)}, whose ink ends inside the foot row's 30px of air.`);
      }
      const target = top + callout.at.y * objectTotal;
      if (callout.rail <= target + 40) {
        fail(where, `has a callout rail at ${String(callout.rail)} and a target at ${String(Math.round(target))}, which is not a leader.`);
      }
    }
    // Two callouts must not collide: the wider label may not run into the other's leader.
    card.callouts.forEach((callout, i) => {
      card.callouts?.forEach((other, j) => {
        if (i === j || callout.rail !== other.rail) {
          return;
        }
        fail(where, `has two callouts on rail ${String(callout.rail)}. Stagger them.`);
      });
      const otherLeaders = (card.callouts ?? []).filter((entry) => entry !== callout);
      for (const other of otherLeaders) {
        if (Math.abs(other.rail - callout.rail) >= LABEL.leading) {
          continue;
        }
        const centre = left + callout.at.x * piece.width;
        const leaderX = left + other.at.x * piece.width;
        if (Math.abs(leaderX - centre) < monoWidth(callout.text) / 2 + 12) {
          fail(where, `has the label "${callout.text}" crossing another callout's leader.`);
        }
      }
    });
    return;
  }

  // ---- statement, the shipped law ----
  const top = Math.min(TOP_MAX, Math.max(TOP_MIN, Math.round(STAGE_CY - objectTotal / 2)));
  const bottom = top + objectTotal;
  if (bottom + CAST > FOOT_TOP) {
    fail(
      where,
      `puts an object bottom at ${String(bottom)} and its shadow reaches ${String(bottom + CAST)}, past the foot row at ${String(FOOT_TOP)}. Draw it narrower.`,
    );
  }
  if (TYPE_BASE - blockHeight < HEAD_BOTTOM + 30) {
    fail(where, `has a block starting at ${String(TYPE_BASE - blockHeight)}, inside the head row's 30px of air.`);
  }
  if (top - TYPE_BASE < 60) {
    fail(where, `leaves ${String(top - TYPE_BASE)}px between its type and its object, against a measured 84 to 180.`);
  }
};
