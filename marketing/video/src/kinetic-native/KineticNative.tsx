/**
 * DIRECTION B+A, "kinetic native". The combined direction, assembled.
 *
 * Base is B, kinetic type, because that is the one Cameron picked: huge fitted type filling
 * the frame, leading with the claim, legible at thumbnail size, the hook present in frame one.
 * Combined into it is A's treatment, a small caption rail low in the frame revealed word by
 * word with one keyword in the accent, composited as an OVERLAY on top of the film rather than
 * as a band the layout makes room for.
 *
 * Governed throughout by the motion doctrine and the cut-the-curve catalog. The doctrine is
 * written for a timeline runtime; this is Remotion, which is frame based, so the principles
 * and parameters carry over and the API does not. That translation is done once, in motion.ts,
 * and nowhere else.
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
 * on one continuous wave. Under it the carrier is the CAMERA, which runs at one constant
 * velocity for the entire film, panning left at 4.4px per frame and pushing in at 0.0034
 * scale per frame, so the plate either side of every hard cut is moving at the same speed in
 * the same direction. Twelve seconds of that reads as one camera move, not as nine shots.
 * The one exception is the proof beat, which keeps the rate and changes only its base scale
 * and how long it travels for; the reasons are in Plate.tsx and script.ts.
 *
 *  seam  cut@  technique          exit vector                       entry vector
 *  ----  ----  -----------------  --------------------------------  --------------------------------
 *  S0       0  none, film opens   n/a                               beat 1 is ALREADY LANDED at
 *                                                                   frame 0, its last word 3 frames
 *                                                                   into a power4.out. The first
 *                                                                   frame carries the hook; fading
 *                                                                   up into an empty frame spends
 *                                                                   the only half second there is.
 *  S1      50  waterfall cut      x, LEFT. words peel on            x, LEFT. words cascade from
 *  S2      92  waterfall cut      power4.in over 130px, lines       +130px on power4.out, igniting
 *  S3     130  waterfall cut      staggered 2.5f and words 0.66f    at 0.35 opacity mid path,
 *  S4     162  waterfall cut      inside them, opacity dead at      gaps 1.5f decaying x0.84.
 *  S5     192  waterfall cut      ~50% of travel. The chain is      Under it the plate hard cuts
 *  S6     222  waterfall cut      scheduled BACKWARDS so the        with matched camera velocity.
 *  S7     256  waterfall cut      last word dies ON the cut.
 *
 *  S8     306  INVERSE ZOOM       Z, PULL. beat 8 recedes 1 to      Z, PULL. beat 9 arrives
 *              (reserved)         0.8 on power3.in over 6f,         OVERSIZED at 1.25 and retracts
 *                                 blur 0 to 10px, opacity on        on expo.out over 15f, blur 10
 *                                 its own linear tween to 0.15.     to 0, opacity 0.15 to 1. Its
 *                                 Everything SHRINKS.               words are COMPOSED, not
 *                                                                   cascaded: a grow-from-small
 *                                                                   entrance here would flip the
 *                                                                   scale sign and turn the arrival
 *                                                                   into a push. Its plate is held
 *                                                                   still for the same reason.
 *                                 Why here and only here: the reserved backward-Z means ARRIVAL,
 *                                 something bigger landing. This is the payoff, and it is the
 *                                 film's chapter boundary, which is what licenses the axis change.
 *
 *  S9     356  cut the curve      x, LEFT. the payoff BLOCK         x, LEFT. the end card enters
 *                                 accelerates 130px on              from +130px on power4.out over
 *                                 power4.in over 14f, its           10f at 0.35 opacity, composed
 *                                 opacity landing ON the            rather than assembling itself.
 *                                 boundary rather than before it.
 *                                 Returns to the current immediately after the reserved spend.
 *
 * STILLNESS BEFORE CLIMAX: beat 8's last staged reveal lands at local frame 27 and its
 * receding exit begins at 44, and its camera is already parked, so the composition holds
 * unchanged for 17 frames, 0.57s, inside the doctrine's 0.3 to 0.75s window. That pause is
 * the dramatic comma between the major action, the product finally shown plainly, and its
 * result, the payoff. Measured on the render it is the longest motionless stretch in the
 * body by a clear margin, which is the shape it is supposed to have.
 *
 * NO IDLE WOBBLE, AND NO DEAD AIR EITHER, which is the failure the first render actually had.
 * Every beat's held phase is owned by the doctrine's STAGED REVEAL route: the statement is
 * not composed at the beat's first frame, it FINISHES on screen. Beat 1 lands three lines
 * before frame 0, pays off APP at 10 and stamps the slab under NOT at 22. Beat 2 pays off
 * FIND at 9, A DUO at 16 and the slab at 25. Beats 3 and 5 to 7 hold their last line back to
 * 8 or 12. Beat 8 stages its second line at 11 and its mono note at 22. Beat 9 arrives
 * composed, as the inverse zoom's sign discipline requires, then stamps its slab at 24.
 * Under all of it the camera is a mapped path at one constant velocity, and it now moves at
 * a rate a viewer can actually see: at the 1.8px per frame it started at, across a plate
 * blurred and sunk to near black, the whole thing measured as pixel for pixel identical for
 * up to 1.2 seconds at a time. Direction B's per-frame random camera weave and its per-word
 * springs are both gone: a spring starts from rest, and starting from rest after a cut is a
 * dead beat.
 *
 * PACING: Cameron's note was that direction B is a little fast when switching between clips.
 * Beats are longer here, with a floor of 30 frames where B went down to 18, because an 18
 * frame beat cannot contain a 0.6s seam and still hold. But the fix that matters is that the
 * cuts are now velocity matched and land mid motion on both sides. B's cuts were hard and
 * unmatched, so the eye's momentum died at every one of them, and eight dead stops in nine
 * seconds is what "too fast" actually feels like.
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
import { END_FRAMES, EndCard } from "./EndCard";
import { Rail } from "./Rail";
import { bodyFrames, type KineticNativeScript } from "./script";
import { K } from "./skin";

export type KineticNativeProps = { script: KineticNativeScript; cta: Cta };

export const kineticNativeDuration = (script: KineticNativeScript): number =>
  bodyFrames(script) + END_FRAMES;

/**
 * The seam each boundary gets, derived from the data rather than typed twice.
 *
 * The rule is short enough to read in one line: the beat that declares itself the arrival
 * enters on the inverse zoom, the beat before it therefore exits on the matching recession,
 * the last beat exits on a block level cut the curve into the end card, and everything else
 * is the waterfall cut. Deriving it is what stops a retimed script leaving an exit and an
 * entry pointing in different directions, which the doctrine treats as a plan bug rather than
 * as something to fix with easing.
 */
const seamsFor = (script: KineticNativeScript, index: number): { in: SeamIn; out: SeamOut } => {
  const beat = script.beats[index];
  const next = script.beats[index + 1];
  return {
    in: index === 0 ? "open" : beat?.arrival === true ? "inverse" : "waterfall",
    out: next === undefined ? "curve" : next.arrival === true ? "inverse" : "waterfall",
  };
};

export const KineticNative = ({ script, cta }: KineticNativeProps) => {
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
              <Beat beat={beat} seamIn={seam.in} seamOut={seam.out} />
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
