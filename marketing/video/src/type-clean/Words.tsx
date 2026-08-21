/**
 * THE TWO REGISTER STACK, and the choreography it shares with the rest of the campaign.
 *
 * =====================================================================================
 * WHY THIS IS NOT src/v6/Stack.tsx
 * =====================================================================================
 *
 * That component is the shared one and its header is right about why: three directions must not
 * differ in WHICH words, in WHEN a word arrives, or in where a line breaks, because the only
 * variable worth rendering three files to compare is the look. This direction differs in two of
 * those three by design. It breaks the phrase differently, because the break here decides which
 * words are the subject rather than balancing two halves of a sentence, and it sets the two
 * lines in two registers, which Stack has no concept of: it takes one `size` and one `color`
 * and applies them to every line.
 *
 * So the WHEN is what gets shared, and it is shared the only way that cannot drift: this file
 * imports WATERFALL_CUT, WATERFALL_ENTRY, cascade and EASE and computes the per word clock from
 * exactly the same constants, in exactly the same shape. A word here arrives on the same ease
 * over the same 11 frames after the same decaying stagger as a word in the finished fragment
 * ad. What changed is how far it travels and how big it is when it gets there.
 *
 * It is a copy of about forty lines and that is the cheaper mistake. src/frag/ is a delivered
 * file and the instruction on it is explicit; teaching Stack about registers would edit a
 * module that the delivered ad renders through, and a re-render to prove it unchanged costs
 * more than the duplication does.
 *
 * =====================================================================================
 * THE CHOREOGRAPHY
 * =====================================================================================
 *
 * Technique 4, the waterfall cut, at both ends of every seam. Words arrive from below on a
 * mirrored ease with a decaying stagger and the outgoing beat's words leave upward on the
 * matching accelerating ease, so a cut lands with the old words still climbing and the new ones
 * still rising. Nothing fades up from nothing and nothing is composed and then held: the entry
 * ignites at 0.35 opacity part way through its own travel and the exit begins before the beat
 * is over. There is no idle motion of any kind between those two events, which the doctrine
 * bans outright as motion that goes nowhere and comes back.
 *
 * The two registers travel DIFFERENT DISTANCES, and the doctrine already names the two weight
 * classes: an anchor travels further and longer, a lighter element snaps. The hero is the
 * anchor, at 74px of lift; the support is normal, at 46. Giving them one lift would have been
 * the fifth thing on this frame that says the two lines are the same kind of thing.
 *
 * =====================================================================================
 * WHY THE WORDS ARE INLINE BLOCKS SEPARATED BY REAL SPACES
 * =====================================================================================
 *
 * The size came from `fitText`, which measures a real span containing the whole string, spaces
 * included. A flex row with a `gap` would then lay the line out at a width the measurement
 * never saw, and the line would overhang its measure by however much the gap and the font's own
 * space character disagree. So the words are inline blocks inside `white-space: pre` with the
 * string's own spaces between them, and their transforms do not affect layout, so the line lays
 * out at exactly the width that was measured. kinetic-native's type-fit.ts states this rule and
 * it is the one thing in that file that is about mechanics rather than about taste.
 */
import { interpolate, useCurrentFrame } from "remotion";

import { cascade, EASE, WATERFALL_CUT, WATERFALL_ENTRY } from "@/kinetic-native/motion";

import { cruiseAt, HERO_TRACKING, INK, MEASURE, SUPPORT_TRACKING, TYPE_BASE, X0 } from "./ground";
import { HERO_FACE, SUPPORT_FACE, type FilmType } from "./type";

/** How long a word takes to arrive. 11 frames, 0.37s, well inside the doctrine's 800ms entry
 * ceiling, and the same number the other two ads use. */
const ENTRY = WATERFALL_CUT.entry;

/**
 * Frames between the support line beginning to arrive and the hero doing so.
 *
 * Flat rather than the decaying `cascade` the words inside a line use, and the two being
 * different functions is the point. A decay is right inside a line, where the eye is following
 * one phrase and the later words should catch up. It is wrong between lines, where the reader
 * is stepping down the stack at a steady rate. 4.3 frames is 0.14s, so a whole beat is composed
 * about 0.5s after its first word starts.
 */
const LINE_GAP = WATERFALL_CUT.entryGap * 2.2;

interface Register {
  face: string;
  size: number;
  box: number;
  tracking: string;
  color: string;
  lift: number;
}

/** One line of words, masked to its own box so the arrival reads as words rising out of a slot
 * rather than as words sliding over the ground. */
const Line = ({
  text,
  register,
  lineIndex,
  frames,
  delay,
}: {
  text: string;
  register: Register;
  /** 0 for the support, 1 for the hero. It is part of both the entry delay and the exit delay,
   * in the same order, so the block leaves the way it came. */
  lineIndex: number;
  frames: number;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const exitAt = frames - WATERFALL_CUT.exit;
  const words = text.split(" ");

  return (
    <div
      style={{
        height: `${String(register.box)}px`,
        // THE FACE IS SET ON THE LINE AND NOT ONLY ON THE WORDS, and the first render of this
        // file is why. The space characters between the words are text nodes on THIS element,
        // not inside the word spans, so with the face only on the spans every space was drawn
        // at the inherited 16px default: "QUEUE UP WITH A" came out as QUEUEUPWITHA and "they
        // play" as theyplay. It is also what makes the laid out line match what `fitText`
        // measured, since that measures one span containing the whole string, spaces and
        // tracking included.
        fontFamily: register.face,
        fontSize: `${String(register.size)}px`,
        lineHeight: `${String(register.box)}px`,
        letterSpacing: register.tracking,
        color: register.color,
        overflow: "hidden",
        whiteSpace: "pre",
      }}
    >
      {words.map((word, wordIndex) => {
        const at =
          delay +
          lineIndex * LINE_GAP +
          cascade(wordIndex, WATERFALL_CUT.entryGap, WATERFALL_CUT.entryDecay);
        const enter = interpolate(frame, [at, at + ENTRY], [0, 1], {
          easing: EASE.power4Out,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const leaveAt =
          exitAt + lineIndex * WATERFALL_CUT.exitLineGap + wordIndex * WATERFALL_CUT.exitStagger;
        const leave = interpolate(frame, [leaveAt, leaveAt + WATERFALL_CUT.exit], [0, 1], {
          easing: EASE.power4In,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const y = (1 - enter) * register.lift - leave * register.lift;
        const opacity =
          Math.min(1, WATERFALL_CUT.ignite + enter * (1 - WATERFALL_CUT.ignite)) *
          (1 - leave) *
          (frame >= at ? 1 : 0);

        return (
          <span key={`${text}-${String(wordIndex)}`}>
            {wordIndex > 0 ? " " : null}
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${y.toFixed(2)}px)`,
                opacity,
              }}
            >
              {word}
            </span>
          </span>
        );
      })}
    </div>
  );
};

/**
 * The block, in its band, carried on the same leftward current as the object below it.
 *
 * It is anchored at its BOTTOM, which is TYPE_BASE, and since the hero is the last line and is
 * one size for the whole film, that anchors the hero's baseline to the pixel on all six beats.
 * The block drifts left on ../ground.ts CRUISE_SPAN exactly as the object does, re-centred so
 * the drift is symmetric about the grid and never accumulates, so the whole frame is one camera
 * move. The current is a distance per beat rather than a rate per frame, and that file states
 * why: at a fixed rate this block's left margin was 83px on the longest beat and 98 on the
 * shortest, which made the margin a function of how long a phrase takes to say. What
 * the words do on top of that is the waterfall, which is a word level texture and not a second
 * seam.
 */
export const Words = ({
  support,
  hero,
  sizes,
  frames,
  delay,
}: {
  /** Already upper cased. Measuring the lower case string and rendering capitals is the same
   * class of bug as measuring in the wrong font. */
  support: string;
  hero: string;
  sizes: FilmType;
  frames: number;
  /** Frames the whole block is advanced by, so the film's opening frame is already composed. */
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const x = cruiseAt(frame, frames);

  const supportRegister: Register = {
    face: SUPPORT_FACE,
    size: sizes.support,
    box: sizes.supportBox,
    tracking: SUPPORT_TRACKING,
    // The label is the app's own light theme volt, which is how the brand renders chartreuse on
    // paper. It is 5.6:1 on this ground, and putting it on the SUPPORT rather than on a word of
    // the hero is deliberate: the hero is already the loudest thing on the frame and colouring
    // it would be a fifth emphasis on the element that needs none, while the support is the
    // line that has to be told apart from a small headline, and colour does that for less ink
    // than any other axis. It also puts brand colour on every frame of the film rather than on
    // one word of six.
    color: INK.accent,
    lift: WATERFALL_ENTRY.normal.lift,
  };
  const heroRegister: Register = {
    face: HERO_FACE,
    size: sizes.hero,
    box: sizes.heroBox,
    tracking: HERO_TRACKING,
    color: INK.type,
    lift: WATERFALL_ENTRY.anchor.lift,
  };

  return (
    <div
      style={{
        position: "absolute",
        left: X0,
        top: TYPE_BASE - sizes.block,
        width: MEASURE,
        height: sizes.block,
        transform: `translateX(${x.toFixed(2)}px)`,
      }}
    >
      <Line
        text={support}
        register={supportRegister}
        lineIndex={0}
        frames={frames}
        delay={delay}
      />
      {/* Air between the registers, and it appears nowhere else in the block. A stack with one
          uniform gap reads as a list of equal things; a stack whose only gap is where the
          register changes reads as two things, which is what it is. */}
      <div style={{ height: `${String(sizes.gap)}px` }} />
      <Line text={hero} register={heroRegister} lineIndex={1} frames={frames} delay={delay} />
    </div>
  );
};
