/**
 * THE SECOND TYPE LAW, and it is a different law rather than a different setting.
 *
 * Directions A and B use the Uber law: the line is laid out centred as a finished string, revealed
 * in place word by word, held, and accelerated out. ClickUp does something else entirely, and
 * measured at f6-f30 it is this:
 *
 *   THE LINE SCROLLS CONTINUOUSLY LEFTWARD. It is never laid out. New words enter from the right,
 *   the current word hovers near the frame centre, and words scroll off the left and are gone.
 *   THE INCOMING WORD IS GREY AND OFF BASELINE, raised or lowered, and it SNAPS to full ink on the
 *   baseline at the moment it becomes the current word.
 *   THE SLIDE CARRIES A HEAVY HORIZONTAL SMEAR, plainly visible at f22.
 *   THE PUNCTUATION IS A CARET AND A SELECTION HIGHLIGHT, red, sweeping left to right across the
 *   key word at f26-f30.
 *
 * The two laws must not be blended, which is why they are two files. Blending them is how nine
 * directions ended up looking like settings of one system.
 *
 * =====================================================================================
 * ONE CONSEQUENCE WORTH STATING: THIS LAW IS SYNCED TO THE READ AND THE OTHER IS NOT
 * =====================================================================================
 *
 * Uber's type builds about 2.5 times faster than its voice and then waits, so the build is a
 * flourish. A continuous scroll cannot wait: it either keeps moving or it stops, and a scroll that
 * stops is a layout. So the scroll advances one word per (window / words) frames, which at this
 * read is 12 frames a word on beat one and 14 on beat four - almost exactly the measured 171 and
 * 157 words per minute. The current word IS the spoken word, which is a property this direction
 * gets for free and the other two deliberately do not have.
 *
 * The scroll also does not stop at a beat boundary. Each beat's row keeps advancing for twelve
 * frames past its own window while the next row's first word is already entering from the right,
 * so the seam between two sentences is a wave rather than a cut. That is the whole reason ClickUp
 * cuts once in 18.6 seconds.
 */
import { measureText } from "@remotion/layout-utils";
import { interpolate } from "remotion";

import { CENTRE_X, INK, TYPE, TYPE_Y } from "../ground";
import { EASE, ramp } from "../motion";
import { SmearDef, smearFilter } from "../Smear";
import { DISPLAY } from "../type";

/** One size for the whole scroll, because a scrolling line has no measure to be fitted to: its
 * width is the sentence's, not the frame's. 116px puts two words on the frame at once, which is
 * what the reference holds. */
export const SCROLL_SIZE = 116;
const GAP = 46;

/** How far off the baseline an incoming word sits before it snaps. Alternating, so the incoming
 * stream reads as a wave rather than as a queue. */
const OFF_BASELINE = 26;

/** The smear, as stdDeviation per pixel of per-frame travel. The row is one element and the
 * filter goes on the row, never on the words: blurring children individually produces a different
 * picture at every seam between them. */
const SMEAR_PER_PX = 0.42;
const SMEAR_MAX = 26;

interface Placed {
  text: string;
  key: boolean;
  x: number;
  width: number;
  centre: number;
}

const place = (words: readonly string[], key: string | undefined): Placed[] => {
  let x = 0;
  return words.map((text) => {
    const { width } = measureText({
      text,
      fontFamily: DISPLAY,
      fontSize: SCROLL_SIZE,
      fontWeight: 800,
      letterSpacing: TYPE.tracking,
      validateFontIsLoaded: true,
    });
    const at = x;
    x += width + GAP;
    return {
      text,
      key:
        key !== undefined && text.toLowerCase().replace(/[^a-z0-9+]/g, "") === key.toLowerCase(),
      x: at,
      width,
      centre: at + width / 2,
    };
  });
};

/** Where the row sits so that word `u` is centred, for a real-valued u. */
const offsetAt = (placed: readonly Placed[], u: number): number => {
  const i = Math.floor(u);
  const f = u - i;
  const a = placed[Math.max(0, Math.min(placed.length - 1, i))]?.centre ?? 0;
  const b = placed[Math.max(0, Math.min(placed.length - 1, i + 1))]?.centre ?? a;
  const span = placed.length > 1 ? (placed[placed.length - 1]?.centre ?? 0) : 0;
  // Outside the row, keep travelling at the row's own average rate rather than stopping, which is
  // what lets one sentence hand over to the next without either of them parking.
  const mean = placed.length > 1 ? span / (placed.length - 1) : 400;
  if (i < 0) {
    return CENTRE_X - (a + u * mean);
  }
  if (i >= placed.length - 1) {
    return CENTRE_X - (a + f * mean);
  }
  return CENTRE_X - (a + (b - a) * f);
};

export const Scroller = ({
  words,
  keyWord,
  frame,
  window,
  name,
}: {
  words: readonly string[];
  keyWord: string | undefined;
  /** Frames since this row's beat began. It runs past `window`, which is the handover. */
  frame: number;
  window: number;
  name: string;
}) => {
  const placed = place(words, keyWord);
  const n = placed.length;

  // The row starts with word zero just off the right of centre and ends with the last word just
  // past it, so the sentence is entering on its first frame and leaving on its last.
  const u = interpolate(frame, [0, window], [-0.55, n - 0.45], { extrapolateRight: "extend" });
  const x = offsetAt(placed, u);
  const velocity = x - offsetAt(placed, interpolate(frame - 1, [0, window], [-0.55, n - 0.45], { extrapolateRight: "extend" }));
  const smear = Math.min(SMEAR_MAX, Math.abs(velocity) * SMEAR_PER_PX);

  return (
    <>
      <SmearDef name={name} x={smear} y={0} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: Math.round(TYPE_Y - SCROLL_SIZE * 0.72),
          height: Math.round(SCROLL_SIZE * 1.44),
          width: 1,
          whiteSpace: "nowrap",
          transform: `translateX(${x.toFixed(2)}px)`,
          filter: smearFilter(name, smear, 0),
        }}
      >
        {placed.map((word, index) => {
          // How far this word is from being the current one. Positive is still to come.
          const d = index - u;
          if (d > 2.4 || d < -1.9) {
            return null;
          }
          // The snap: grey and off baseline until it is nearly current, then full ink on the line
          // over about a third of a word's time. Not a fade - a snap, which is why it is a narrow
          // ramp rather than a long one.
          const snap = ramp(d, 0.85, 0.3, 0, 1, EASE.cubicOut);
          const gone = ramp(d, -0.7, -1.7, 1, 0, EASE.cubicIn);
          const arriving = ramp(d, 2.4, 1.5, 0, 1, EASE.cubicOut);
          const lift = (index % 2 === 0 ? -1 : 1) * OFF_BASELINE * (1 - snap);
          const current = d > -0.55 && d < 0.5;
          const sweep = word.key ? ramp(d, 0.45, -0.1, 0, 1, EASE.quartOut) : 0;

          return (
            <div
              key={`${word.text}-${String(index)}`}
              style={{
                position: "absolute",
                left: Math.round(word.x),
                top: 0,
                transform: `translateY(${lift.toFixed(1)}px)`,
                opacity: arriving * gone,
              }}
            >
              {/* The selection highlight, sweeping left to right across the accent word, with the
                  caret riding its leading edge. ClickUp does this in red on white: a saturated
                  block stamped onto the paper, which needs a silhouette to read as a block at all.
                  A volt fill has about 1.4:1 here and would have none, so the block is the app's
                  own off-black and the word inside it turns RAW CHARTREUSE. That is the film's one
                  frame of #CDFF3D outside a fragment, and it is legal for the reason section 2 of
                  ../ground gives: it is on a dark slab, at about 13:1. */}
              {sweep > 0 ? (
                <>
                  <div
                    style={{
                      position: "absolute",
                      left: -12,
                      top: Math.round(SCROLL_SIZE * 0.16),
                      width: Math.round((word.width + 24) * sweep),
                      height: Math.round(SCROLL_SIZE * 1.06),
                      backgroundColor: INK.app,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: Math.round(-12 + (word.width + 24) * sweep),
                      top: Math.round(SCROLL_SIZE * 0.1),
                      width: 7,
                      height: Math.round(SCROLL_SIZE * 1.18),
                      backgroundColor: INK.app,
                      opacity: sweep < 1 ? 1 : 0,
                    }}
                  />
                </>
              ) : null}
              <div
                style={{
                  position: "relative",
                  fontFamily: DISPLAY,
                  fontWeight: 800,
                  fontSize: `${String(SCROLL_SIZE)}px`,
                  lineHeight: `${String(Math.round(SCROLL_SIZE * 1.44))}px`,
                  letterSpacing: TYPE.tracking,
                  // Grey until it is current, then ink; and raw chartreuse once the off-black
                  // highlight is under it, because the film's own near-black ink on an off-black
                  // slab is nothing at all. The grey is the app's light-theme muted, at the same
                  // two-stage alpha the dark cut used with the dark-theme one.
                  color:
                    sweep > 0.5
                      ? INK.brand
                      : current
                        ? INK.type
                        : `rgba(92,100,80,${(0.34 + 0.5 * snap).toFixed(3)})`,
                  whiteSpace: "pre",
                }}
              >
                {word.text}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
