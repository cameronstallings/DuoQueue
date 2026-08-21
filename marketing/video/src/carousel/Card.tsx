/**
 * ONE CARD, DRAWN AS A FRAME OF PRO-B THAT HAPPENS TO BE 4:5.
 *
 * =====================================================================================
 * WHAT IS SHARED WITH THE FILM, LITERALLY RATHER THAN IN SPIRIT
 * =====================================================================================
 *
 * `Stage` and `Plane` from src/pro/Plane.tsx           the camera, the shadow, the sheen, the rim
 * `Fragment` from src/pro/media.tsx                    the footage, rebased and held
 * `groupSize`, `wordsOf`, `DISPLAY` from src/pro/type  the fitting law and the accent
 * `GROUND`, `INK`, `TYPE`, `MEASURE` from ./ground     which re-export src/pro/ground unchanged
 * `Grain` from src/pro/Field.tsx                       the dither that stops the sweep banding
 *
 * There is no second implementation of any of it. A change to the film's shadow is a change to
 * these six cards, which is the property the old carousel had and was the only good thing about
 * the way it was built.
 *
 * =====================================================================================
 * WHAT A STILL HAS TO ADD, AND THE ONE RULE IT BREAKS
 * =====================================================================================
 *
 * The film has no furniture at all: no page number, no label, no mark on the frame, because it has
 * eighteen seconds to establish itself and an end card to sign it. A carousel needs a reader to
 * know there is a card six, and every card in it gets screenshotted and sent on its own without
 * the account name attached. So there is a HEAD ROW and a FOOT ROW, and they hold the mark, the
 * counter, the spine label and the swipe cue.
 *
 * That furniture is the one place this set does not obey src/pro/ground's rule that everything is
 * centred, and the exception is stated rather than taken. The measurement is about CONTENT: every
 * line and every object in the reference reels is centred, and the rejected direction's left edge
 * is what made the film look assembled. Furniture is not content. It is the edge of the sheet, and
 * a running head that floats in the middle of a column is not a running head. So the four pieces
 * of it sit on the four corners at one inset, the content sits centred between them, and the two
 * systems never touch.
 *
 * THE STATEMENT IS SET BY THE FILM'S OWN FITTER AND DRAWN BY HAND. `Words` in src/pro is a
 * per-word build with a cadence, an exit, a smear and its own per-word perspective; on frame zero
 * of a still every one of those is either identity or a bug waiting to happen. So the block here
 * uses `groupSize` and `wordsOf` verbatim, at the film's tracking and the film's leading, with the
 * accent on the word the plan names, and nothing else. Same typography, none of the machinery.
 */
import { AbsoluteFill } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";
import { Grain } from "@/pro/Field";
import { Fragment } from "@/pro/media";
import { ARRIVAL, GESTURE, REST } from "@/pro/motion";
import { Plane, Stage } from "@/pro/Plane";
import { DISPLAY, groupSize, useFaces, wordsOf } from "@/pro/type";

import {
  CARD_H,
  CARD_W,
  CENTRE_X,
  CUE,
  FOOT_TOP,
  GROUND,
  INK,
  INSET,
  LABEL,
  MARK_W,
  MEASURE,
  POOL,
  STAGE_CY,
  TOP_MAX,
  TOP_MIN,
  TYPE,
  TYPE_BASE,
} from "./ground";
import { Lockup } from "./Lockup";
import {
  CARDS,
  PIECE_GAP,
  sourceOf,
  WAITLIST_LABEL,
  type CardPose,
  type CarouselCard,
  type Placed,
} from "./plan";

/** The crop's aspect is what turns a stated width into a height, so nothing is ever stretched. */
const heightOf = (piece: Placed): number => {
  const [w, h] = sourceOf(piece.piece);
  const box = piece.crop ?? { width: w, height: h };
  return Math.round((piece.width * box.height) / box.width);
};

/**
 * A pose the film actually holds, at a fraction of itself.
 *
 * `arrival` is the eight frame unwind every object in Pro-B enters on, read at `amount` of the way
 * back from square; `gesture` is the mid-beat perspective punctuation the film spends exactly
 * twice. Both sets of degrees are src/pro/motion.ts's own, so no angle in this set is an angle
 * somebody chose.
 */
const poseOf = (pose: CardPose) => {
  const a = pose.amount;
  return pose.kind === "arrival"
    ? {
        ...REST,
        rotX: ARRIVAL.rotX * a,
        rotY: ARRIVAL.rotY * a,
        rotZ: ARRIVAL.rotZ * a,
      }
    : { ...REST, rotX: GESTURE.rotX * a, rotY: GESTURE.rotY * a };
};

/**
 * The object, which may be one piece or two stacked as one.
 *
 * Two pieces share ONE pose and one top edge and one bottom edge of the group, which is what makes
 * two crops of different shapes read as a single object turning in a single camera rather than as
 * two clippings that happen to be near each other.
 */
const Objects = ({ card }: { card: CarouselCard }) => {
  const heights = card.pieces.map(heightOf);
  const total =
    heights.reduce((sum, h) => sum + h, 0) + PIECE_GAP * (card.pieces.length - 1);
  // Centred on the stage, then clamped, which is the whole vertical law for an object. See
  // STAGE_CY in ./ground for the five numbers this resolves to.
  const top = Math.min(TOP_MAX, Math.max(TOP_MIN, Math.round(STAGE_CY - total / 2)));
  const pose = poseOf(card.pose);

  let y = top;
  return (
    <Stage>
      {card.pieces.map((piece, i) => {
        const height = heights[i] ?? 0;
        const cy = y + height / 2;
        y += height + PIECE_GAP;
        return (
          <Plane
            key={piece.piece}
            name={`piece-${piece.piece}`}
            pose={pose}
            cx={CENTRE_X}
            cy={cy}
            width={piece.width}
            height={height}
            radius={piece.radius}
            // A chip cut out of a screen recording is matte; a whole card is glass. The same two
            // values Pro-B gives the same two kinds of object.
            gloss={height > 300 ? 0.26 : 0.18}
          >
            <Piece piece={piece} />
          </Plane>
        );
      })}
    </Stage>
  );
};

/**
 * The footage inside a piece, with the one sub-rectangle the set needs.
 *
 * Without a crop the element is already sized from the clip's own aspect, so the video simply
 * fills it. With one, the clip is scaled up by the ratio the crop asks for and offset so the
 * requested rectangle lands on the element: see `Crop` in ./plan for the twenty by twenty-three
 * pixels of another game's chrome this exists to remove.
 */
const Piece = ({ piece }: { piece: Placed }) => {
  const [w, h] = sourceOf(piece.piece);
  if (piece.crop === undefined) {
    return <Fragment frag={piece.piece} />;
  }
  const scale = piece.width / piece.crop.width;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: Math.round(-piece.crop.x * scale),
          top: Math.round(-piece.crop.y * scale),
          width: Math.round(w * scale),
          height: Math.round(h * scale),
        }}
      >
        <Fragment frag={piece.piece} />
      </div>
    </AbsoluteFill>
  );
};

/**
 * The headline: the film's fitter, the film's tracking, the film's leading, the film's accent, and
 * the bottom of the block on ./ground's one baseline.
 */
const Statement = ({ card }: { card: CarouselCard }) => {
  const size = groupSize(card.lines, MEASURE);
  const leading = Math.round(size * TYPE.leading);
  const rows = wordsOf(card.lines, card.key);
  const height = leading * rows.length;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: TYPE_BASE - height,
        width: "100%",
        height,
      }}
    >
      {rows.map((words, row) => (
        <div
          key={`${words.map((word) => word.text).join(" ")}-${String(row)}`}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            // 0.28em, which is src/pro/Words.tsx's measured word gap: 21/18/14px on a 54px line.
            gap: Math.round(size * 0.28),
            height: leading,
            width: "100%",
          }}
        >
          {words.map((word) => (
            <span
              key={`${word.text}-${String(word.index)}`}
              style={{
                display: "inline-block",
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: `${String(size)}px`,
                lineHeight: `${String(leading)}px`,
                letterSpacing: TYPE.tracking,
                color: word.key ? INK.accent : INK.type,
                whiteSpace: "pre",
              }}
            >
              {word.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

/** The mono voice: the counter and the spine label, and nothing else is ever set in it. */
const Furniture = ({ text, align }: { text: string; align: "left" | "right" }) => (
  <div
    style={{
      fontFamily: FONT_FAMILY.monoSemibold,
      fontSize: `${String(LABEL.size)}px`,
      lineHeight: `${String(LABEL.leading)}px`,
      letterSpacing: LABEL.tracking,
      textTransform: "uppercase",
      // The spine label is the card's title (THE DECK, THE MATCH) and the counter tells a reader
      // there are six of these, so neither is decoration a viewer can afford to miss. Dim measured
      // about 4.4:1 once actually set at this size and tracking; see the note on the URL in
      // ./Lockup. Size and tracking already keep this subordinate to the headline without also
      // spending contrast on it.
      color: INK.type,
      textAlign: align,
      whiteSpace: "pre",
    }}
  >
    {text}
  </div>
);

/** The swipe cue. The end card's button, a quarter of the size: off-black fill, raw chartreuse
 * label, the app's own full rounding. */
const Cue = () => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      height: CUE.height,
      padding: `0 ${String(CUE.pad)}px`,
      borderRadius: CUE.radius,
      backgroundColor: INK.app,
      fontFamily: FONT_FAMILY.monoSemibold,
      fontSize: `${String(LABEL.size)}px`,
      letterSpacing: LABEL.tracking,
      color: INK.brand,
      whiteSpace: "pre",
    }}
  >
    SWIPE &gt;&gt;
  </div>
);

/** One horizontal row of furniture, spanning inset to inset, with its two ends on the frame's
 * corners. Both rows are the same component so the four corners cannot drift apart. */
const Row = ({
  top,
  height,
  left,
  right,
}: {
  top: number;
  height: number;
  left: React.ReactNode;
  right: React.ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      left: INSET,
      top,
      width: CARD_W - INSET * 2,
      height,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    {left}
    {right}
  </div>
);

const counterOf = (index: number, total: number): string =>
  `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

export const Card = ({ index, cta }: { index: number; cta: Cta }) => {
  // fitText caches its measurement for the life of the page, so a size taken before the brand
  // faces land would typeset the whole set for a typeface it does not contain. The film blocks on
  // this for the same reason; a still has exactly one frame in which to get it wrong.
  const loaded = useFaces();
  const card = CARDS[index];
  const total = CARDS.length + 1;

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND.base, width: CARD_W, height: CARD_H }}>
      <AbsoluteFill style={{ backgroundImage: GROUND.sweep }} />
      <AbsoluteFill style={{ backgroundImage: POOL }} />

      {/* The head row. The lockup card carries the mark inside the lockup, so it does not get a
          second one on the same frame; it keeps the counter, because a reader still needs to see
          that this is where the set ends. */}
      <Row
        top={INSET}
        height={Math.round(MARK_W * 0.62)}
        left={card === undefined ? <div /> : <Mark width={MARK_W} tone="light" />}
        right={<Furniture text={counterOf(index, total)} align="right" />}
      />

      {card === undefined ? (
        <Lockup cta={cta} />
      ) : (
        <>
          <Statement card={card} />
          <Objects card={card} />
        </>
      )}

      <Row
        top={FOOT_TOP}
        height={CUE.height}
        left={<Furniture text={card?.label ?? WAITLIST_LABEL} align="left" />}
        right={card === undefined ? <div /> : <Cue />}
      />

      <Grain />
    </AbsoluteFill>
  );
};
