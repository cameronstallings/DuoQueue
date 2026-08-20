/**
 * DIRECTION B+A, "kinetic native". The combined direction, assembled. FOURTH CUT.
 *
 * Base is B, kinetic type, because that is the one Cameron picked: display type leading with
 * the claim, legible at thumbnail size, the hook present in frame one.
 * Combined into it is A's treatment, a small caption rail low in the frame revealed word by
 * word with one keyword in the accent, composited as an OVERLAY on top of the film rather than
 * as a band the layout makes room for.
 *
 * Governed throughout by the motion doctrine and the cut-the-curve catalog. The doctrine is
 * written for a timeline runtime; this is Remotion, which is frame based, so the principles and
 * parameters carry over and the API does not. That translation is done once, in motion.ts, and
 * nowhere else.
 *
 * =====================================================================================
 * THE FOURTH CUT
 * =====================================================================================
 *
 * The third cut ran 10.93s and was correct in every measurable way. The three notes on it were
 * that it talks too fast and feels rushed, that the words are too big and it feels cheap, and
 * that it should be more polished and smooth. None of them is a defect report; all three are
 * the same complaint from different angles, which is that the film had no hierarchy and no air.
 *
 *   THE TYPE          one HERO per beat at display scale, everything else at about a third of
 *                     it in Manrope Medium tracked open, and the hero fitted to a FRACTION of
 *                     the safe box so the frame has 212px of margin a side instead of 72px.
 *                     The old system fitted every line to the full width, which is why a
 *                     three letter function word was the largest thing on the opening frame.
 *                     See ./type-fit for the whole argument.
 *   THE PACE          20 words instead of 25, read at 0.9 instead of 1, with 0.60s of silence
 *                     between statements instead of 0.27s. Longer by 1.27s and saying less.
 *   THE MOTION        every duration in ./motion about a quarter longer, and the dramatic
 *                     comma before the payoff at 0.63s instead of 0.40s. Nothing anywhere
 *                     floats or breathes: the doctrine bans idle motion outright and the fix
 *                     for "smooth" is duration, not drift.
 *   THE ACCENT        one highlighter in the rail instead of two, no display accent on any
 *                     beat that is not also slabbed, and the highlighter moved to the one beat
 *                     with no other red on the frame. Fewer, larger gestures.
 *
 * Two files come out of this file, and they differ in ONE number: `typeScale`. See ./register.
 *
 * =====================================================================================
 * THE SEAM PLAN
 * =====================================================================================
 *
 * CURRENT: LEFT. The house default, and this film's, chosen once and kept. Every ordinary
 * boundary uses it. Nothing mirrors it, because two consecutive seams in opposing directions
 * read as an error rather than as variety.
 *
 * TRANSITION VOCABULARY: two inter-scene techniques and one text technique, repeated.
 *   - cut the curve (technique 3), the default boundary, in the current's direction
 *   - inverse zoom through (technique 2), RESERVED, spent exactly once on the arrival
 *   - the waterfall cut (technique 4), which is cut the curve at word granularity and which
 *     the catalog says does not count against the two-to-three budget
 * There is no crossfade anywhere: a crossfade has no carrier at all.
 *
 * CARRIERS: at a text seam the carrier is the word group itself, peeling out and cascading in
 * on one continuous wave. Under it the carrier is the CAMERA, and no plate in this film is
 * stationary at any seam: a live plate pans left at 4.4px per frame and pushes in at 0.0034
 * scale per frame, and an app plate, which has no horizontal headroom to pan into, runs the
 * same push for the whole beat with the pan taken out. The reasons are in Plate.tsx.
 *
 *  seam  cut@  technique          exit vector                       entry vector
 *  ----  ----  -----------------  --------------------------------  --------------------------------
 *  S0       0  none, film opens   n/a                               beat 1 is ALREADY IN FLIGHT at
 *                                                                   frame 0: all three lines placed,
 *                                                                   the last of them 4 frames into
 *                                                                   an 11 frame power4.out at 83% of
 *                                                                   its travel and 94% opacity. The
 *                                                                   first frame carries the WHOLE
 *                                                                   hook, over a sunlit map, and is
 *                                                                   visibly moving while it does.
 *  S1      66  waterfall cut      x, LEFT. words peel on            x, LEFT. words cascade from
 *  S2     117  waterfall cut      power4.in over 130px, lines       +130px on power4.out, igniting
 *  S3     180  waterfall cut      staggered 3.3f and words 0.66f    at 0.35 opacity mid path,
 *  S5     284  waterfall cut      inside them, opacity dead at      gaps 1.95f decaying x0.84.
 *                                 ~50% of travel. The chain is      Under it the plate hard cuts
 *                                 scheduled BACKWARDS so the        with matched camera velocity.
 *                                 last word dies ON the cut.
 *
 *  S4     232  INVERSE ZOOM       Z, PULL. beat 4 recedes 1 to      Z, PULL. beat 5 arrives
 *              (reserved)         0.8 on power3.in over 8f,         OVERSIZED at 1.25 and retracts
 *                                 blur 0 to 10px, opacity on        on expo.out over 19f, blur 10
 *                                 its own linear tween to 0.15.     to 0, opacity 0.15 to 1. Its
 *                                 Everything SHRINKS.               words are COMPOSED, not
 *                                                                   cascaded: a grow-from-small
 *                                                                   entrance here would flip the
 *                                                                   scale sign and turn the
 *                                                                   arrival into a push. Its
 *                                                                   plate is held still for the
 *                                                                   same reason, until frame 13.
 *                                 Why here and only here: the reserved backward-Z means ARRIVAL,
 *                                 something bigger landing. What lands is the product, on the
 *                                 frame it says DUO LOCKED.
 *
 *  S6     336  cut the curve      x, LEFT. the chat BLOCK           x, LEFT. the end card enters
 *                                 accelerates 130px on power4.in    from +130px on power4.out over
 *                                 from frame 322, which is the      10f at 0.35 opacity, composed
 *                                 frame the read ends on. Its       rather than assembling itself.
 *                                 opacity lands ON the boundary
 *                                 rather than before it.
 *                                 The current is returned to immediately after the reserved
 *                                 spend, which is S5, and held to the end.
 *
 * STILLNESS BEFORE CLIMAX: beat 4's second line settles at local frame 22 and its camera parks
 * at 25, and its receding exit begins at 44. The composition therefore holds unchanged for 19
 * frames, 0.633s, at the top of the doctrine's 0.3 to 0.75s window and half again what the last
 * cut held. That pause is the dramatic comma between the major action and its result, and it is
 * the only held stretch in the film. It is also why the flood sits fourth rather than third
 * even though "no faces" reads well straight after the deck: the comma is only worth anything
 * immediately before the payoff.
 *
 * NO IDLE WOBBLE, AND NO DEAD AIR EITHER. Every beat's held phase is owned by a named
 * sustained-motion route, and no beat is allowed to coast on a stationary plate:
 *
 *   beat 1  STAGED REVEAL      the three lines land across frames -11 to 7, so the hook is whole
 *           + camera path      in frame 0 and still arriving; the slab is stamped under NOT at
 *                              24. Under it the map travels for the whole beat.
 *   beat 2  SEQUENCED UI LIFE  the deck is swiped mid beat and the next card arrives, and the
 *           + staged reveal    plate pushes under it from the first frame to the last.
 *           + camera path
 *   beat 3  STAGED REVEAL      three lines land ON their own words at 0, 19 and 25, over one
 *           + camera path      unbroken 2.1s shot of a firefight. All three offsets are measured
 *                              off the read's RMS envelope, not estimated.
 *   beat 4  STAGED REVEAL      FACES paid off at 11, then the deliberate stillness above.
 *   beat 5  ANIMATED SEQUENCE  the app arrives oversized and retracts into the focal plane, the
 *                              slab wipes under DUO at 20 with its leading edge crossing the
 *                              word as the word is said, and the plate pushes from 13 to the
 *                              cut.
 *   beat 6  SEQUENCED UI LIFE  a message is sent and its bubble arrives, under two lines that
 *           + staged reveal    land on their own words at 0 and 14.
 *
 * The doctrine's test is to pause at any second and find something meaningful mid flight.
 *
 * =====================================================================================
 *
 * This sits beside `compositions/Post.tsx` rather than replacing it. Nothing in the shipping
 * pipeline imports anything under src/kinetic-native/: `render-day` selects the composition
 * called `Post` by id, the four formats still render, and `pnpm video:day` is untouched. The
 * only shared code is the clip table, the frame scale, the font loader and the brand mark.
 *
 * Each beat is its own Sequence for two reasons beyond tidiness. The clock restarts at zero
 * inside one, so a beat times its seams against its own length and never has to know where it
 * sits in the cut. And the footage unmounts on the cut, so OffthreadVideo decodes one source
 * frame per frame that is actually seen.
 */
import { AbsoluteFill, Sequence } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";

import { Beat, type SeamIn, type SeamOut } from "./Beat";
import { EndCard } from "./EndCard";
import { Rail } from "./Rail";
import { bodyFrames, END_FRAMES, type KineticNativeScript } from "./script";
import { K, TYPE_SCALE } from "./skin";

export type KineticNativeProps = {
  script: KineticNativeScript;
  cta: Cta;
  /**
   * Fraction of the safe box width the HERO line of every beat is fitted to, and the ONE
   * number the two delivered cuts differ by.
   *
   * It is a prop rather than a constant because the note that produced this cut was about
   * size, and size is the one thing that cannot be chosen from prose. Two compositions are
   * registered (see ./register.tsx) whose defaultProps differ here and nowhere else, so the
   * pair a viewer compares is guaranteed to be the same film at two sizes rather than two
   * films. See TYPE_SCALE in ./skin.
   */
  typeScale?: number;
};

/**
 * The seam each boundary gets, derived from the data rather than typed twice.
 *
 * The rule is short enough to read in one line: the beat that declares itself the arrival
 * enters on the inverse zoom, the beat before it therefore exits on the matching recession,
 * the last beat exits on a block level cut the curve into the end card, and everything else is
 * the waterfall cut. Deriving it is what stops a retimed script leaving an exit and an entry
 * pointing in different directions, which the doctrine treats as a plan bug rather than as
 * something to fix with easing.
 */
const seamsFor = (script: KineticNativeScript, index: number): { in: SeamIn; out: SeamOut } => {
  const beat = script.beats[index];
  const next = script.beats[index + 1];
  return {
    in: index === 0 ? "open" : beat?.arrival === true ? "inverse" : "waterfall",
    out: next === undefined ? "curve" : next.arrival === true ? "inverse" : "waterfall",
  };
};

export const KineticNative = ({ script, cta, typeScale = TYPE_SCALE.a }: KineticNativeProps) => {
  const body = bodyFrames(script);
  const cues = script.cues.reduce((total, cue) => total + cue.frames, 0);

  // The two tracks share one clock, and a rail that runs short goes blank under the last beat
  // while a rail that runs long is silently clipped. Both are invisible in Studio until the
  // render is watched, so the mismatch fails here instead, loudly, the way Root.tsx already
  // fails on a preview naming a hook that does not exist.
  if (cues !== body) {
    throw new Error(
      `kinetic-native: the rail is ${String(cues)} frames and the beats are ${String(body)}. They run on one clock and must sum to the same number.`,
    );
  }

  let at = 0;

  return (
    // The opaque stage ground. A mid-window cut opens a moment whose summed opacity is under
    // 1, and an unpainted root flashes white through it, which on a near-black film is the
    // most visible render fault there is.
    <AbsoluteFill style={{ backgroundColor: K.ink }}>
      {/* One track over the whole film, outside every Sequence, because it is neither a beat
          nor the end card. It reads this film's own display type back: see ./vo.ts. */}
      <Soundtrack id={script.id} />
      <Sequence durationInFrames={body} name="body">
        {script.beats.map((beat, index) => {
          const from = at;
          at += beat.frames;
          const seam = seamsFor(script, index);
          return (
            <Sequence
              key={`${script.id}-${String(index)}`}
              from={from}
              durationInFrames={beat.frames}
              name={`beat ${String(index + 1)}: ${beat.lines.join(" ")}`}
            >
              <Beat beat={beat} seamIn={seam.in} seamOut={seam.out} typeScale={typeScale} />
            </Sequence>
          );
        })}
        {/* Outside every beat, so the rail does not slide with a cut or scale with the inverse
            zoom. That is what makes it an overlay rather than part of a scene. */}
        <Rail cues={script.cues} />
      </Sequence>
      <Sequence from={body} durationInFrames={END_FRAMES} name="end card">
        <EndCard cta={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
