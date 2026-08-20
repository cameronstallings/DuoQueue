/**
 * The display type, and the seam it rides.
 *
 * Every word is an inline block that moves on ONE axis, x, in ONE direction, left, because
 * that is the film's current. There is no per word spring, no rotation, no scale and no blur.
 * Direction B had all four and that is precisely why its cuts read as unmatched: a spring
 * starts from rest, and the doctrine's whole argument is that starting from rest after a cut
 * is a dead beat. The character that B got from bouncing every word individually is bought
 * back here by the fitted type, the block tilt, and the wave itself.
 *
 * TECHNIQUE 4, THE WATERFALL CUT, is what happens at a text to text seam. The outgoing words
 * peel off one after another on power4.in, each fading out by about a quarter of its travel;
 * the incoming words cascade in on power4.out from the same direction, igniting at 0.35
 * opacity already mid path. The two are the halves of one power4.inOut split at the cut, so
 * the first incoming word's initial velocity is the last outgoing word's final velocity.
 *
 * The timing that makes it work, and the thing worth reading twice: the exit chain is placed
 * so the LAST word's opacity reaches zero on the cut frame itself, not before it. A word that
 * finished fading four frames early leaves a gap where nothing moves, and a gap where nothing
 * moves is what the eye reads as a stop. So the chain is scheduled backwards from the cut
 * rather than forwards from a hold.
 *
 * TWO CLOCKS, NOT ONE. There is a stagger and there is a staging, and conflating them is what
 * made the first render a slideshow. The stagger is the wave inside one arrival: about 0.2s,
 * capped by the doctrine at 500ms, and it is what makes a line land as a cascade instead of
 * as a block. The staging is the beat's story: which line is held back and when it is paid
 * off, and it spans the whole beat on purpose. The reveal array is the staging and cascade()
 * is the stagger. A beat with no staging composes in half a second and then waits, which is
 * banned thing however good its cascade is.
 *
 * The exit staggers by LINE as well as by word, and the line gap is roughly four times the
 * word gap. A stacked block staggered only by word comes apart over two frames and reads as
 * one thing fading; staggered by line, the top line is a third of the way gone before the
 * bottom line moves, and the block visibly peels.
 */
import { Fragment } from "react";

import { interpolate, useCurrentFrame } from "remotion";

import { cascade, CURRENT, EASE, TRAVEL, WATERFALL_CUT } from "./motion";
import { K, LEADING, TRACKING } from "./skin";
import { DISPLAY_FACE } from "./type-fit";

/**
 * Frames the accent slab takes to wipe across its word.
 *
 * Six rather than five, because the slab is now also used as a staged EVENT on a word that is
 * already the accent colour, and under a five frame wipe the crossfade to the black ink left
 * about two frames in which the leading part of the word was vermillion on vermillion.
 */
const SLAB_WIPE = 6;

export type WordEntry =
  /**
   * The waterfall cut's incoming half: cascade in from the right, igniting mid path. The
   * opening beat uses this too and gets its head start from NEGATIVE reveal offsets in the
   * script rather than from a special case here, which is one fewer rule and puts the
   * decision next to the copy it applies to.
   */
  | "waterfall"
  /**
   * No entrance at all. The arrival beat composes inside its retracting wrapper, because the
   * inverse zoom's sign discipline forbids a grow from small entrance in the seam window and
   * an x cascade under a z retraction is two axes at one cut.
   */
  | "composed";

interface WordProps {
  text: string;
  /** Local frame this word's entrance begins. Negative on the opening beat. */
  entryAt: number;
  /** Local frame this word's exit begins. null when the block handles the exit. */
  exitAt: number | null;
  entry: WordEntry;
  color: string;
  /** Ink the word flips to once the slab has passed under it. */
  slabColor?: string;
  /** Local frame the accent slab starts wiping. */
  slabAt?: number;
  /** Renders the word's box but not its ink, so a second pass can paint only the slabs while
   * staying in exact register with the first. See `only` on WordsProps. */
  ghost?: boolean;
}

const Word = ({ text, entryAt, exitAt, entry, color, slabColor, slabAt, ghost }: WordProps) => {
  const frame = useCurrentFrame();

  // Entry. Leftward means the incoming waits to the RIGHT of home and continues left into it,
  // which is the same direction the outgoing just left in. The clamp on both ends is what
  // pre-sets the word off frame before its turn without a separate build step.
  const entryX =
    entry === "composed"
      ? 0
      : interpolate(frame, [entryAt, entryAt + WATERFALL_CUT.entry], [-CURRENT * TRAVEL, 0], {
          easing: EASE.power4Out,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // Ignition, not a fade up. Zero until its turn, then straight to 0.35 and up: a binary 0 to
  // 1 pops, and a slow ramp from 0 reads as an arrival rather than as continued travel.
  const entryOpacity =
    entry === "composed"
      ? 1
      : frame < entryAt
        ? 0
        : interpolate(
            frame,
            [entryAt, entryAt + WATERFALL_CUT.entry * 0.4],
            [WATERFALL_CUT.ignite, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

  // Exit. Mirrored ease, same distance, same direction: the acceleration IS the cut.
  const exitX =
    exitAt === null
      ? 0
      : interpolate(frame, [exitAt, exitAt + WATERFALL_CUT.exit], [0, CURRENT * TRAVEL], {
          easing: EASE.power4In,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // The fade trick. Linear rather than eased, and finished at about a quarter of the travel,
  // so the word is gone while it is still accelerating and never smears across the frame.
  const exitOpacity =
    exitAt === null
      ? 1
      : interpolate(frame, [exitAt, exitAt + WATERFALL_CUT.exitFade], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  const wipeAt = slabAt ?? entryAt;
  const wipe =
    slabColor === undefined
      ? 0
      : interpolate(frame, [wipeAt, wipeAt + SLAB_WIPE], [0, 1], {
          easing: EASE.power4Out,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  // The ink flips a beat after the wipe's leading edge has passed, crossfaded rather than
  // switched. A slabbed word is near black, so for however long the slab is still travelling
  // the part of the word past its edge would be black on black; direction B lost half of DUO
  // for a quarter second to exactly that. Crossfading the two inks under the moving edge is
  // invisible and cannot lose a letter.
  const flip =
    slabColor === undefined
      ? 0
      : interpolate(frame, [wipeAt + SLAB_WIPE * 0.3, wipeAt + SLAB_WIPE], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        opacity: entryOpacity * exitOpacity,
        transform: `translateX(${(entryX + exitX).toFixed(2)}px)`,
      }}
    >
      {slabColor !== undefined ? (
        // Absolutely positioned, so it paints behind the word without adding a pixel to the
        // line's layout width. A padded background would widen the line past the size fitText
        // measured and the line would overhang the frame.
        <span
          style={{
            position: "absolute",
            inset: "0.06em -0.045em 0.1em -0.045em",
            backgroundColor: slabColor,
            transformOrigin: "0% 50%",
            transform: `scaleX(${wipe.toFixed(4)})`,
          }}
        />
      ) : null}
      <span
        style={{
          position: "relative",
          color: ghost === true ? "transparent" : color,
          opacity: 1 - flip,
        }}
      >
        {text}
      </span>
      {slabColor !== undefined ? (
        <span style={{ position: "absolute", left: 0, top: 0, color: K.onHot, opacity: flip }}>
          {text}
        </span>
      ) : null}
    </span>
  );
};

export interface WordsProps {
  /** House voice copy, one entry per rendered line. Uppercased here. */
  lines: string[];
  /** One fitted size per line, from fitStack(). */
  sizes: number[];
  /** Local frame each line's cascade begins. One per line; missing entries mean frame 0.
   * This is the beat's staging, and it is what owns the phase between entry and exit. */
  reveal?: number[];
  accent?: string[];
  slab?: string[];
  align: "center" | "left";
  /** Base ink for words that are neither accented nor slabbed. */
  ink: string;
  /** Ink for accented words. On a flooded frame the accent IS the field, so the beat passes
   * the same ink for both and the accent stops meaning anything, which is correct. */
  accentInk: string;
  entry: WordEntry;
  /**
   * The beat's own length. The exit chain is scheduled backwards from it so the last word
   * dies exactly on the cut. Pass null when the block handles the exit, which is the case for
   * the inverse zoom and for the final boundary into the end card.
   */
  cutAt: number | null;
  /** Local frame the accent slab wipes. Defaults to each slabbed word's own entrance. */
  slabAt?: number;
  /**
   * Renders ONLY the slabbed words, with every other word present but inkless.
   *
   * This exists for the knockout treatment, where the plate is multiplied over the whole type
   * layer to make the letterforms a window. A slab caught in that multiply comes out as a
   * muddy red rectangle with the app's own card copy showing through it and its black text
   * invisible, which is what the payoff beat looked like on the first render. So a knockout
   * beat draws the type twice: once inside the multiply for the letterforms, and once above it
   * for the slab alone. The layout is identical in both passes, so the two stay in exact
   * register frame for frame without a shared measurement.
   */
  only?: "slab";
}

export const Words = ({
  lines,
  sizes,
  reveal,
  accent = [],
  slab = [],
  align,
  ink,
  accentInk,
  entry,
  cutAt,
  slabAt,
  only,
}: WordsProps) => {
  const upper = lines.map((line) => line.toUpperCase());
  const accentSet = new Set(accent.map((word) => word.toUpperCase()));
  const slabSet = new Set(slab.map((word) => word.toUpperCase()));

  const words = upper.map((line) => line.split(" "));
  const lastLine = words.length - 1;

  // Scheduled backwards from the cut so the LAST word of the LAST line dies exactly on it.
  // Everything above peels ahead of it a line at a time, so the block comes apart in reading
  // order rather than sliding off as one slab. A gap where nothing moves before a cut is
  // what the eye reads as a stop, which is the whole reason this is computed from the end.
  const exitBegin =
    cutAt === null
      ? null
      : cutAt -
        WATERFALL_CUT.exitFade -
        WATERFALL_CUT.exitLineGap * lastLine -
        WATERFALL_CUT.exitStagger * ((words[lastLine]?.length ?? 1) - 1);

  return (
    <div style={{ width: "100%", textAlign: align }}>
      {words.map((line, lineIndex) => {
        const fontSize = sizes[lineIndex] ?? 0;
        // The staging. Each line is its own arrival with its own cascade inside it, which is
        // a staged reveal rather than one long stagger: the doctrine caps a stagger at 500ms
        // and says nothing against holding a content group back and paying it off later,
        // which is the route it names for a beat with more than one group in it.
        const revealAt = reveal?.[lineIndex] ?? 0;
        return (
          <div
            key={line.join(" ") + String(lineIndex)}
            style={{
              fontFamily: DISPLAY_FACE,
              fontSize: `${String(fontSize)}px`,
              lineHeight: `${String(Math.round(fontSize * LEADING))}px`,
              letterSpacing: TRACKING,
              // The words are inline blocks separated by real space characters, which is what
              // makes the rendered width equal the width fitText measured. `pre` stops those
              // spaces collapsing across the JSX line breaks.
              whiteSpace: "pre",
            }}
          >
            {line.map((word, wordIndex) => {
              const isSlab = slabSet.has(word);
              const entryAt =
                revealAt +
                cascade(wordIndex, WATERFALL_CUT.entryGap, WATERFALL_CUT.entryDecay);
              return (
                <Fragment key={word + String(wordIndex)}>
                  {wordIndex > 0 ? " " : null}
                  <Word
                    text={word}
                    entryAt={entryAt}
                    exitAt={
                      exitBegin === null
                        ? null
                        : exitBegin +
                          WATERFALL_CUT.exitLineGap * lineIndex +
                          WATERFALL_CUT.exitStagger * wordIndex
                    }
                    entry={entry}
                    color={accentSet.has(word) ? accentInk : ink}
                    slabColor={isSlab ? K.hot : undefined}
                    slabAt={isSlab ? slabAt : undefined}
                    ghost={only === "slab" && !isSlab}
                  />
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
