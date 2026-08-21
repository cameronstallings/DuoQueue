/**
 * DIRECTION C - TYPE LED, EDITORIAL.
 *
 * The ClickUp reel is the model and it is followed on its own terms rather than borrowed from. Its
 * type does not build in place and hold; it SCROLLS, continuously, leftward, forever. Its objects
 * do not own a beat; they RISE FROM BELOW BEHIND the words while the words rise with them. It cuts
 * ONCE in 18.6 seconds. And its punctuation is a caret and a selection highlight, which is a
 * typographic idea rather than a motion one.
 *
 * The type law itself is in ./Scroller.tsx with the frames it was measured on. What lives here is
 * the film.
 *
 * =====================================================================================
 * WHAT MAKES IT A DIFFERENT FILM AND NOT A DIFFERENT SKIN
 * =====================================================================================
 *
 *   THE TYPE NEVER STOPS. There is no build, no hold and no exit anywhere in this direction. One
 *   sentence hands to the next while both are moving, so the film has no seam at any beat boundary
 *   at all: the only cut is the one into the end card.
 *
 *   THE APP IS THE GROUND, NOT THE SUBJECT. Every fragment is a plane behind the words, rising
 *   from below into the frame, dimmed and set back. ClickUp f312-342 measured its window's top
 *   edge unwinding from -4.4 to -2.2 degrees while it scaled about 2.2 times and translated some
 *   600px up, all under heavy blur, and the type rising with it. That is what a supporting plane
 *   does here.
 *
 *   THE ONE CASCADE. ClickUp's only multi-element beat is three tiles arriving on a twenty frame
 *   stagger that read as one group and RESOLVE TO ONE. Beat three has exactly three things to say,
 *   so it gets exactly that: the games chip, the playstyle chip and the card they both came off,
 *   staggered, resolving to the card.
 *
 *   ONE FIELD BEAT. A full bleed mesh, four soft lights drifting at four different rates, under
 *   the sentence that names the product. It is the only place in any of the three films where the
 *   ground itself is the picture, and it is spent on the only line that says "duoqueue".
 *
 * =====================================================================================
 * THE TYPE SHELF, which is a real problem solved rather than a decoration
 * =====================================================================================
 *
 * A scrolling line of 116px type crossing a screen recording is unreadable at the frames where the
 * recording passes under a letterform, and the light ground does not fix that, it only turns it
 * over: the words are near-black ink now and the thing sliding under them is a near-black
 * fragment. The reference escapes it because its ground is flat white AND its risers are white.
 * So the words still ride a SHELF: a soft horizontal band 340px tall, centred on the baseline,
 * falling to nothing at both edges, which lifts everything behind the type back toward the paper.
 * It is the same device a title over footage has used for a century and it is invisible as an
 * object.
 */
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";

import { End } from "../End";
import { Field, Flash, Flip, Grain } from "../Field";
import { clauseFrames } from "../film";
import { CENTRE_X, GROUND, INK, OBJECT_Y, PAPER } from "../ground";
import { Fragment, heightOf, type FragName } from "../media";
import { EASE, flashAt, FLIP_FRAMES, ramp, REST } from "../motion";
import { Plane, Stage } from "../Plane";
import type { ProScript } from "../script";
import { beatFrames, beatStarts, bodyFrames, END_FRAMES } from "../timing";
import { useFaces } from "../type";

import { Scroller } from "./Scroller";

/** Frames a row keeps advancing past its own beat while the next row is already entering. The
 * handover, and the reason this film has no seam at a beat boundary. */
const HANDOVER = 12;

interface Riser {
  at: number;
  until: number;
  frag: FragName;
  width: number;
  /** Where in the stack this plane lives. Deeper planes are dimmer, softer and rise slower, which
   * is what makes a cascade of three read as a space rather than as a list. */
  depth: number;
}

/**
 * A supporting plane, rising from below behind the words.
 *
 * The measured ClickUp entry: the top edge unwinds from -4.4 degrees through -3.1 to -2.2 while
 * the window scales up about 2.2 times and translates up some 600px, under heavy blur, over about
 * ten frames. Reproduced here at the same shape, with the depth deciding how much of it survives.
 */
const Rise = ({ shot, frame }: { shot: Riser; frame: number }) => {
  const t = ramp(frame, shot.at, shot.at + 14, 0, 1, EASE.quintOut);
  const out = ramp(frame, shot.until - 10, shot.until, 0, 1, EASE.cubicIn);
  const live = Math.max(0, t - out);
  if (live <= 0.01) {
    return null;
  }
  const width = Math.round(shot.width * (0.62 + 0.38 * t));
  return (
    <Plane
      name={`rise-${shot.frag}-${String(shot.at)}`}
      pose={{
        ...REST,
        // The top edge unwinds from a steep negative slope to almost flat, exactly as measured,
        // and the plane keeps a residual degree of tilt at rest because it is a background object
        // rather than the subject.
        rotX: -7.2 * (1 - t) - 2.2,
        rotY: 5 * (1 - t) * (shot.depth > 0 ? 1 : -1),
        rotZ: 0,
        scale: 1,
        smearX: 20 * (1 - t) + 14 * out,
        smearY: 8 * (1 - t),
        opacity: live * (0.66 - 0.14 * shot.depth),
      }}
      cx={CENTRE_X + shot.depth * 96}
      cy={Math.round(OBJECT_Y + 620 * (1 - t) + shot.depth * 40)}
      width={width}
      height={heightOf(shot.frag, width)}
      radius={22}
      z={-140 * shot.depth - 90}
      gloss={0.16}
    >
      <Fragment frag={shot.frag} startAt={shot.at} />
    </Plane>
  );
};

/**
 * The one field beat. Four soft lights at four different rates, drifting across the paper; the
 * only place in the three films where the ground itself is the picture, spent on the only line
 * that says "duoqueue".
 *
 * The four lights are unchanged in position, size and rate. What changed is what they DO to the
 * ground, and it is the ground that decided it: on off-black each one was a light being ADDED to
 * a dark field, so the alphas were pigment on top of nothing. On paper the field is already at
 * 243 and there is nothing above it to add, so the same four are TINTS: chartreuse, a cool blue,
 * the app's own voltDim olive and a soft warm shade, each pulling the paper a little way toward
 * itself. Section 2 of ../ground says raw chartreuse may not cover the ground, and this is the
 * one dilution where it is a tint rather than a smudge, which is the same licence the flood in
 * ../Field has.
 */
const Mesh = ({ frame, frames }: { frame: number; frames: number }) => {
  const t = frame / Math.max(1, frames);
  const at = (a: number, b: number, rate: number): string =>
    `${String(Math.round(a + Math.sin((t + rate) * Math.PI * 1.1) * 16))}% ${String(Math.round(b + Math.cos((t + rate) * Math.PI * 0.9) * 12))}%`;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: [
          `radial-gradient(52% 34% at ${at(32, 34, 0.0)}, rgba(205,255,61,0.34), rgba(205,255,61,0) 100%)`,
          `radial-gradient(46% 30% at ${at(72, 58, 0.35)}, rgba(126,182,214,0.22), rgba(126,182,214,0) 100%)`,
          `radial-gradient(60% 38% at ${at(46, 74, 0.7)}, rgba(148,188,44,0.24), rgba(148,188,44,0) 100%)`,
          `radial-gradient(70% 44% at ${at(58, 20, 1.05)}, rgba(92,100,80,0.10), rgba(92,100,80,0) 100%)`,
        ].join(", "),
        opacity: ramp(frame, 0, 12, 0, 1) * ramp(frame, frames - 14, frames, 1, 0),
        filter: "blur(26px)",
      }}
    />
  );
};

/**
 * The shelf the words ride, so a 116px letterform never lands on a rising fragment.
 *
 * It went the other way with the ground, which is the whole point of it: the shelf's job is to
 * put the type back on the GROUND, whatever the ground is. On off-black it darkened the band the
 * words cross so a pale letterform kept its contrast. On paper it lightens the same band so the
 * film's near-black ink keeps its contrast against a near-black fragment sliding under it. Same
 * stops, same 340px, same invisible-as-an-object device a title over footage has used for a
 * century.
 */
const Shelf = ({ strength }: { strength: number }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `linear-gradient(to bottom, rgba(${PAPER},0) 40.2%, rgba(${PAPER},0.9) 47%, rgba(${PAPER},0.9) 55%, rgba(${PAPER},0) 61.5%)`,
      opacity: strength,
      pointerEvents: "none",
    }}
  />
);

export const ProC = ({ script, cta }: { script: ProScript; cta: Cta }) => {
  const loaded = useFaces();
  const frame = useCurrentFrame();

  const frames = beatFrames(script);
  const starts = beatStarts(script);
  const body = bodyFrames(script);

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  const b0 = starts[0] ?? 0;
  const b1 = starts[1] ?? 0;
  const b2 = starts[2] ?? 0;
  const b3 = starts[3] ?? 0;
  const clause = clauseFrames(frames[3] ?? 1, 3);

  const risers: Riser[] = [
    // Beat one is the game, and it is the one plane that is a full width plate rather than a
    // card, because the line is about playing rather than about the product.
    { at: b0 + 6, until: b1 + 8, frag: "play", width: 1010, depth: 0 },
    // Beat two: the card rises under the mesh, on the line that says the product's name.
    { at: b1 + 14, until: b2 + 6, frag: "card", width: 700, depth: 0 },
    // Beat three: THE CASCADE. Three planes on a stagger of about twenty frames, at three depths,
    // resolving to the card they both came off. ClickUp's only multi-element beat, exactly.
    { at: b2 + 4, until: b2 + 96, frag: "games", width: 560, depth: -1 },
    { at: b2 + 24, until: b2 + 104, frag: "role", width: 620, depth: 1 },
    { at: b2 + 44, until: b3 + 6, frag: "card", width: 700, depth: 0 },
    // Beat four: one plane a clause, each rising as its clause reaches the frame centre.
    { at: b3 + 2, until: b3 + clause + 8, frag: "locked", width: 470, depth: 0 },
    { at: b3 + clause, until: b3 + clause * 2 + 8, frag: "send", width: 720, depth: 0 },
    { at: b3 + clause * 2, until: body, frag: "play", width: 1010, depth: 0 },
  ];

  const flash = Math.max(flashAt(frame, b1 + 14), flashAt(frame, b3 + 2));

  return (
    <Field>
      <Soundtrack id={script.id} />

      {frame >= b1 && frame < b2 ? <Mesh frame={frame - b1} frames={frames[1] ?? 1} /> : null}

      {frame < body ? (
        <Stage>
          {risers.map((shot) => (
            <Rise key={`${shot.frag}-${String(shot.at)}`} shot={shot} frame={frame} />
          ))}
        </Stage>
      ) : null}

      <Shelf strength={frame < body ? 1 : 0} />

      {frame < body
        ? script.beats.map((beat, index) => {
            const at = starts[index] ?? 0;
            const window = frames[index] ?? 1;
            if (frame < at || frame >= at + window + HANDOVER) {
              return null;
            }
            return (
              <Scroller
                key={beat.phrase}
                name={`c${String(index)}`}
                words={beat.phrase.split(" ")}
                keyWord={beat.key}
                frame={frame - at}
                window={window}
              />
            );
          })
        : null}

      {/* A hairline rule under the scroll, which is the editorial half of the direction: it says
          the words are set on something rather than floating over footage. It is the app's own
          muted ink at a tenth, and it is the only graphic element in the film. */}
      {frame < body ? (
        <div
          style={{
            position: "absolute",
            left: 96,
            right: 96,
            top: 1128,
            height: 2,
            backgroundColor: INK.dim,
            opacity: 0.16,
          }}
        />
      ) : null}

      <Flash amount={flash} />

      <Sequence from={body} durationInFrames={END_FRAMES} layout="none">
        <End cta={cta} />
      </Sequence>

      <Grain />
      <Flip amount={ramp(frame, 0, FLIP_FRAMES, 1, 0)} />
    </Field>
  );
};
