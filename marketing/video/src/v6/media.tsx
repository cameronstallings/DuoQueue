/**
 * THE ARITHMETIC THAT ANSWERS "YOU CANNOT REALLY SEE THE APP".
 *
 * Cameron's third note on the fifth cut was that the app is not legible because of how zoomed
 * in it looks. That is not a taste complaint, it is a measurement, and the measurement is this:
 *
 *   The app clips are 1180x2556, an aspect of 0.4617. The frame is 1080x1920, an aspect of
 *   0.5625. Fitting the taller shape to COVER the wider one scales it by 1080/1180 = 0.915 and
 *   the rendered height becomes 2338, of which 418 is outside the frame. So a cover fit at a
 *   camera scale of exactly 1.0 has ALREADY thrown away 209px off the top and 209px off the
 *   bottom of the phone screen before any camera move happens.
 *
 *   209px of 2556 is the top 8.2% and the bottom 8.2% of the screen. The Deck header sits at
 *   source y 196 to 340 and the pass / ping / boost row at 2018 to 2230, so a cover fit at 1.0
 *   is already eating into the header and any push past about 1.05 starts on the action row.
 *   Those two strips are most of what makes the footage read as an application rather than as
 *   an abstract dark rectangle, and the previous direction pushed to 1.1 and 1.36 because the
 *   display type needed the room. Type size and app legibility have been in direct conflict for
 *   five cuts and the type kept winning.
 *
 * So every app frame in all three of these directions is a CONTAIN fit. `fitApp` returns the
 * largest rectangle of the true 1180x2556 aspect that fits inside a given box, and the video is
 * drawn at exactly that rectangle, so the whole screen is on the frame at every frame. There is
 * no camera on an app plate at all: not a push, not a pan, not a drift. A push on a contain fit
 * is a crop with extra steps, and the film has nothing to gain from one when the thing inside
 * the rectangle is already a moving screen recording.
 *
 * WHAT THAT COSTS, honestly. A contained app is smaller in the frame than a cropped one: the
 * biggest a full 1180x2556 screen can be in a 1080x1920 frame is 886x1920, and any layout that
 * wants type outside the screen makes it smaller still. The three directions land between 748
 * and 886 pixels wide, which is 63% to 75% of the frame width against the previous cut's 110%.
 * The previous cut showed 83% of a screen at 110% width; these show 100% of a screen at 69%.
 * That is the trade Cameron asked for in the note.
 *
 * THE GAMEPLAY IS THE OPPOSITE CASE and it gets the opposite treatment. It is 2560x1440
 * landscape, so a vertical frame keeps roughly the middle third whatever anybody does, and
 * there is no version of it that is uncropped. It covers, deliberately, because a letterboxed
 * game in a vertical frame is a worse picture than a cropped one and because nothing in the
 * brief asks for a game HUD to be legible.
 */
import {
  AbsoluteFill,
  getStaticFiles,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";

import { clips } from "@/data/clips";
import { FPS } from "@/lib/scale";
import type { ClipName } from "@/types";

/** The iPhone screen recordings, in their own pixels. Every app clip in public/footage is this
 * shape; ffprobe says so and `pnpm validate` is not the place to re-check a constant. */
export const APP = { width: 1180, height: 2556 } as const;

export interface Rect {
  width: number;
  height: number;
}

/**
 * The largest whole app screen that fits inside a box. Nothing is ever cropped: this is the
 * one function the "the app must be uncropped" constraint reduces to, and every app frame in
 * all three directions is drawn at what it returns.
 */
export const fitApp = (maxWidth: number, maxHeight: number): Rect => {
  const scale = Math.min(maxWidth / APP.width, maxHeight / APP.height);
  return { width: Math.round(APP.width * scale), height: Math.round(APP.height * scale) };
};

/**
 * Whether a beat's clip is gameplay rather than a screen recording, which decides everything
 * downstream: contain against cover, plate against full bleed, camera against no camera.
 *
 * It is derived from the clip NAME and not from the beat index, and that is a correction. All
 * three directions used to hard code "the last beat is the game", which was true of the first
 * shot plan and silently wrong the moment the plan gained an opening gameplay beat: the game
 * would have been letterboxed inside a phone-shaped rectangle. The plan is allowed to move a
 * clip; the layout has to follow it.
 */
export const isGameplay = (clip: ClipName): boolean => clip.startsWith("broll");

/** public/footage is gitignored and filled by hand, so a component in the browser has to ask
 * the bundler's manifest whether a file is actually there. Same call `Clip` makes. */
const isPresent = (path: string): boolean => getStaticFiles().some((asset) => asset.name === path);

/**
 * A clip, drawn to fill exactly the element it is given.
 *
 * `fit` is the whole point of the component: "contain" is passed for app screens, where the
 * element has already been sized to the clip's own aspect by `fitApp` so nothing is letterboxed
 * and nothing is cropped, and "cover" for gameplay, where cropping the sides is the only
 * sensible thing a vertical frame can do with a landscape capture.
 */
export const Source = ({
  clip,
  from,
  fit,
  filter,
}: {
  clip: ClipName;
  from: number;
  fit: "cover" | "contain";
  filter?: string;
}) => {
  const entry = clips[clip];
  const path = `footage/${entry.file}`;
  if (!isPresent(path)) {
    return <AbsoluteFill style={{ backgroundColor: "#101014" }} />;
  }
  return (
    <OffthreadVideo
      src={staticFile(path)}
      trimBefore={Math.round((entry.from + from) * FPS)}
      trimAfter={Math.round(entry.to * FPS)}
      muted
      style={{ width: "100%", height: "100%", objectFit: fit, filter }}
    />
  );
};

/**
 * Gameplay, full bleed.
 *
 * A slow scale is the one camera move in these directions, and it is on the GAME rather than on
 * the app for the reason above: a landscape capture in a vertical frame is already cropped by
 * 58% of its width, so a further 2% costs nothing that is not already gone, and a game shot
 * that sits perfectly still under a moving film reads as a photograph. It is a scale ramp
 * rather than an idle drift: it starts moving at the cut and it is still moving at the next
 * one, which is the doctrine's rule, and it never parks.
 */
export const GameBed = ({
  clip,
  from,
  frames,
  scaleFrom = 1.04,
  scaleTo = 1.1,
  filter,
}: {
  clip: ClipName;
  from: number;
  frames: number;
  scaleFrom?: number;
  scaleTo?: number;
  filter?: string;
}) => {
  const frame = useCurrentFrame();
  const scale = scaleFrom + ((scaleTo - scaleFrom) * frame) / Math.max(1, frames);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${scale.toFixed(4)})` }}>
        <Source clip={clip} from={from} fit="cover" filter={filter} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
