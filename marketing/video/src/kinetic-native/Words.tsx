/**
 * The display type, in two registers, and the seam it rides.
 *
 * TWO REGISTERS. Every beat is one HERO line and its SUPPORT, and the two are separated on
 * three axes at once: size (about 3x), weight (Manrope ExtraBold against Manrope Medium) and
 * tracking (-0.035em against +0.08em). The sizes come from ./type-fit, which explains why the
 * previous version, where every line was ExtraBold and fitted to the full frame width, had no
 * hierarchy at all and assigned what little it had by how many letters a word happens to have.
 * This file's job is to render that decision and to move it.
 *
 * Every word is an inline block that moves on ONE axis, x, in ONE direction, left, because
 * that is the film's current. There is no per word spring, no rotation, no scale and no blur.
 * Direction B had all four and that is precisely why its cuts read as unmatched: a spring
 * starts from rest, and the doctrine's whole argument is that starting from rest after a cut
 * is a dead beat.
 *
 * TECHNIQUE 4, THE WATERFALL CUT, is what happens at a text to text seam. The outgoing words
 * peel off one after another on power4.in, each fading out by about half its travel; the
 * incoming words cascade in on power4.out from the same direction, igniting at 0.35 opacity
 * already mid path. The two are the halves of one power4.inOut split at the cut, so the first
 * incoming word's initial velocity is the last outgoing word's final velocity.
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
 * is the stagger. A beat with no staging composes in half a second and then waits, which is a
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
import { baselineIn, FACE, K, SUPPORT_TRACKING, TRACKING } from "./skin";
import { DISPLAY_FACE, SUPPORT_FACE, type FittedLine } from "./type-fit";

/**
 * Frames the accent slab takes to wipe across its word.
 *
 * Eight rather than six. The slab is one of the film's two stamps and the note on the last cut
 * was that it should feel more polished and smoother; a stamp that crosses its word in a fifth
 * of a second is a flicker, and one that takes a quarter is a gesture. It is still fast enough
 * that its leading edge crosses the word inside the syllable the word is spoken on.
 */
const SLAB_WIPE = 8;

/**
 * THE SLAB'S EDGES, and they are computed rather than typed.
 *
 * They used to be a fixed `inset: 0.06em -0.045em 0.1em -0.045em`, which is an inset from the
 * LINE BOX. At these leadings the baseline sits above the bottom of that box, so a 0.1em bottom
 * inset put the slab's lower edge above the baseline and cut the bottom tenth off every letter
 * it was supposed to be behind. On the film's last and largest word that turned DUO into a red
 * bar with three holes in it, and at feed size it stopped being a word at all.
 *
 * So the field is placed from the baseline, which is where the letters actually are: SLAB_PAD
 * of field above the cap and the same below the baseline. All caps, so the descender is not in
 * this sum; the pad covers the O's baseline overshoot. See FACE in ./skin.
 *
 * It is computed from the LINE'S OWN leading rather than from a module constant, because there
 * are two leadings in this direction now and a slab that assumed the hero's would cut a
 * support line's letters the moment anybody slabbed one.
 */
const SLAB_PAD = 0.05;
/** Sideways, so the field has a margin on the first and last letter without widening the
 * line: the slab is absolutely positioned and adds no layout width. */
const SLAB_SIDE = -0.045;

const slabInset = (leading: number): string => {
  const baseline = baselineIn(leading);
  /** Distance from the top of the line box down to the top of the slab. */
  const top = baseline - FACE.cap - SLAB_PAD;
  /** Inset from the BOTTOM of the line box, and negative where the slab has to reach past the
   * box to get below the baseline. */
  const bottom = leading - baseline - SLAB_PAD;
  return `${top.toFixed(4)}em ${SLAB_SIDE.toFixed(4)}em ${bottom.toFixed(4)}em ${SLAB_SIDE.toFixed(4)}em`;
};

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
  /** The line's leading, so a slab can find the baseline. */
  leading: number;
  /** Ink the word flips to once the slab has passed under it. */
  slabColor?: string;
  /** Local frame the accent slab starts wiping. */
  slabAt?: number;
}

const Word = ({
  text,
  entryAt,
  exitAt,
  entry,
  color,
  leading,
  slabColor,
  slabAt,
}: WordProps) => {
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

  // The fade trick. Linear rather than eased, and finished at about half of the travel, so the
  // word is gone while it is still accelerating and never smears across the frame.
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
        // measured and the line would overhang its measure.
        <span
          style={{
            position: "absolute",
            inset: slabInset(leading),
            backgroundColor: slabColor,
            transformOrigin: "0% 50%",
            transform: `scaleX(${wipe.toFixed(4)})`,
          }}
        />
      ) : null}
      <span
        style={{
          position: "relative",
          color,
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
  /** One typeset line per entry, from fitStack(): size, register, leading and the air above. */
  fitted: FittedLine[];
  /** Local frame each line's cascade begins. One per line; missing entries mean frame 0.
   * This is the beat's staging, and it is what owns the phase between entry and exit. */
  reveal?: number[];
  accent?: string[];
  slab?: string[];
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
}

export const Words = ({
  lines,
  fitted,
  reveal,
  accent = [],
  slab = [],
  ink,
  accentInk,
  entry,
  cutAt,
  slabAt,
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
    // Centred, always. The block has ONE measure now (see ./type-fit) and no line is wider
    // than the hero's, so centring is what puts the leftover air on both sides instead of
    // parking all of it on the right, which reads as unbalanced rather than as deliberate.
    <div style={{ width: "100%", textAlign: "center" }}>
      {words.map((line, lineIndex) => {
        const laid = fitted[lineIndex];
        const fontSize = laid?.size ?? 0;
        const leading = laid?.leading ?? 1;
        const isHero = laid?.role === "hero";
        // The staging. Each line is its own arrival with its own cascade inside it, which is
        // a staged reveal rather than one long stagger: the doctrine caps a stagger at 500ms
        // and says nothing against holding a content group back and paying it off later,
        // which is the route it names for a beat with more than one group in it.
        const revealAt = reveal?.[lineIndex] ?? 0;
        return (
          <div
            key={line.join(" ") + String(lineIndex)}
            style={{
              fontFamily: isHero ? DISPLAY_FACE : SUPPORT_FACE,
              fontSize: `${String(fontSize)}px`,
              lineHeight: `${String(Math.round(fontSize * leading))}px`,
              letterSpacing: isHero ? TRACKING : SUPPORT_TRACKING,
              // The air between the registers, and only between them. See REGISTER_GAP.
              marginTop: `${String(laid?.spaceAbove ?? 0)}px`,
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
                    leading={leading}
                    slabColor={isSlab ? K.hot : undefined}
                    slabAt={isSlab ? slabAt : undefined}
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
