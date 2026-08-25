/**
 * DIRECTION B - CARD IN SPACE.
 *
 * The closest of the three to the best reference, and deliberately so: the Uber reel is the film
 * Cameron said he wants to look like, and this is that film's grammar applied to this product,
 * shot for shot, with the numbers from the measurement rather than an impression of them.
 *
 * =====================================================================================
 * WHAT IT IS
 * =====================================================================================
 *
 * ONE OBJECT, IN A REAL CAMERA, THAT CHANGES WHAT IS WRITTEN ON IT. The film cuts ONCE, at the
 * wipe. Everything else is a continuous transform: an arrival that unwinds out of perspective, six
 * in-place content morphs, one mid-beat perspective gesture at each end of the film, and an
 * inverse zoom into the brand. The reference cuts nine times in 25.6s and ClickUp cuts ONCE in
 * 18.6s; the rejected direction cut at every one of its six beats, which is why it stuttered.
 *
 * TWO Z PLANES AT DIFFERENT VELOCITIES. The hero holds while a far plane behind it - the same
 * footage, thrown out of focus - grows at its own rate. Uber f372-432 is exactly this. That is
 * parallax and it costs nothing; `CRUISE = 1.25` px per frame applied uniformly to everything was
 * not parallax, it was a crawl.
 *
 * THE OBJECT RECEDES WHEN THE STATEMENT ARRIVES. See the header of ../film.ts. It is the only way
 * a 745px card and a two line statement can share a beat without one of them being parked in a
 * corner, and it is what both references actually do.
 *
 * =====================================================================================
 * THE BEAT MAP, derived from the read rather than typed in
 * =====================================================================================
 *
 * Every frame number below comes out of `beatStarts`/`beatFrames`, which come out of the measured
 * WAV. At the delivered read that resolves to:
 *
 *   f  0-133   "your best games were the ones you played with someone else"
 *              0     out of black over ten linear frames; the game arrives mid-rotation
 *              0-30  the wide plate alone, unwinding, the far plane growing behind it
 *              30    the plate recedes; the statement builds, holds 27 frames
 *              108   the statement accelerates out left and THE WIPE CHASES IT
 *   f133-239   "duoqueue is where you find the next one"
 *              133   the wipe crosses; the card arrives out of it, rotated and oversized,
 *                    with the film's first colour flash on the frame it lands
 *              143   THE PERSPECTIVE GESTURE, spent on the card that is the product
 *              159   the card recedes; the statement builds and holds
 *              217   the statement leaves; NO CUT
 *   f239-379   "you match on the games you play and how you play them"
 *              247   the card MORPHS in place into the games chip, with a flash
 *              277   it MORPHS again into the playstyle chip
 *              297   it recedes; the statement builds and holds
 *              351   the statement leaves; NO CUT
 *   f379-506   "lock the duo, send a message, and go play"
 *              379   MORPH to the DUO LOCKED banner, flash. Three clauses of one sentence, each
 *              415   MORPH to the send button                 36 frames, each with its own
 *              451   MORPH to the game, full width            build, hold and exit
 *              487   the object returns to full focus for the closing hold, 19 frames
 *              485   THE SECOND PERSPECTIVE GESTURE, on the last image in the film
 *              497   the inverse zoom: the plate recedes and hands over to the brand
 *   f506-551   the end card, arriving oversized and retracting, which matches the sign of the
 *              exit that hands to it
 *
 * Eleven visual events over four spoken beats, which is the 11-14 the motion study measured for a
 * film this length, and only one of the eleven is a cut.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";

import { End } from "../End";
import { Field, Flash, Flip, Grain, Streaks, Wipe } from "../Field";
import { clauseFrames, focusAt, statementPlan, statementsOf } from "../film";
import { GROUND, OBJECT_Y } from "../ground";
import { Backdrop, Hero, type HeroPlan } from "../Hero";
import { EASE, flashAt, FLIP_FRAMES, ramp } from "../motion";
import { Stage } from "../Plane";
import type { ProScript } from "../script";
import { AppThemed } from "../theme";
import { beatFrames, beatStarts, bodyFrames, END_FRAMES } from "../timing";
import { groupSize, useFaces, wordCount } from "../type";
import { Words } from "../Words";

const heroPlanOf = (
  starts: readonly number[],
  frames: readonly number[],
  body: number,
): HeroPlan => {
  const b1 = starts[1] ?? 0;
  const b2 = starts[2] ?? 0;
  const b3 = starts[3] ?? 0;
  const clause = clauseFrames(frames[3] ?? 1, 3);
  return {
    cy: OBJECT_Y,
    states: [
      // The film opens on the thing the line is about, as a wide plate: the only landscape image
      // in the set and the only one that is not the app.
      { at: 0, frag: "play", width: 880, radius: 22, gloss: 0.16 },
      // The one cut in the film, hidden inside the wipe, and the only state that arrives.
      { at: b1, frag: "card", width: 745, radius: 34, gloss: 0.26, arrive: true },
      // Everything from here is the same object with something else written on it.
      { at: b2 + 8, frag: "games", width: 640, radius: 20, gloss: 0.18 },
      { at: b2 + 38, frag: "role", width: 700, radius: 20, gloss: 0.18 },
      { at: b3, frag: "locked", width: 520, radius: 34, gloss: 0.26 },
      { at: b3 + clause, frag: "send", width: 745, radius: 26, gloss: 0.2 },
      // Full width, once, deliberately: the film ends outside the app and the last image is the
      // only one allowed past the centred column.
      { at: b3 + clause * 2, frag: "play", width: 1080, radius: 0, gloss: 0.12 },
    ],
    // Two in the whole film. One on the card that IS the product, one on the last image before
    // the brand. Spending a third would make it texture instead of punctuation.
    gestures: [b1 + 10, body - 21],
  };
};

export const ProB = ({ script, cta }: { script: ProScript; cta: Cta }) => {
  const loaded = useFaces();
  const frame = useCurrentFrame();

  const frames = beatFrames(script);
  const starts = beatStarts(script);
  const body = bodyFrames(script);

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  const statements = statementsOf(script, starts, frames);
  const plan = heroPlanOf(starts, frames, body);
  const seam = starts[1] ?? 0;

  // The object's depth, as one number, from the statements that are pushing it back. It returns
  // between clauses only where the plan leaves a gap, which on this film is the closing hold.
  const focus = focusAt(frame, statements);

  // The one cut. The panel crosses the frame in fourteen frames, accelerating into the cover and
  // holding its speed out of it, travelling the same way the statement above it is travelling.
  const wipe =
    frame < seam
      ? ramp(frame, seam - 7, seam, 0, 0.5, EASE.quadIn)
      : ramp(frame, seam, seam + 7, 0.5, 1, EASE.linear);

  // Three floods in the film: the card's arrival, the games morph, the lock. The reference spends
  // two in 25.6 seconds; a fourth here would stop being an event.
  const flash = Math.max(
    flashAt(frame, seam + 2),
    flashAt(frame, (starts[2] ?? 0) + 8),
    flashAt(frame, starts[3] ?? 0),
  );

  // The inverse zoom that hands over to the brand. Both sides shrink, which is the Z sign rule:
  // the plate recedes and the end card arrives oversized and retracts into the same current.
  const pull = ramp(frame, body - 9, body, 0, 1, EASE.cubicIn);

  return (
    <Field>
      <Soundtrack id={script.id} />

      {frame < body ? (
        <>
          <Backdrop plan={plan} opacity={0.1} />
          <Stage>
            <Hero
              plan={plan}
              focus={focus}
              lead={5}
              extra={{
                scaleMul: 1 - 0.22 * pull,
                smearAdd: 20 * pull,
                opacityMul: 1 - 0.55 * pull,
              }}
            />
          </Stage>
        </>
      ) : null}

      {statements.map((statement) => {
        if (frame < statement.at || frame >= statement.at + statement.window) {
          return null;
        }
        const words = wordCount(statement.lines);
        const shape = statementPlan(statement, words);
        return (
          <Words
            key={statement.at}
            name={`b${String(statement.at)}`}
            lines={statement.lines}
            keyWord={statement.key}
            size={groupSize(statement.lines)}
            frame={frame - statement.at - shape.start}
            cadence={shape.cadence}
            exitAt={shape.exitAt - shape.start}
          />
        );
      })}

      <Flash amount={flash} />

      {/* The streak field rides the wipe: thin lines at scattered y, moving leftward at DIFFERENT
          rates, which is what makes the crossing read as speed rather than as a panel. */}
      {frame > seam - 9 && frame < seam + 18 ? (
        <Streaks
          frame={frame - (seam - 9)}
          frames={27}
          opacity={ramp(frame, seam - 9, seam - 2, 0, 1) * ramp(frame, seam + 8, seam + 18, 1, 0)}
        />
      ) : null}

      <Wipe t={wipe} />

      <Sequence from={body} durationInFrames={END_FRAMES} layout="none">
        <End cta={cta} />
      </Sequence>

      <Grain />

      {/* The bookend. Ten frames, linear, no easing at either end, exactly as measured. */}
      <Flip amount={ramp(frame, 0, FLIP_FRAMES, 1, 0)} />
    </Field>
  );
};

/**
 * THE SAME FILM, SHOT IN THE APP'S OTHER THEME.
 *
 * Not a variant and not a setting: the identical component, the identical script, read, mix, beat
 * table, schedule, ground, grid, type, wipe, flood and end card, wrapped in the one context that
 * decides which column of the footage table ../media reads and which surface law an object made
 * of that footage obeys. See ../theme.tsx for the measurement that makes the second half of that
 * sentence necessary and for what the light law actually does.
 *
 * Put the two files side by side and every statement builds on the same frame, which is the only
 * arrangement under which the comparison Cameron recorded both themes for means anything.
 */
export const ProBLight = (props: { script: ProScript; cta: Cta }) => (
  <AppThemed theme="light">
    <ProB {...props} />
  </AppThemed>
);
