/**
 * ONE CARD OF ONE SET, DRAWN AS A FRAME OF PRO-B THAT HAPPENS TO BE 4:5.
 *
 * =====================================================================================
 * WHAT IS SHARED, LITERALLY RATHER THAN IN SPIRIT
 * =====================================================================================
 *
 * `Stage` and `Plane` from src/pro/Plane.tsx           the camera, the shadow, the sheen, the rim
 * `Fragment` from src/pro/media.tsx                    the footage, rebased and held
 * `groupSize`, `wordsOf`, `DISPLAY` from src/pro/type  the fitting law and the accent
 * `Grain` from src/pro/Field.tsx                       the dither that stops the sweep banding
 * `Lockup` from src/carousel/Lockup.tsx                the signature card, unmodified
 * everything in ./ground                               re-exported from src/carousel/ground.ts
 *
 * There is no second implementation of any of it, and nothing under src/carousel/ is edited: a
 * change to the film's shadow moves the shipped six and these forty-nine together, and a change
 * to this file moves none of the shipped six.
 *
 * =====================================================================================
 * THE SIGNATURE CARD, AND WHY IT LOSES THE COUNTER
 * =====================================================================================
 *
 * The last card is the same in all ten and the brief is literal about it: byte identical. The
 * only thing on it that could vary is the counter, because the ten sets are four, five and six
 * cards long, and "04 / 04" against "06 / 06" is a different file.
 *
 * So the signature card carries no counter, and that is a better card rather than a concession.
 * A counter's job is to tell a reader that reaching the end is a finite thing to do, and a reader
 * looking at the lockup has reached it. What is left is the mark, the wordmark, the ask on its
 * off-black slab, the url, and the one mono word in the corner: the campaign's signature, which
 * is one image the account posts ten times, not ten images that look alike.
 *
 * It also means the file can be PROVED identical, which is what the report does: ten sha256s of
 * the last PNG in ten directories, and they are one hash.
 */
import { AbsoluteFill } from "remotion";

import { Lockup } from "@/carousel/Lockup";
import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";
import { Grain } from "@/pro/Field";
import { PAPER } from "@/pro/ground";
import { Fragment } from "@/pro/media";
import { ARRIVAL, GESTURE, REST } from "@/pro/motion";
import { Plane, Stage } from "@/pro/Plane";
import { DISPLAY, groupSize, useFaces, wordsOf } from "@/pro/type";

import { PIECE_GAP, sourceOf, type CardPose } from "@/carousel/plan";

import {
  ANNOTATED_CY,
  ANNOTATED_TYPE_BASE,
  BAND_MID,
  CARD_H,
  CARD_W,
  CAROUSEL_STAMP,
  CENTRE_X,
  centredTop,
  CUE,
  FIGURE_GAP,
  FIGURE_MAX,
  FOOT_TOP,
  GROUND,
  HEAD_BOTTOM,
  INK,
  INSET,
  LABEL,
  LEADER_GAP,
  LEADER_W,
  MARK_W,
  MEASURE,
  POOL,
  STAGE_CY,
  TOP_MAX,
  TOP_MIN,
  TYPE,
  TYPE_BASE,
  TYPE_MID_INV,
} from "./ground";
import { setNamed, SIGNATURE_LABEL, type CarouselSet, type Placed, type SetCard } from "./sets";

/** The crop's aspect is what turns a stated width into a height, so nothing is ever stretched. */
const heightOf = (piece: Placed): number => {
  const [w, h] = sourceOf(piece.piece);
  const box = piece.crop ?? { width: w, height: h };
  return Math.round((piece.width * box.height) / box.width);
};

const totalHeight = (pieces: readonly Placed[]): number =>
  pieces.reduce((sum, piece) => sum + heightOf(piece), 0) + PIECE_GAP * (pieces.length - 1);

/**
 * A pose the film actually holds, at a fraction of itself. src/pro/motion.ts's own degrees, so
 * no angle in the ten is an angle somebody chose.
 *
 * `flat` drops the rotZ, which is the wedge finding in src/static/plan.ts: three objects at three
 * rotations read as a spill and three at one rotation read as a stack. Every multi-plane object
 * in the ten is posed flat.
 */
const poseOf = (pose: CardPose, flat = false) => {
  const a = pose.amount;
  return pose.kind === "arrival"
    ? {
        ...REST,
        rotX: ARRIVAL.rotX * a,
        rotY: ARRIVAL.rotY * a,
        rotZ: flat ? 0 : ARRIVAL.rotZ * a,
      }
    : { ...REST, rotX: GESTURE.rotX * a, rotY: GESTURE.rotY * a };
};

/**
 * The footage inside a piece, with the sub-rectangle a piece may ask for.
 *
 * Without a crop the element is already sized from the clip's own aspect, so the video simply
 * fills it. With one, the clip is scaled up by the ratio the crop asks for and offset so the
 * requested rectangle lands on the element. See `Crop` in src/carousel/plan.ts.
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

/** The recede, in the direction src/pro/ground.ts states it: on paper, distance washes an object
 * TOWARD the ground rather than away from it. Ordinary atmospheric perspective, and the same
 * scrim every recede in the three films draws. */
const Wash = ({ amount }: { amount: number }) =>
  amount <= 0 ? null : (
    <AbsoluteFill
      style={{ backgroundColor: `rgba(${PAPER},${amount.toFixed(3)})`, pointerEvents: "none" }}
    />
  );

/** A chip cut out of a screen recording is matte; a whole card is glass. The two values Pro-B
 * gives the same two kinds of object. */
const glossFor = (height: number): number => (height > 300 ? 0.26 : 0.18);

/**
 * The object: one piece, or several stacked as one.
 *
 * Two pieces share ONE pose and one top edge and one bottom edge of the group, which is what
 * makes two crops of different shapes read as a single object turning in a single camera rather
 * than as two clippings that happen to be near each other.
 */
const Objects = ({
  pieces,
  pose,
  top,
}: {
  pieces: readonly Placed[];
  pose: CardPose;
  top: number;
}) => {
  const resolved = poseOf(pose);
  let y = top;
  return (
    <Stage>
      {pieces.map((piece) => {
        const height = heightOf(piece);
        const cy = y + height / 2;
        y += height + PIECE_GAP;
        return (
          <Plane
            key={piece.piece}
            name={`piece-${piece.piece}`}
            pose={resolved}
            cx={CENTRE_X}
            cy={cy}
            width={piece.width}
            height={height}
            radius={piece.radius}
            gloss={glossFor(height)}
          >
            <Piece piece={piece} />
          </Plane>
        );
      })}
    </Stage>
  );
};

/**
 * THE CASCADE: one piece, three times, at three depths, in one pose.
 *
 * Depth is `translateZ` inside the film's own 1400px perspective, so the rear planes are
 * genuinely smaller and genuinely displaced toward the vanishing point rather than scaled by
 * hand. The front plane carries the full object; the two behind it are washed toward the paper,
 * and the same alpha is handed to `Plane` as `veil` so their shadows and rims recede with their
 * faces instead of surviving them at full strength on a receded card.
 */
const Cascaded = ({ card }: { card: SetCard }) => {
  const piece = card.pieces?.[0];
  const cascade = card.cascade;
  const pose = card.pose;
  if (piece === undefined || cascade === undefined || pose === undefined) {
    return null;
  }
  const height = heightOf(piece);
  const resolved = poseOf(pose, true);
  // Rearmost first, so the front plane is painted last and nothing needs a z-index.
  const planes = [0, 1, 2] as const;
  return (
    <Stage>
      {planes.map((i) => {
        const step = i - 1;
        const veil = i === 2 ? 0 : (cascade.wash[i] ?? 0);
        return (
          <Plane
            key={`plane-${String(i)}`}
            name={`cascade-${piece.piece}-${String(i)}`}
            pose={resolved}
            cx={CENTRE_X + step * cascade.dx}
            // `step` is -1 for the rearmost plane, so a positive dy raises the ones behind and
            // the front card sits lowest. See `Cascade` in ./ground for why that direction.
            cy={STAGE_CY + step * cascade.dy}
            z={(i - 2) * cascade.dz}
            width={piece.width}
            height={height}
            radius={piece.radius}
            gloss={glossFor(height)}
            veil={veil}
          >
            <Piece piece={piece} />
            <Wash amount={veil} />
          </Plane>
        );
      })}
    </Stage>
  );
};

/**
 * THE CALLOUT AND ITS LEADER.
 *
 * The leader is drawn in TWO segments and the join is the object's own edge: chartreuse inside
 * the dark object, where #CDFF3D has its 13:1 and is the only place on the sheet it is legal,
 * and the ground's dim ink outside it. That is not decoration, it is the reason the leader is
 * visible at all: a dim olive hairline over a near-black photograph is nothing, and a chartreuse
 * hairline on warm paper is 1.05:1, which is also nothing. Each colour is used exactly where it
 * works, and the boundary between them is a real edge in the picture.
 *
 * The join is placed at the object's UNROTATED bottom edge and the pose is the shallowest the
 * campaign spends, so the few pixels of error run in the direction where both colours vanish.
 */
const Callouts = ({ card, objectTop }: { card: SetCard; objectTop: number }) => {
  const piece = card.pieces?.[0];
  if (piece === undefined || card.callouts === undefined) {
    return null;
  }
  const height = heightOf(piece);
  const left = CENTRE_X - piece.width / 2;
  const bottom = objectTop + height;
  return (
    <>
      {card.callouts.map((callout) => {
        const x = Math.round(left + callout.at.x * piece.width);
        const target = Math.round(objectTop + callout.at.y * height);
        const foot = callout.rail - LEADER_GAP;
        return (
          <div key={callout.text}>
            {/* The terminus: a short cross tick on the chip itself, so the leader ends ON
                something rather than merely near it. */}
            <div
              style={{
                position: "absolute",
                left: x - 7,
                top: target,
                width: 15,
                height: LEADER_W,
                backgroundColor: INK.brand,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x,
                top: target,
                width: LEADER_W,
                height: Math.max(0, bottom - target),
                backgroundColor: INK.brand,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x,
                top: bottom,
                width: LEADER_W,
                height: Math.max(0, foot - bottom),
                backgroundColor: INK.dim,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: callout.rail,
                width: "100%",
                textAlign: "center",
                fontFamily: FONT_FAMILY.monoSemibold,
                fontSize: `${String(LABEL.size)}px`,
                lineHeight: `${String(LABEL.leading)}px`,
                letterSpacing: LABEL.tracking,
                textTransform: "uppercase",
                color: INK.type,
                whiteSpace: "pre",
              }}
            >
              {/* Centred on the leader by a transform rather than by a left offset, so the
                  measured advance of the mono face is never restated here as a number. */}
              <span style={{ display: "inline-block", transform: `translateX(${String(x - CENTRE_X)}px)` }}>
                {callout.text}
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
};

/** One row of the headline, at the group's solved size, with the accent on the word the set
 * names. The film's fitter, tracking, leading and accent; none of its per-word machinery. */
const Rows = ({
  lines,
  keyWord,
  size,
}: {
  lines: readonly string[];
  keyWord: string | undefined;
  size: number;
}) => {
  const leading = Math.round(size * TYPE.leading);
  return (
    <>
      {wordsOf(lines, keyWord).map((words, row) => (
        <div
          key={`${words.map((word) => word.text).join(" ")}-${String(row)}`}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            // 0.28em, which is src/pro/Words.tsx's measured word gap.
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
    </>
  );
};

/** The headline as a block, positioned by its own top edge. Every law computes that top from a
 * different anchor and none of them computes it twice. */
const Block = ({
  lines,
  keyWord,
  size,
  top,
}: {
  lines: readonly string[];
  keyWord: string | undefined;
  size: number;
  top: number;
}) => (
  <div style={{ position: "absolute", left: 0, top, width: "100%" }}>
    <Rows lines={lines} keyWord={keyWord} size={size} />
  </div>
);

/** The mono voice: the counter, the spine label and the stamp, and nothing else is ever set in
 * it except a callout. */
const Furniture = ({ text, align }: { text: string; align: "left" | "right" }) => (
  <div
    style={{
      fontFamily: FONT_FAMILY.monoSemibold,
      fontSize: `${String(LABEL.size)}px`,
      lineHeight: `${String(LABEL.leading)}px`,
      letterSpacing: LABEL.tracking,
      textTransform: "uppercase",
      color: INK.type,
      textAlign: align,
      whiteSpace: "pre",
    }}
  >
    {text}
  </div>
);

/** The swipe cue. The end card's button, a quarter of the size. */
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

/** One horizontal row of furniture, spanning inset to inset. Both rows are the same component so
 * the four corners cannot drift apart. */
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

/** The lines a card is fitted against: its own, unless it is in a solve group, in which case
 * every line of every card in that group, so the two cards come back at one size. */
const solvedLines = (set: CarouselSet, card: SetCard): readonly string[] =>
  card.solve === undefined
    ? card.lines
    : set.cards.filter((other) => other.solve === card.solve).flatMap((other) => other.lines);

const solvedFigures = (set: CarouselSet, card: SetCard): readonly string[] =>
  card.solve === undefined
    ? [card.figure ?? ""]
    : set.cards
        .filter((other) => other.solve === card.solve)
        .map((other) => other.figure ?? "")
        .filter((figure) => figure !== "");

/** The stage line and the clamp: the whole vertical law for an L1 object. The clamp is a guard
 * rail rather than a layout device, and it is slack at both ends on every set in the ten. */
const clampedTop = (total: number, centre: number): number =>
  Math.min(TOP_MAX, Math.max(TOP_MIN, Math.round(centre - total / 2)));

const Content = ({ set, card }: { set: CarouselSet; card: SetCard }) => {
  const size = groupSize(solvedLines(set, card), MEASURE, card.max ?? TYPE.max);
  const leading = Math.round(size * TYPE.leading);
  const blockHeight = leading * card.lines.length;
  const pieces = card.pieces ?? [];

  if (card.layout === "figure") {
    const figure = card.figure ?? "";
    const figureSize = groupSize(solvedFigures(set, card), MEASURE, FIGURE_MAX);
    const figureLeading = Math.round(figureSize * TYPE.leading);
    const gap = Math.round(figureSize * FIGURE_GAP);
    // The group's INK is centred in the band, not its line boxes. See `centredTop` in ./ground
    // for the 44px the two differ by on this card and for the metrics they are computed from.
    const top = centredTop(
      [
        { size: figureSize, leading: figureLeading, count: 1, gap },
        { size, leading, count: card.lines.length },
      ],
      BAND_MID,
    );
    return (
      <>
        <div
          style={{
            position: "absolute",
            left: 0,
            top,
            width: "100%",
            height: figureLeading,
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: `${String(figureSize)}px`,
            lineHeight: `${String(figureLeading)}px`,
            letterSpacing: TYPE.tracking,
            color: INK.type,
            whiteSpace: "pre",
          }}
        >
          {figure}
        </div>
        <Block
          lines={card.lines}
          keyWord={card.key}
          size={size}
          top={top + figureLeading + gap}
        />
      </>
    );
  }

  if (card.layout === "plate") {
    return (
      <Block
        lines={card.lines}
        keyWord={card.key}
        size={size}
        top={centredTop([{ size, leading, count: card.lines.length }], BAND_MID)}
      />
    );
  }

  if (card.layout === "cascade") {
    return (
      <>
        <Block lines={card.lines} keyWord={card.key} size={size} top={TYPE_BASE - blockHeight} />
        <Cascaded card={card} />
      </>
    );
  }

  if (card.layout === "inverted") {
    const total = totalHeight(pieces);
    // The type's INK is pinned, so the sentence does not move across the swipe; the object then
    // centres in whatever paper is left above it, so the leftover never pools on one side of it.
    // See L2 in ./ground for the two-fixed-anchor version this replaced and why it was rendered
    // before it was rejected.
    const typeTop = centredTop([{ size, leading, count: card.lines.length }], TYPE_MID_INV);
    return (
      <>
        <Objects
          pieces={pieces}
          pose={card.pose ?? { kind: "arrival", amount: 0 }}
          top={Math.round((HEAD_BOTTOM + typeTop - total) / 2)}
        />
        <Block lines={card.lines} keyWord={card.key} size={size} top={typeTop} />
      </>
    );
  }

  if (card.layout === "annotated") {
    const total = totalHeight(pieces);
    const top = Math.round(ANNOTATED_CY - total / 2);
    return (
      <>
        <Block
          lines={card.lines}
          keyWord={card.key}
          size={size}
          top={ANNOTATED_TYPE_BASE - blockHeight}
        />
        <Objects
          pieces={pieces}
          pose={card.pose ?? { kind: "arrival", amount: 0 }}
          top={top}
        />
        <Callouts card={card} objectTop={top} />
      </>
    );
  }

  return (
    <>
      <Block lines={card.lines} keyWord={card.key} size={size} top={TYPE_BASE - blockHeight} />
      <Objects
        pieces={pieces}
        pose={card.pose ?? { kind: "arrival", amount: 0 }}
        top={clampedTop(totalHeight(pieces), STAGE_CY)}
      />
    </>
  );
};

/**
 * A TYPE ALIAS AND NOT AN INTERFACE, and that is a Remotion constraint rather than a style.
 * `Composition` requires its props to be assignable to `Record<string, unknown>`, and an
 * interface has no implicit index signature while an object type literal does.
 */
export type PlateProps = {
  /** The set's own name, as it appears in ./sets and as the output directory is called. */
  set: string;
  index: number;
  cta: Cta;
};

export const Plate = ({ set: name, index, cta }: PlateProps) => {
  // fitText caches its measurement for the life of the page, so a size taken before the brand
  // faces land would typeset the whole campaign for a typeface it does not contain.
  const loaded = useFaces();
  const set = setNamed(name);
  const card = set.cards[index];
  const total = set.cards.length + 1;

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND.base, width: CARD_W, height: CARD_H }}>
      <AbsoluteFill style={{ backgroundImage: GROUND.sweep }} />
      <AbsoluteFill style={{ backgroundImage: POOL }} />

      {/* The head row. The signature card has neither half of it: the lockup carries its own
          mark, and the counter is the one element that would differ between a four-card set and
          a six-card one. See the header. */}
      {card === undefined ? null : (
        <Row
          top={INSET}
          height={Math.round(MARK_W * 0.62)}
          left={<Mark width={MARK_W} tone="light" />}
          right={<Furniture text={counterOf(index, total)} align="right" />}
        />
      )}

      {card === undefined ? <Lockup cta={cta} /> : <Content set={set} card={card} />}

      <Row
        top={FOOT_TOP}
        height={CUE.height}
        left={
          <Furniture
            text={card === undefined ? SIGNATURE_LABEL : (card.stamp ?? false) ? CAROUSEL_STAMP : card.label}
            align="left"
          />
        }
        right={card === undefined ? <div /> : <Cue />}
      />

      <Grain />
    </AbsoluteFill>
  );
};
