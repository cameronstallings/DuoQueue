/**
 * DIRECTION C, "GAMEPLAY LED": a game trailer that happens to be selling an app.
 *
 * The other two directions are about the product. This one is about the thing the product is
 * for, and it is built the way a real game trailer is built rather than the way a feed advert
 * is: the footage is full bleed and nothing is drawn on top of it except a lower third, the
 * cuts are hard, and the product appears as a clean insert that holds for a second and gets out
 * of the way.
 *
 * =====================================================================================
 * THE FOOTAGE IS UNOBSCURED, WHICH IS A LAYOUT RULE RATHER THAN AN INTENTION
 * =====================================================================================
 *
 * Half of what made the previous cut look like an advert was that every frame of footage had a
 * 300px word sitting in the middle of it. So this direction has one keep out rule and the
 * layout is built around it: type lives BELOW y=1660 and footage lives above it, and the two
 * never occupy the same pixels on an app beat at all.
 *
 * On a gameplay beat the picture runs edge to edge under the lower third, which is what a
 * trailer does, and it carries a bottom ramp so the type has something to sit on. The ramp
 * starts at y=1580 and is fully transparent by y=1340, so it darkens the bottom fifth and
 * leaves four fifths of the game untouched.
 *
 * =====================================================================================
 * THE APP CUTAWAYS ARE THE BIGGEST IN THE SET
 * =====================================================================================
 *
 * `fitApp(960, 1540)` is 711 x 1540: the whole screen at 0.603 of its own scale, uncropped,
 * with 185px of black each side, 60px above and below, and the lower third in real black
 * underneath it rather than over it. That is the largest uncropped app of the three directions.
 *
 * The pillarbox is not an apology. A 1180 x 2556 screen has an aspect of 0.46 and no vertical
 * frame will ever be that shape, so the choice is black at the sides or 209px of the app's own
 * header and action row outside the frame. Cameron asked for the second one to stop.
 *
 * The 60px inset is the fix for the one thing measurement caught here: fitting to the full
 * 1080 x 1660 box returned exactly 1660 of height, which parked the plate at y = 0, flush to
 * the frame edge. Uncropped, and it still read as a crop.
 *
 * =====================================================================================
 * MOTION: HARD CUTS, ONE RAMP, ONE SEAM
 * =====================================================================================
 *
 * A trailer cuts. There is no plate slide and no dissolve at a shot boundary in this direction:
 * the picture changes on a frame, which is the most confident transition there is and the one
 * the other two do not use. What keeps the boundary from being a slideshow is that both sides
 * are moving through it. The gameplay is on a continuous scale ramp that starts at the cut and
 * is still running at the next one, and an app cutaway is a screen recording of somebody using
 * an app, which is never still.
 *
 * The lower third does the doctrine's waterfall cut over every boundary, so there is a second
 * gesture on the seam even where the picture hard cuts.
 *
 * The last beat pans left into the end card, which is the third and last transition type and
 * the same seam the other two directions hand over on.
 */
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";

import { Soundtrack } from "@/audio/Soundtrack";
import type { Cta } from "@/config/phase";
import { EndCard } from "@/kinetic-native/EndCard";
import { EASE } from "@/kinetic-native/motion";
import { Texture } from "@/kinetic-native/Plate";
import { K } from "@/kinetic-native/skin";
import { alpha } from "@/lib/color";
import { VIDEO_W } from "@/lib/scale";

import { fitApp, GameBed, isGameplay, Source } from "../media";
import type { Shot, V6Script } from "../script";
import { Stack } from "../Stack";
import { beatFrames, beatStarts, bodyFrames, END_FRAMES } from "../timing";
import { filmSize, useFaces } from "../type";

/** The keep out line. Footage above, type below, and on an app beat there is nothing but ground
 * between them. */
const RULE = 1660;

/**
 * The lower third: left aligned, off a hot rule, in the band under RULE.
 *
 * `band` is 220 rather than the 260 left under RULE, so the block centres at y=1770 instead of
 * y=1790. That is not a rounding preference. TikTok and Reels both stack their own furniture
 * over roughly the bottom tenth of a 1920 frame, and a lower third centred at 1790 puts its
 * descenders at 1820, which is inside it.
 */
const LOWER = { left: 96, rule: 6, gutter: 30, cap: 64, band: 220 } as const;

/**
 * The app cutaway, and the margin the first cut of this direction did not have.
 *
 * `fitApp(1080, 1660)` returns exactly 766 x 1660, which is the whole screen uncropped and the
 * largest app of the three directions, and it also puts the plate at y = 0: flush to the top
 * frame edge with no margin at all, which measurement caught and the eye reads as a crop even
 * though it is not one. Fitting inside an inset box instead costs 55px of width and buys 60px
 * of black above and below the device, so the cutaway reads as an insert rather than as a
 * picture that ran out of frame.
 */
const APP_INSET = 60;

const APP_RECT = fitApp(VIDEO_W - APP_INSET * 2, RULE - APP_INSET * 2);

const Shot_ = ({ shot, frames, isGame, isLast }: { shot: Shot; frames: number; isGame: boolean; isLast: boolean }) => {
  const frame = useCurrentFrame();

  // The last beat's leftward pan, which is the vector the end card's entry from the right picks
  // up. Only the gameplay carries it, and it is inside the bed's own overscale so no edge opens.
  const handoff = isLast ? interpolate(frame, [frames - 16, frames], [0, 1], {
    easing: EASE.power4In,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) : 0;

  if (isGame) {
    return (
      <AbsoluteFill style={{ transform: `translateX(${(-handoff * 62).toFixed(2)}px)` }}>
        <GameBed
          clip={shot.clip}
          from={shot.from}
          frames={frames}
          scaleFrom={1.06}
          scaleTo={1.17}
          filter="saturate(1.07) contrast(1.05)"
        />
        {/* The bottom ramp, and nothing else on top of the picture. Opaque enough under the
            lower third to hold white type, gone by four fifths of the way up the frame. */}
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(to bottom, ${alpha("#000000", 0)} 1340px, ${alpha("#000000", 0.72)} 1580px, ${alpha("#000000", 0.94)} 1920px)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: Math.round((VIDEO_W - APP_RECT.width) / 2),
          top: Math.round((RULE - APP_RECT.height) / 2),
          width: APP_RECT.width,
          height: APP_RECT.height,
          overflow: "hidden",
          boxShadow: `0 0 0 1px ${alpha(K.bone, 0.09)}`,
        }}
      >
        <Source clip={shot.clip} from={shot.from} fit="contain" />
      </div>
    </AbsoluteFill>
  );
};

const Beat = ({
  index,
  shot,
  lines,
  keyWord,
  frames,
  size,
  isGame,
  isLast,
}: {
  index: number;
  shot: Shot;
  lines: string[];
  keyWord: string | undefined;
  frames: number;
  size: number;
  isGame: boolean;
  isLast: boolean;
}) => (
  <AbsoluteFill>
    <Shot_ shot={shot} frames={frames} isGame={isGame} isLast={isLast} />

    <div
      style={{
        position: "absolute",
        left: LOWER.left,
        top: RULE,
        width: VIDEO_W - LOWER.left * 2,
        height: LOWER.band,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: LOWER.gutter,
      }}
    >
      {/* The rule. It is the only mark this direction draws and it is the accent the end card's
          call to action slab is filled with, so the two agree without the body carrying a
          logo. */}
      <div
        style={{
          width: LOWER.rule,
          height: Math.round(size * (lines.length > 1 ? 2.04 : 1.02)),
          backgroundColor: K.hot,
          flex: "0 0 auto",
        }}
      />
      <Stack
        lines={lines}
        keyWord={keyWord}
        frames={frames}
        size={size}
        align="left"
        color={K.bone}
        accent={K.hot}
        delay={index === 0 ? -7 : 0}
      />
    </div>
  </AbsoluteFill>
);

export const DirectionC = ({
  script,
  shots,
  cta,
}: {
  script: V6Script;
  shots: Shot[];
  cta: Cta;
}) => {
  const loaded = useFaces();
  const frames = beatFrames(script);
  const starts = beatStarts(script);
  const body = bodyFrames(script);

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: K.ink }} />;
  }

  const size = filmSize(script, VIDEO_W - LOWER.left * 2 - LOWER.rule - LOWER.gutter, LOWER.cap);

  return (
    <AbsoluteFill style={{ backgroundColor: K.ink }}>
      <Soundtrack id={script.id} />

      {script.beats.map((beat, index) => (
        <Sequence
          key={beat.phrase}
          from={starts[index] ?? 0}
          durationInFrames={frames[index] ?? 1}
          layout="none"
        >
          <Beat
            index={index}
            shot={shots[index] ?? { clip: "deck-cards", from: 0 }}
            lines={beat.lines}
            keyWord={beat.key}
            frames={frames[index] ?? 1}
            size={size}
            isGame={isGameplay((shots[index] ?? { clip: "deck-dark" as const }).clip)}
            isLast={index === script.beats.length - 1}
          />
        </Sequence>
      ))}

      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <Texture />
      </AbsoluteFill>

      <Sequence from={body} durationInFrames={END_FRAMES} layout="none">
        <EndCard cta={cta} />
      </Sequence>
    </AbsoluteFill>
  );
};
