/**
 * ONE CARD, COMPOSED.
 *
 * =====================================================================================
 * THERE IS NO MOTION IN THIS FILE, AND THAT IS THE FORMAT SPEAKING
 * =====================================================================================
 *
 * The film's type arrives on the doctrine's waterfall and its objects travel on a leftward
 * current, and none of that can be reused here, because a still rendered at frame zero of a
 * choreography is a picture of a choreography that has not happened yet: the words would be
 * at 0.35 opacity, part way through a masked lift, and the object would be 130px right of
 * home. So the headline is drawn statically and the object is drawn statically.
 *
 * What IS reused is every static property of those two components, taken from the same
 * constants rather than eyeballed to match: the display face, its tracking, its per line box
 * of exactly `size * TYPE_LEADING`, the word gap of `size * 0.26`, the accent on the key
 * word, the perspective, the tilt, the two layer shadow, the corner radii, the fill behind
 * the rounded corners. Set a frame of `frag-dark.mp4` beside a card and the objects are the
 * same object under the same light.
 *
 * =====================================================================================
 * THE ONE PIECE OF THE FILM'S MOTION THAT SURVIVES, AND WHY
 * =====================================================================================
 *
 * The tilt. It is not motion, it is a camera position: one perspective container and one
 * rotation applied to every object, so seven differently shaped crops across six cards read
 * as seven views from one place instead of seven separately art directed rectangles. 7
 * degrees at a 2400px perspective is a 3.7% width difference across an 844px card, which is
 * unmistakably dimensional and small enough that the app's own mono type, which is the thing
 * this whole direction exists to make legible, loses nothing to the foreshortening.
 */
import { AbsoluteFill, staticFile } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";

import {
  CARD_H,
  CUE,
  FOOTER_TOP,
  GROUND,
  INK,
  INSET,
  LABEL,
  MARK_W,
  MEASURE,
  PIECE_GAP,
  POOL,
  SHADOW,
  STAGE_Y,
  TILT,
  TOP_MAX,
  TOP_MIN,
  TYPE_BASE,
  TYPE_CAP,
  TYPE_LEADING,
  X0,
} from "./ground";
import { Lockup } from "./Lockup";
import { CARD_COUNT, CARDS, PIECES, WAITLIST_LABEL, type Placed } from "./plan";
import { Source } from "../v6/media";
import { DISPLAY, linesSize, TRACKING, useFaces, wordsOf } from "../v6/type";

/**
 * The mono furniture: the spine label, the counter, the chevron.
 *
 * `monoSemibold` at 0.18em is the register the end card sets duoqueue.io in and the register
 * the app itself sets HIGHLIGHTS and ROCKET LEAGUE in, so none of this is a fourth typeface
 * introduced for a carousel. Upper case is applied here rather than typed into the plan,
 * because the strings are copy and the capitals are typography.
 */
const Label = ({ text, color }: { text: string; color: string }) => (
  <span
    style={{
      fontFamily: FONT_FAMILY.monoSemibold,
      fontSize: `${String(LABEL.size)}px`,
      lineHeight: `${String(LABEL.leading)}px`,
      letterSpacing: LABEL.tracking,
      textTransform: "uppercase",
      color,
      whiteSpace: "pre",
    }}
  >
    {text}
  </span>
);

/**
 * The headline, bottom anchored.
 *
 * Every measurement here is the film's. The per line box is `size * TYPE_LEADING`, 1.34,
 * which is looser than a display face usually wants and is sized to hold the FACE rather
 * than the caps: at 1.02 the descender of the q in "queue" and the y in "play" is cut off
 * 7.6px short by the line box. The word gap is `size * 0.26`. The key word is the light
 * theme's volt, which is the app's own resolution of chartreuse on paper, and there is
 * exactly one of them per card.
 */
const Headline = ({
  lines,
  keyWord,
  size,
}: {
  lines: string[];
  keyWord: string | undefined;
  size: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: X0,
      top: 0,
      width: MEASURE,
      height: TYPE_BASE,
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      justifyContent: "flex-end",
    }}
  >
    {lines.map((line) => (
      <div
        key={line}
        style={{
          display: "flex",
          flexDirection: "row",
          gap: `${String(Math.round(size * 0.26))}px`,
          height: `${String(Math.round(size * TYPE_LEADING))}px`,
          alignItems: "center",
        }}
      >
        {wordsOf(line, keyWord).map((word, index) => (
          <span
            key={`${line}-${String(index)}`}
            style={{
              fontFamily: DISPLAY,
              fontSize: `${String(size)}px`,
              lineHeight: `${String(Math.round(size * TYPE_LEADING))}px`,
              letterSpacing: TRACKING,
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

/**
 * The objects, stacked and hung.
 *
 * The stack's top is where centring on the stage would put it, pulled into [TOP_MIN,
 * TOP_MAX], which is the film's hang band re-solved for this frame. Centring alone is the
 * right rule only when every object is about the same size, and these run from a 331px pair
 * of chips to a 582px lock screen.
 *
 * Every card sits inside ONE perspective container, so the tilt is a camera rather than a
 * per object effect, and the two objects on card two and card four share it, which is what
 * makes a pair read as one stacked thing.
 */
const Stage = ({ pieces }: { pieces: Placed[] }) => {
  const sized = pieces.map((piece) => {
    const [sourceW, sourceH] = PIECES[piece.piece].source;
    // The rectangle actually drawn. Default is the whole clip, so a piece with no `crop` goes
    // through the identical arithmetic and lands on the identical pixels it did before this
    // existed: scale is width / view.width, and with no crop that is width / sourceW.
    const view = piece.crop ?? { x: 0, y: 0, width: sourceW, height: sourceH };
    const scale = piece.width / view.width;
    return {
      piece,
      height: Math.round(piece.width * (view.height / view.width)),
      // The whole clip, drawn at the crop's scale and pushed up and left so the crop's own
      // origin lands on the object's origin. The object's `overflow: hidden` does the cutting.
      film: {
        width: Math.round(sourceW * scale),
        height: Math.round(sourceH * scale),
        left: -Math.round(view.x * scale),
        top: -Math.round(view.y * scale),
      },
    };
  });
  const stack =
    sized.reduce((total, row) => total + row.height, 0) + PIECE_GAP * (sized.length - 1);

  let cursor = Math.min(Math.max(STAGE_Y - stack / 2, TOP_MIN), TOP_MAX);

  return (
    <AbsoluteFill
      style={{ perspective: `${String(TILT.perspective)}px`, perspectiveOrigin: TILT.origin }}
    >
      {sized.map(({ piece, height, film }) => {
        const top = cursor;
        cursor += height + PIECE_GAP;
        const left =
          piece.align === "right"
            ? X0 + MEASURE - piece.width
            : piece.align === "center"
              ? X0 + Math.round((MEASURE - piece.width) / 2)
              : X0;
        return (
          <div
            key={piece.piece}
            style={{
              position: "absolute",
              left,
              top,
              width: piece.width,
              height,
              borderRadius: piece.radius,
              overflow: "hidden",
              transform: TILT.transform,
              boxShadow: SHADOW,
              // Under the rounded corners. Every piece is a region of an app screen, so its
              // own field is what a corner should reveal: without this the antialiased edge
              // shows a sliver of ground and the object reads as cut out rather than placed.
              backgroundColor: "#0A0B09",
            }}
          >
            <div style={{ position: "absolute", ...film }}>
              <Source clip={PIECES[piece.piece].clip} from={0} fit="cover" />
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * The grain, and it is not a stylistic filter.
 *
 * It is here for the second of the two jobs it does in the film. The first, dithering H.264
 * banding out of a large near-white field, does not apply to a PNG. The second does: a flat
 * pale ground with no texture on it reads as a slide, and every frame of the two finished
 * ads has this exact tile on it at this exact strength. A carousel posted beside them
 * without it would be a fraction cleaner and visibly not the same surface.
 */
const Grain = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      backgroundImage: `url(${staticFile("noise.png")})`,
      backgroundRepeat: "repeat",
      mixBlendMode: "overlay",
      opacity: 0.06,
    }}
  />
);

/**
 * THE SWIPE CUE, AND IT IS THE ONLY PLACE RAW CHARTREUSE COULD GO.
 *
 * =====================================================================================
 * THE MEASUREMENT THAT PUT IT HERE
 * =====================================================================================
 *
 * Chartreuse is the one colour that makes DuoQueue recognisable and it is about 1.4:1 on this
 * ground, so in this campaign it only ever appears on the app's own off-black: inside a dark
 * fragment, or on the end card's slab. On the six rendered cards that leaves it wherever the
 * app happens to have put it, and measured on the delivered PNGs that is:
 *
 *   01 the deck      478 px    0.03% of the frame     `NO. 001`, on a sunlit stone wall
 *   02 the match      13 px    0.00%                  nothing; the overlap chip is amber
 *   03 the duo    13,911 px    0.95%                  DUO LOCKED and the reticle
 *   04 the thread 105,277 px   7.22%                  the Send a message button
 *   05 the game      647 px    0.04%                  nothing; it is not the app
 *   06 waitlist   10,813 px    0.74%                  the call to action
 *
 * Three of the six carried no brand colour at all, and one of them is CARD ONE, which is the
 * thumbnail: the only card a scroller is guaranteed to see, and the only one that has to work
 * at 150px with nothing beside it. At that size its headline survives and everything else on
 * it goes, so the card was reaching a feed as four dark words and a photograph of a man
 * against a brick wall.
 *
 * THE OBVIOUS FIX DOES NOT FIT AND THE ARITHMETIC IS WORTH KEEPING. The film answers exactly
 * this on its opening beat by putting the pass / ping / boost row under the card, and boost is
 * a solid #CDFF3D disc. That pair is 745px tall. Here the object band runs from 575, which is
 * the tightest this frame lets an object sit under the type, to about 1130, past which the
 * long cast of SHADOW reaches the counter: 555px. Every way of buying the missing 190px spends
 * the thing this direction exists to protect. Scaling the pair to fit takes the card from 844
 * to 640 wide and its own name type from 62px to 47. Cropping the card's dead upper wall takes
 * away its rounded top corners and its overflow button, which are most of what makes it read
 * as an interface rather than as a photo. Neither is worth one splash of colour.
 *
 * =====================================================================================
 * SO THE COLOUR COMES FROM THE FURNITURE, AND IT PAYS FOR ITSELF TWICE
 * =====================================================================================
 *
 * The cue was a chevron in volt on the bare ground. It is now the chevron in RAW chartreuse on
 * an off-black slab, which is not a new invention: it is ./Lockup.tsx's call to action at
 * furniture scale. Same fill, same ink, same square corners, same idea that in a feed the
 * SHAPE of a button is read before the words in it are.
 *
 * That is what makes it more than a colour patch. A reader meets this slab on card one, taps
 * past it five times, and on card six it is the same shape grown to 68px carrying the only
 * thing the post actually wants: join the waitlist. The set trains a shape and then pays it
 * off, which is a reason to reach the last card rather than a decoration on the way there.
 *
 * The chevron is still the app's own double angle, the glyph it draws in front of the overlap
 * chip on card two, so the swipe cue remains a piece of the product's typography. `SWIPE` is
 * named once, on the card where the gesture has to be learned, and never again.
 */
const Cue = ({ named }: { named: boolean }) => (
  <div
    style={{
      position: "absolute",
      right: INSET,
      // The slab's optical centre on the counter's, so the two ends of the bottom line sit on
      // one axis. A filled shape and a line of type do not share a top edge.
      top: FOOTER_TOP + LABEL.leading / 2 - CUE.height / 2,
      height: CUE.height,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
      padding: `0 ${String(CUE.pad)}px`,
      backgroundColor: INK.slab,
    }}
  >
    {named && <Label text="swipe" color={INK.brand} />}
    <Label text=">>" color={INK.brand} />
  </div>
);

/** Which card of how many, as the counter draws it. Zero padded so 01 and 06 are the same
 * width and the mark does not shift between cards. */
const counter = (index: number): string =>
  `${String(index + 1).padStart(2, "0")} / ${String(CARD_COUNT).padStart(2, "0")}`;

export const Card = ({ index, cta }: { index: number; cta: Cta }) => {
  const loaded = useFaces();

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  const card = CARDS[index];
  const last = card === undefined;

  // ONE size for the whole set, capped at the film's 76, so no card is larger than another
  // because of how it is spelled. Measured across every line of every card rather than per
  // card: a per card fit is the inverted hierarchy the campaign already rejected once, where
  // the shortest string came out the biggest.
  const size = linesSize(
    CARDS.flatMap((entry) => entry.lines),
    MEASURE,
    TYPE_CAP,
  );

  return (
    <AbsoluteFill style={{ backgroundColor: GROUND.base }}>
      <AbsoluteFill style={{ backgroundImage: GROUND.sweep }} />
      <AbsoluteFill style={{ backgroundImage: POOL }} />

      {last ? (
        <Lockup cta={cta} />
      ) : (
        <>
          <Headline lines={card.lines} keyWord={card.key} size={size} />
          <Stage pieces={card.pieces} />
        </>
      )}

      {/* The spine, top left. The mark, top right, on every card but the last, which is
          already carrying one at 250px. */}
      <div style={{ position: "absolute", left: INSET, top: INSET }}>
        <Label text={last ? WAITLIST_LABEL : card.label} color={INK.muted} />
      </div>
      {!last && (
        <div
          style={{
            position: "absolute",
            right: INSET,
            // The mark's optical centre on the label's, so the two ends of the top line sit
            // on one axis rather than on two top edges of different heights.
            top: INSET + LABEL.leading / 2 - (MARK_W * 0.6248) / 2,
          }}
        >
          <Mark width={MARK_W} tone="light" />
        </div>
      )}

      {/* The counter, and the swipe cue. The cue is the app's own double angle, the glyph it
          draws in front of its overlap chip, set in the light theme's volt so it is the one
          coloured thing on the frame outside the headline's key word. The last card has no
          cue, because there is nothing after it. */}
      <div style={{ position: "absolute", left: INSET, top: FOOTER_TOP }}>
        <Label text={counter(index)} color={INK.muted} />
      </div>
      {!last && <Cue named={index === 0} />}

      <Grain />
    </AbsoluteFill>
  );
};

/** Exported for the render script, which names its files after the card they hold. */
export const cardSlug = (index: number): string =>
  (CARDS[index]?.label ?? WAITLIST_LABEL).replace(/\s+/g, "-");

export const CARD_HEIGHT = CARD_H;
