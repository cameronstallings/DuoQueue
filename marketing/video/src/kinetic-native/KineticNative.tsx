/**
 * DIRECTION B+A, "kinetic native". The combined direction, assembled. SECOND CUT.
 *
 * Base is B, kinetic type, because that is the one Cameron picked: huge fitted type filling the
 * frame, leading with the claim, legible at thumbnail size, the hook present in frame one.
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
 * THE THIRD CUT
 * =====================================================================================
 *
 * The first cut was 14.1 seconds of nine beats and Cameron gave it three notes. The second cut
 * answered them in 9.8 seconds of five. This one is 10.9 seconds of six, and it exists because
 * the second was reviewed frame by frame and sample by sample and a list of measured defects
 * came back. The full list, with what each one cost, is at the top of ./script.ts. In one line
 * each:
 *
 *   TOO LONG               Still the shortest thing this direction has produced that says the
 *                          whole argument. It got one second LONGER, once, deliberately, to buy
 *                          the chat beat below, and nothing in it is elaboration: the statement
 *                          lands at 3.4s and everything after it is proof.
 *   NOT ENOUGH GAMEPLAY    Unchanged at two full bleed live beats, but the two swapped places.
 *                          The opening is the sunlit map, which reads as a video game at
 *                          thumbnail size where the dark interior read as a brown rectangle,
 *                          and the firefight moved under the word ENERGY where it belongs.
 *   DOES NOT SHOW THE APP  THREE product beats now, not two: the deck, DUO LOCKED, and a chat
 *                          with a first message going out. That is three of the four things
 *                          the note named, and the fourth, playstyle, is a card's own tag under
 *                          beat 2 and the rail's line under beat 3.
 *
 * The payoff also changed person. The DUO LOCKED screen is a photograph in a ring above a
 * message button, which is the product and cannot be redrawn; what was in the ring was a
 * shirtless beach selfie, which is a category signal this film cannot afford. It is now a man
 * standing next to a suit of samurai armour, and the beat after it is somebody asking when he
 * is going to be online.
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
 * on one continuous wave. Under it the carrier is the CAMERA, and the thing this cut fixed is
 * that the camera used to STOP. A live plate pans left at 4.4px per frame and pushes in at
 * 0.0034 scale per frame; an app plate has no horizontal headroom to pan into, so it used to
 * pan for twelve frames and then park, which left it frozen through its own cut. It now runs
 * the same push for the whole beat with the pan taken out, which needs no headroom at all. No
 * plate in this film is stationary at any seam. The reasons are in Plate.tsx.
 *
 *  seam  cut@  technique          exit vector                       entry vector
 *  ----  ----  -----------------  --------------------------------  --------------------------------
 *  S0       0  none, film opens   n/a                               beat 1 is ALREADY IN FLIGHT at
 *                                                                   frame 0: all four lines placed,
 *                                                                   the last of them 2 frames into
 *                                                                   its own power4.out. The first
 *                                                                   frame carries the WHOLE hook,
 *                                                                   at full size, over a sunlit
 *                                                                   map, and is visibly moving
 *                                                                   while it does.
 *  S1      54  waterfall cut      x, LEFT. words peel on            x, LEFT. words cascade from
 *  S2     103  waterfall cut      power4.in over 130px, lines       +130px on power4.out, igniting
 *  S3     173  waterfall cut      staggered 2.5f and words 0.66f    at 0.35 opacity mid path,
 *  S5     251  waterfall cut      inside them, opacity dead at      gaps 1.5f decaying x0.84.
 *                                 ~50% of travel. The chain is      Under it the plate hard cuts
 *                                 scheduled BACKWARDS so the        with matched camera velocity.
 *                                 last word dies ON the cut.
 *
 *  S4     213  INVERSE ZOOM       Z, PULL. beat 4 recedes 1 to      Z, PULL. beat 5 arrives
 *              (reserved)         0.8 on power3.in over 6f,         OVERSIZED at 1.25 and retracts
 *                                 blur 0 to 10px, opacity on        on expo.out over 15f, blur 10
 *                                 its own linear tween to 0.15.     to 0, opacity 0.15 to 1. Its
 *                                 Everything SHRINKS.               words are COMPOSED, not
 *                                                                   cascaded: a grow-from-small
 *                                                                   entrance here would flip the
 *                                                                   scale sign and turn the
 *                                                                   arrival into a push. Its
 *                                                                   plate is held still for the
 *                                                                   same reason, until frame 15.
 *                                 Why here and only here: the reserved backward-Z means ARRIVAL,
 *                                 something bigger landing. What lands is the product, on the
 *                                 frame it says DUO LOCKED. Spending the reserved vector on the
 *                                 app arriving is the reason it was reserved.
 *
 *  S6     298  cut the curve      x, LEFT. the chat BLOCK           x, LEFT. the end card enters
 *                                 accelerates 130px on power4.in    from +130px on power4.out over
 *                                 from frame 287, which is the      10f at 0.35 opacity, composed
 *                                 frame the read ends on. Its       rather than assembling itself.
 *                                 opacity lands ON the boundary
 *                                 rather than before it.
 *                                 The current is returned to immediately after the reserved
 *                                 spend, which is S5, and held to the end.
 *
 * STILLNESS BEFORE CLIMAX: beat 4's second line settles at local frame 20 and its camera parks
 * at 22, and its receding exit begins at 34. The composition therefore holds unchanged for 12
 * frames, 0.40s, inside the doctrine's 0.3 to 0.75s window. That pause is the dramatic comma
 * between the major action and its result, and it is the only motionless stretch in the film.
 * It is also why the flood sits fourth rather than third even though "not faces" reads well
 * straight after the deck: the comma is only worth anything immediately before the payoff.
 *
 * NO IDLE WOBBLE, AND NO DEAD AIR EITHER. Every beat's held phase is owned by a named
 * sustained-motion route, and no beat is allowed to coast on a stationary plate:
 *
 *   beat 1  STAGED REVEAL      the four lines land across frames -9 to 7, so the hook is whole
 *           + camera path      in frame 0 and still arriving; the slab is stamped under NOT at
 *                              24. Under it the map travels for the whole beat.
 *   beat 2  SEQUENCED UI LIFE  the deck is swiped mid beat and the next card arrives, and the
 *           + staged reveal    plate pushes under it from the first frame to the last. This is
 *           + camera path      the beat the review found frozen for 23 frames and cut out of
 *                              while it was stopped; it is the reason app plates push now.
 *   beat 3  STAGED REVEAL      three lines land ON the three phrases as they are spoken, at 2,
 *           + camera path      21 and 41, over one unbroken 2.3s shot of a firefight. All three
 *                              offsets are measured off the read's RMS envelope, not estimated.
 *   beat 4  STAGED REVEAL      FACES paid off at 11, then the deliberate stillness above.
 *   beat 5  ANIMATED SEQUENCE  the app arrives oversized and retracts into the focal plane, the
 *                              slab wipes under DUO at 16 with its leading edge crossing the
 *                              word as the word is said, and the plate pushes from 15 to the
 *                              cut.
 *   beat 6  SEQUENCED UI LIFE  a message is sent and its bubble arrives, under two lines that
 *           + staged reveal    land on their own words at 0 and 9.
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
import { K } from "./skin";

export type KineticNativeProps = { script: KineticNativeScript; cta: Cta };

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
