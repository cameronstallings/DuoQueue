/**
 * One beat: a graded plate, a statement over it, and whichever seam this boundary was assigned
 * in the vector ledger at the top of KineticNative.tsx.
 *
 * Three seams exist in the whole film and each one lives here:
 *
 *   waterfall cut   the default text to text boundary, per word, riding the current. The words
 *                   handle it themselves in Words.tsx; the block does nothing.
 *   inverse zoom    the reserved arrival, spent once. A wrapper level z move: the outgoing
 *                   recedes and the incoming arrives oversized and retracts. Everything
 *                   shrinks across the cut, which is what makes it read as something big
 *                   landing rather than as a push.
 *   cut the curve   the boundary out of the last beat into the end card. A block level x move
 *                   in the current's direction, mirrored against the card's entry.
 *
 * The block itself has no settle, no drift and no scale breathing. Direction B eased the whole
 * statement from 1.035 down to 1 on every beat, which is a z move layered on top of an x seam:
 * two axes at one cut, and the doctrine's rule is that x stays x.
 *
 * WHAT THE SECOND CUT REMOVED FROM THIS FILE. Two treatments had their own compositing paths
 * here: `knockout`, which put gameplay inside the letterforms and drew the type twice so a
 * slab could sit above the multiply, and `proof`, which hard cut the lower 38% of the app clip
 * to solid ink so a full width headline could sit on it. Both were answers to the same
 * question, how to put a headline over a picture, and both answered it by destroying most of
 * the picture. The answer now is a scrim shaped to where the type is (Plate.tsx) and, on the
 * app beats, moving the type off the product entirely (`anchor` in script.ts). That is worth
 * about ninety lines of blend mode plumbing, and it is the difference between footage a viewer
 * can see and footage a viewer can only infer.
 */
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

import { alpha } from "@/lib/color";
import { VIDEO_W } from "@/lib/scale";

import { CURRENT, CURVE, EASE, INVERSE, TRAVEL } from "./motion";
import { Plate, Texture } from "./Plate";
import type { Anchor, Beat as BeatData } from "./script";
import { BOX, budgetAt, K } from "./skin";
import { fitStack, useDisplayFonts } from "./type-fit";
import { Words, type WordEntry } from "./Words";

const BOX_W = VIDEO_W - BOX.side * 2;

export type SeamIn = "open" | "waterfall" | "inverse";
export type SeamOut = "waterfall" | "inverse" | "curve";

/**
 * Where the block sits, and how much height it is allowed.
 *
 * `center` is the true frame centre and the default; the other two are the app beats getting
 * out of the product's way. The budget is a CEILING that `fitStack` shrinks a tall block into,
 * and under the two register system it only binds on the payoff beat, whose band is the
 * narrowest in the film. Everywhere else the type size is decided by the measure, which is the
 * type scale, and the budget is a guard. See `Anchor` in ./script.ts for why an anchored beat
 * is a composition decision about one screenshot and not the reserved caption band the
 * captions doctrine bans.
 */
const LAYOUT: Record<
  Anchor,
  { justifyContent: "center" | "flex-start" | "flex-end"; padding: number; budget: number }
> = {
  center: { justifyContent: "center", padding: 0, budget: BOX.stack },
  top: { justifyContent: "flex-start", padding: BOX.top, budget: BOX.bandTop },
  bottom: { justifyContent: "flex-end", padding: BOX.bottom, budget: BOX.bandBottom },
};

/**
 * The shadow under display type on a photographic beat.
 *
 * It is not decoration and it is not a substitute for the scrim. The scrim buys the average
 * legibility of the band the type sits in; this buys the LOCAL contrast where a bone letter
 * happens to land on a bright specular in the footage, which on a sunlit map is most of the
 * frame. Wide and soft rather than tight and dark, so it never reads as an edge.
 *
 * On the flooded beat there is nothing photographic underneath and the type is near black on
 * vermillion, so it gets none.
 */
const TYPE_SHADOW = `drop-shadow(0 10px 26px ${alpha(K.ink, 0.62)})`;

/** The statement. */
const Statement = ({
  beat,
  entry,
  cutAt,
  typeScale,
}: {
  beat: BeatData;
  entry: WordEntry;
  cutAt: number | null;
  typeScale: number;
}) => {
  const anchor: Anchor = beat.anchor ?? "center";
  const layout = LAYOUT[anchor];
  const fitted = fitStack({
    lines: beat.lines.map((line) => line.toUpperCase()),
    hero: beat.hero,
    // The measure, and the ONE number the two delivered cuts differ by. The hero is fitted to
    // a fraction of the safe box rather than to all of it, which is where the margins come
    // from; everything else in the block is proportional to the hero.
    measure: BOX_W * typeScale,
    height: budgetAt(layout.budget, typeScale),
    cap: budgetAt(BOX.cap, typeScale),
  });

  const onFlood = beat.treatment === "flood";
  const ink = onFlood ? K.onHot : K.bone;

  return (
    <AbsoluteFill
      style={{
        paddingLeft: BOX.side,
        paddingRight: BOX.side,
        paddingTop: anchor === "top" ? layout.padding : 0,
        paddingBottom: anchor === "bottom" ? layout.padding : 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: layout.justifyContent,
        alignItems: "stretch",
      }}
    >
      <div
        style={{
          transform: `rotate(${String(beat.tilt ?? 0)}deg)`,
          transformOrigin: "50% 50%",
          filter: onFlood ? undefined : TYPE_SHADOW,
        }}
      >
        <Words
          lines={beat.lines}
          fitted={fitted}
          reveal={beat.reveal}
          accent={beat.accent}
          slab={beat.slab}
          ink={ink}
          accentInk={onFlood ? K.onHot : K.hot}
          entry={entry}
          cutAt={cutAt}
          slabAt={beat.slabAt}
        />
      </div>
    </AbsoluteFill>
  );
};

export const Beat = ({
  beat,
  seamIn,
  seamOut,
  typeScale,
}: {
  beat: BeatData;
  seamIn: SeamIn;
  seamOut: SeamOut;
  /** Fraction of the safe box the hero is fitted to. See TYPE_SCALE in ./skin. */
  typeScale: number;
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
  // far too long and both frames end up visible through the swap.
  const outFade = receding
    ? interpolate(frame, [recedeFrom, beat.frames], [1, INVERSE.cut], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Technique 3 on the way out, on the last beat only. The block accelerates left and its
  // opacity is gone by the boundary, so it is still moving fast when it disappears and the end
  // card picks the same direction up mid path.
  const curving = seamOut === "curve";
  // Scheduled so the fade lands ON the boundary rather than at 73% of it. Ending it at
  // CURVE.exit * CURVE.fadeAt puts the block at zero opacity two frames before the end card's
  // Sequence begins, and those two frames render as an empty field with only the caption rail
  // on it. A gap where nothing is on screen is the most literal form of the dead beat the
  // doctrine is about. The exit is lengthened by the same two frames so the block still covers
  // the full 130px of travel and is still accelerating when it goes.
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
  // The opening beat has no special entry: its head start is negative reveal offsets in the
  // script, next to the copy they apply to, rather than a branch here.
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
          <Plate
            clip={beat.clip}
            from={beat.clipFrom}
            treatment={beat.treatment}
            anchor={beat.anchor ?? "center"}
            camStart={beat.camStart}
            camStop={beat.camStop}
            camScale={beat.camScale}
            camPinRight={beat.camPinRight}
          />
          <Statement beat={beat} entry={entry} cutAt={cutAt} typeScale={typeScale} />
          <Texture />
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
