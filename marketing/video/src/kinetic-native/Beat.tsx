/**
 * One beat: a graded plate, a statement over it, and whichever seam this boundary was
 * assigned in the vector ledger at the top of KineticNative.tsx.
 *
 * Three seams exist in the whole film and each one lives here:
 *
 *   waterfall cut   the default text to text boundary, per word, riding the current. The
 *                   words handle it themselves in Words.tsx; the block does nothing.
 *   inverse zoom    the reserved arrival, spent once. A wrapper level z move: the outgoing
 *                   recedes and the incoming arrives oversized and retracts. Everything
 *                   shrinks across the cut, which is what makes it read as something big
 *                   landing rather than as a push.
 *   cut the curve   the boundary out of the last beat into the end card. A block level x
 *                   move in the current's direction, mirrored against the card's entry.
 *
 * The block itself has no settle, no drift and no scale breathing. Direction B eased the
 * whole statement from 1.035 down to 1 on every beat, which is a z move layered on top of an
 * x seam: two axes at one cut, and the doctrine's rule is that x stays x.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { FONT_FAMILY } from "@/lib/fonts";
import { VIDEO_W } from "@/lib/scale";

import {
  CURRENT,
  CURVE,
  EASE,
  INVERSE,
  TRAVEL,
  WATERFALL_ENTRY,
} from "./motion";
import { Plate, Texture } from "./Plate";
import type { Beat as BeatData } from "./script";
import { BOX, K } from "./skin";
import { fitStack, useDisplayFonts } from "./type-fit";
import { Words, type WordEntry } from "./Words";

const BOX_W = VIDEO_W - BOX.side * 2;

/** Fallback local frame the mono footnote arrives, when the beat does not name one. It is
 * the machine voice and it is used once in the film. */
const NOTE_AT = 16;

/**
 * How much of a knockout letter is footage rather than flat bone.
 *
 * This number is a legibility floor, not a taste dial. A gameplay frame can be a dark
 * corridor, and a straight multiply against one produces letters that are black on black:
 * direction B lost a whole word to exactly that.
 *
 * It has now been wrong in both directions. At 0.5 against a plate brightened to 1.95 the
 * footage clipped to white and the letters were flat bone with a dirty mottle in them. At
 * 0.62 against a plate brightened to 1.28 the dark half of the firefight took SAME GAME down
 * to a mid grey on black that does not survive a thumbnail. 0.30 against a plate lifted
 * before it is contrasted holds a letter at about 75% of bone over the darkest frame in the
 * set and at bone over the brightest, so the footage reads as texture inside the letterforms
 * and the word reads first, which is the order that matters.
 */
const KNOCKOUT_TEXTURE = 0.3;

export type SeamIn = "open" | "waterfall" | "inverse";
export type SeamOut = "waterfall" | "inverse" | "curve";

/** The statement, positioned on the TRUE frame centre.
 *
 * Not lifted, not shifted up, no reserved band under it. The captions doctrine is explicit
 * that a caption line is an overlay composited on top of the film and that a composition
 * centred at 0.42 of the height with a dead lower strip is the bug rather than the fix, so
 * this centres on y = 960 and the rail rides over the bottom on its own layer. What keeps the
 * two from fighting is the height budget the stack is fitted into, which is a size decision.
 */
const Statement = ({
  beat,
  entry,
  cutAt,
  only,
}: {
  beat: BeatData;
  entry: WordEntry;
  cutAt: number | null;
  /** The knockout's second pass: the slabs only, drawn above the multiply. See `only` on
   * WordsProps for why a knockout beat draws its type twice. */
  only?: "slab";
}) => {
  const frame = useCurrentFrame();
  const sizes = fitStack({
    lines: beat.lines.map((line) => line.toUpperCase()),
    width: BOX_W * (beat.fitWidth ?? 1),
    height: BOX.stack,
    cap: BOX.cap,
  });

  const onFlood = beat.treatment === "flood";
  const ink = onFlood ? K.onHot : K.bone;

  // Technique 6, a waterfall entry: up from below, binary opacity set at the arrival rather
  // than faded, power4.out. An arrival's opacity is binary and a seam's ignites mid path; the
  // two rules are different on purpose and mixing them is the documented mistake.
  const noteAt = beat.noteAt ?? NOTE_AT;
  const note = interpolate(frame, [noteAt, noteAt + WATERFALL_ENTRY.normal.frames], [0, 1], {
    easing: EASE.power4Out,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        paddingLeft: BOX.side,
        paddingRight: BOX.side,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          transform: `rotate(${String(beat.tilt ?? 0)}deg)`,
          transformOrigin: beat.align === "center" ? "50% 50%" : "0% 50%",
        }}
      >
        <Words
          lines={beat.lines}
          sizes={sizes}
          reveal={beat.reveal}
          accent={beat.accent}
          slab={beat.slab}
          align={beat.align ?? "left"}
          ink={ink}
          accentInk={onFlood ? K.onHot : K.hot}
          entry={entry}
          cutAt={cutAt}
          slabAt={beat.slabAt}
          only={only}
        />
        {beat.note !== undefined && only === undefined ? (
          <div
            style={{
              marginTop: 28,
              fontFamily: FONT_FAMILY.monoSemibold,
              fontSize: 34,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: onFlood ? K.onHot : K.hot,
              opacity: frame < noteAt ? 0 : 1,
              transform: `translateY(${String(((1 - note) * WATERFALL_ENTRY.normal.lift).toFixed(1))}px)`,
              textAlign: beat.align ?? "left",
            }}
          >
            {beat.note}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const Beat = ({
  beat,
  seamIn,
  seamOut,
}: {
  beat: BeatData;
  seamIn: SeamIn;
  seamOut: SeamOut;
}) => {
  const loaded = useDisplayFonts();
  const frame = useCurrentFrame();

  // Nothing measures or paints until the faces are in. A frame captured before then would be
  // typeset in Chromium's fallback sans and nothing downstream would report it.
  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: K.ink }} />;
  }

  // Technique 2 on the way in, and only on the arrival beat. Oversized at 1.25 as if it were
  // just behind the camera, retracting into the focal plane on expo.out, blur coming off from
  // the 10px it shared with the outgoing frame at the swap. Every value shrinks.
  const arriving = seamIn === "inverse";
  const inScale = arriving
    ? interpolate(frame, [0, INVERSE.entry], [INVERSE.entryScale, 1], {
        easing: EASE.expoOut,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const inBlur = arriving
    ? interpolate(frame, [0, INVERSE.entry], [INVERSE.blur, 0], {
        easing: EASE.expoOut,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const inOpacity = arriving
    ? interpolate(frame, [0, INVERSE.entry], [INVERSE.cut, 1], {
        easing: EASE.expoOut,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Technique 2 on the way out, on the beat that hands off to the arrival. It recedes rather
  // than accelerating sideways, so the sign of the scale change matches the retraction that
  // answers it.
  const receding = seamOut === "inverse";
  const recedeFrom = beat.frames - INVERSE.exit;
  const outScale = receding
    ? interpolate(frame, [recedeFrom, beat.frames], [1, INVERSE.exitScale], {
        easing: EASE.power3In,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const outBlur = receding
    ? interpolate(frame, [recedeFrom, beat.frames], [0, INVERSE.blur], {
        easing: EASE.power3In,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  // Its own linear tween, never shared with the scale's ease: power3.in holds opacity near 1
  // far too long and both texts end up visible through the swap.
  const outFade = receding
    ? interpolate(frame, [recedeFrom, beat.frames], [1, INVERSE.cut], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Technique 3 on the way out, on the last beat only. The block accelerates left and its
  // opacity is gone by about a quarter of the travel, so it is still moving fast when it
  // disappears and the end card picks the same direction up mid path.
  const curving = seamOut === "curve";
  // Scheduled so the fade lands ON the boundary rather than at 73% of it. It used to end at
  // CURVE.exit * CURVE.fadeAt, which put the block at zero opacity two frames before the end
  // card's Sequence began, and those two frames rendered as an empty black field with only
  // the caption rail on it. A gap where nothing is on screen is the most literal form of the
  // dead beat the doctrine is about. The exit is lengthened by the same two frames so the
  // block still covers the full 130px of travel and is still accelerating when it goes.
  const curveFrom = beat.frames - Math.round(CURVE.exit / CURVE.fadeAt);
  const curveX = curving
    ? interpolate(frame, [curveFrom, beat.frames], [0, CURRENT * TRAVEL], {
        easing: EASE.power4In,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const curveFade = curving
    ? interpolate(frame, [curveFrom, beat.frames], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  const blur = Math.max(inBlur, outBlur);
  // The opening beat has no special entry any more: its head start is negative reveal
  // offsets in the script, next to the copy they apply to, rather than a branch here.
  const entry: WordEntry = arriving ? "composed" : "waterfall";
  // The words own the cut only when the seam is the waterfall. Under an inverse zoom or a
  // block level curve the wrapper is already carrying it, and two exits on one element would
  // be the block moving one way while its own words move another.
  const cutAt = seamOut === "waterfall" ? beat.frames : null;

  return (
    // Transform and opacity here, filter on the child. Never both a blur and an opacity in one
    // declaration on one element: it is a documented compositing hazard in headless Chromium
    // and it costs a render cycle to notice.
    <AbsoluteFill
      style={{
        transform: `translateX(${curveX.toFixed(2)}px) scale(${(inScale * outScale).toFixed(4)})`,
        opacity: inOpacity * outFade * curveFade,
      }}
    >
      <AbsoluteFill style={{ filter: blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
        <AbsoluteFill style={{ backgroundColor: beat.treatment === "flood" ? K.hot : K.ink }}>
          {beat.treatment === "knockout" ? (
            // The letterforms are the window, and the whole effect is one blend mode: bone
            // type on a black field with the plate multiplied over the lot. Black stays black
            // outside the words; inside them the bone is scaled by the footage, so the footage
            // is visible only where a letter is. No mask, no SVG, no second copy of the font.
            //
            // The opacity on that multiply is the floor that keeps a word legible over a dark
            // plate: a gameplay frame can be a dark corridor and a straight multiply against
            // one produced letters that were black on black.
            // K.ember rather than black, and it buys the whole frame for free. The plate
            // is multiplied over this field, so on black everything that is not a letter is
            // dead black and the beat is two words on nothing; on the ember the same multiply
            // paints a deep moving wash of the same footage around them. It needs no second
            // video element, which matters: the first attempt at this ran a second decode of
            // the same clip per knockout beat and pushed the render past its font timeout.
            <AbsoluteFill style={{ isolation: "isolate", backgroundColor: K.ember }}>
              <Statement beat={beat} entry={entry} cutAt={cutAt} />
              <AbsoluteFill style={{ mixBlendMode: "multiply", opacity: KNOCKOUT_TEXTURE }}>
                <Plate
                  clip={beat.clip}
                  from={beat.clipFrom}
                  treatment={beat.treatment}
                  camStart={beat.camStart}
                  camStop={beat.camStop}
                />
              </AbsoluteFill>
              {/* The slabs again, above the multiply and in exact register with the pass
                  underneath. A slab caught in the multiply comes out as a muddy rectangle with
                  the app's own card copy showing through it and its black text invisible. */}
              {beat.slab !== undefined ? (
                <Statement beat={beat} entry={entry} cutAt={cutAt} only="slab" />
              ) : null}
            </AbsoluteFill>
          ) : (
            <>
              <Plate
                clip={beat.clip}
                from={beat.clipFrom}
                treatment={beat.treatment}
                camStart={beat.camStart}
                camStop={beat.camStop}
              />
              {/* The one treatment that shows the app plainly needs its lower half taken to
                  near solid ink, not softly graded down.
                  A gentle gradient left the app's own interface copy legible underneath the
                  statement, and a screen that says "you and Marcus both queued up" running
                  through a headline that says EVERYONE HERE is two sentences competing for the
                  same square inch. The first render still cut too low: that line survived at
                  about 40% grey with the headline's cap heights overlapping its descenders,
                  which reads as a collision rather than as a layer. Cutting hard at 38%
                  leaves the DUO LOCKED header, the lime ring and the real photo reading
                  cleanly above the type, which is the whole proof, and gives the type a black
                  plate to sit on. */}
              {beat.treatment === "proof" ? (
                <>
                  {/* The top mask, and it is aimed at one object. This recording carries an
                      iOS notification banner reading "You matched with Marcus." across its
                      top edge for almost its whole length, and the framing cuts it in half,
                      so the first third of a second of the film's only product shot is a
                      chopped grey bar with half a sentence in it. There is no toast free
                      window in the clip long enough to hold this beat, so it is masked
                      instead. 72px is under the lime DUO LOCKED header at every point in this
                      beat's camera path, which is why that path is parked early and shallow.

                      It also keeps the word "matched" off screen, which matters beyond
                      tidiness: this is a platonic app and the one frame where a viewer reads
                      the real interface is not the frame to hand them dating vocabulary. */}
                  <AbsoluteFill
                    style={{
                      backgroundImage:
                        "linear-gradient(to bottom, rgba(8,7,10,1) 0px, rgba(8,7,10,1) 72px, rgba(8,7,10,0) 104px)",
                    }}
                  />
                  <AbsoluteFill
                    style={{
                      backgroundImage:
                        "linear-gradient(to bottom, rgba(8,7,10,0) 27%, rgba(8,7,10,0.94) 38%, rgba(8,7,10,1) 44%)",
                    }}
                  />
                </>
              ) : null}
              <Statement beat={beat} entry={entry} cutAt={cutAt} />
            </>
          )}
          <Texture />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
