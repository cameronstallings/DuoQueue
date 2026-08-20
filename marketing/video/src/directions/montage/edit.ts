/**
 * The edit. Direction C is a cutting exercise, so the whole direction is really this file:
 * a shot list, a caption track, and the arithmetic that turns them into frame numbers.
 *
 * Two rules run the structure.
 *
 * The video has two emotional poles and cuts between them. DEFEAT ends the first half and
 * DUO LOCKED ends the second, both slowed to a crawl on the frame that matters while every
 * shot around them runs fast. Everything before DEFEAT is solo queue going badly, graded
 * cold. Everything after it is the app, graded live. The turn between them is three black
 * frames, which is the only pause in the video.
 *
 * And nothing sits still. No shot is longer than 0.8s except the two poles, every shot is
 * moving in scale, and no caption is on screen for more than about a second. The first
 * caption carries no entrance animation at all, because frame zero has to arrive already
 * carrying the hook rather than fading up into it.
 *
 * Timecodes are seconds into the clip FILE, which is what "at" means everywhere below. The
 * files and their usable ranges are src/data/clips.ts, and assertShotsFitTheirClips() at the
 * bottom refuses to load if a shot plus its ramp would run past the end of one: OffthreadVideo
 * renders nothing at all past a clip's end, so that mistake is a black frame in a finished cut.
 */
import { clips } from "@/data/clips";
import type { ClipName } from "@/types";

import { consumedSeconds, type Rate } from "./timing";

/** Cold is the solo-queue half, live is the app half. Grading the two halves differently is
 * what makes the turn at DEFEAT read as a turn rather than as the next shot. */
export type Grade = "cold" | "live";
/** How a shot arrives. "whip" is a smeared pan into place, "slam" is a hard scale hit used
 * only on the two poles, "cut" is a straight cut. */
export type Enter = "cut" | "whip" | "slam";
export type Ink = "hot" | "volt" | "ink" | "void";

export interface Shot {
  clip: ClipName;
  /** Seconds into the clip file. */
  at: number;
  frames: number;
  /** Constant speed, or a ramp. Defaults to 1. */
  rate?: Rate;
  /** Scale at the start and end of the shot. Never below 1: the frame has to stay covered. */
  zoom?: [number, number];
  /** The point of the 1080x1920 frame the zoom is centred on, clamped so no edge shows. */
  focus?: [number, number];
  grade?: Grade;
  enter?: Enter;
  /** Which way a whip comes from. */
  whip?: -1 | 1;
  /** A full-frame flash painted over the cut INTO this shot. */
  flash?: { ink: Ink; frames: number };
  /** Camera shake at the top of the shot, 0 to 1. */
  shake?: number;
}

export interface Caption {
  /** The shot this caption lands on. Captions are authored against shots and not against
   * frames so that lengthening a shot moves its caption with it. */
  shot: number;
  offset?: number;
  hold: number;
  /** One string per rendered line. Every word animates in on its own. */
  lines: string[];
  /** The one word that gets a filled block behind it. */
  accent?: string;
  accentInk?: "hot" | "volt";
  place?: "low" | "mid";
  /** No entrance animation: the words are simply there. Frame zero needs this. */
  instant?: boolean;
}

// ---------------------------------------------------------------------------------------
// ACT ONE. Solo queue, cold, four shots of two-word captions and then the first pole.
// ---------------------------------------------------------------------------------------
const ACT_ONE: Shot[] = [
  // Frame zero is the DEFEAT scoreboard, already slowing down, with the hook already on it.
  // Opening on the end of the story is trailer grammar and it buys the loudest available
  // first frame: red type on near black, nothing else in the palette like it.
  { clip: "broll-loss", at: 5.36, frames: 18, rate: { from: 0.9, to: 0.24 },
    zoom: [1.12, 1.24], focus: [540, 900], grade: "live", shake: 0.35 },

  // Walking an empty Breeze alone. Fast, so the daylight lands as a change of place.
  { clip: "broll-quiet", at: 1.30, frames: 13, rate: 1.7,
    zoom: [1.30, 1.14], focus: [540, 980], grade: "cold", enter: "whip", whip: -1 },

  // The dark tunnel before contact.
  { clip: "broll-teamfight", at: 2.30, frames: 12, rate: 1.9,
    zoom: [1.10, 1.26], focus: [540, 900], grade: "cold", enter: "whip", whip: 1 },

  // Taking the fight and losing it: the health bar drops across these twelve frames.
  { clip: "broll-teamfight", at: 4.10, frames: 12, rate: { from: 2.2, to: 0.9 },
    zoom: [1.30, 1.14], focus: [540, 860], grade: "cold",
    flash: { ink: "hot", frames: 2 }, shake: 0.5 },

  // Back to the empty map. The rhythm needs one shot with no caption on it before the pole.
  { clip: "broll-quiet", at: 6.40, frames: 11, rate: 2.0,
    zoom: [1.12, 1.28], focus: [540, 1000], grade: "cold", enter: "whip", whip: -1 },

  // Spectating, which is what losing looks like from the inside.
  { clip: "broll-loss", at: 1.60, frames: 12, rate: 1.6,
    zoom: [1.26, 1.12], focus: [540, 880], grade: "cold", enter: "whip", whip: 1 },

  // POLE ONE. Starts on the red wash of the defeat splash at full speed and snaps to a
  // quarter speed as the word settles, so the slowdown happens ON the word.
  { clip: "broll-loss", at: 5.08, frames: 24, rate: { from: 1.6, to: 0.22 },
    zoom: [1.04, 1.22], focus: [540, 890], grade: "live", enter: "slam", shake: 1 },
];

// ---------------------------------------------------------------------------------------
// ACT TWO. The app, live, cut faster than act one and ending on the second pole.
// ---------------------------------------------------------------------------------------
const ACT_TWO: Shot[] = [
  // Three black frames and then a card. The app arrives without a logo, a title card or a
  // transition, which is the single biggest difference between this and an advert.
  { clip: "deck-cards", at: 0.95, frames: 14, rate: 1.35,
    zoom: [1.34, 1.18], focus: [540, 1120], grade: "live", flash: { ink: "void", frames: 3 } },

  // A card being passed on. Real swipe, real motion, no mock-up.
  { clip: "deck-cards", at: 3.40, frames: 12, rate: 1.5,
    zoom: [1.16, 1.32], focus: [540, 1060], grade: "live", enter: "whip", whip: -1 },

  // The Paper scheme, which at this speed reads as a hard cut to white.
  { clip: "deck-light", at: 1.60, frames: 12, rate: 1.4,
    zoom: [1.32, 1.16], focus: [540, 1140], grade: "live", enter: "whip", whip: 1 },

  // A profile: sliders and prompts, none of it about looks.
  { clip: "own-profile", at: 6.30, frames: 12, rate: 1.3,
    zoom: [1.18, 1.34], focus: [540, 1000], grade: "live", enter: "whip", whip: -1 },

  // Typing "when are you gonna be on tn". The most platonic sentence in the recording.
  { clip: "chat-typing", at: 4.60, frames: 13, rate: 1.45,
    zoom: [1.30, 1.16], focus: [540, 880], grade: "live", enter: "whip", whip: 1 },

  // The message lands. Framed tight and low on purpose: this screen is a sent bubble, an
  // input and then half a frame of black, and a wider punch spends that half frame on nothing.
  { clip: "chat-typing", at: 6.20, frames: 11, rate: 1.3,
    zoom: [1.40, 1.56], focus: [540, 1150], grade: "live", enter: "whip", whip: -1 },

  // The matches list: a party and three threads.
  { clip: "matches-light", at: 0.50, frames: 11, rate: 1.3,
    zoom: [1.30, 1.16], focus: [540, 720], grade: "live", enter: "whip", whip: 1 },

  // A card getting the duo stamp.
  { clip: "deck-dark", at: 2.90, frames: 11, rate: 1.25,
    zoom: [1.18, 1.34], focus: [540, 1080], grade: "live",
    flash: { ink: "volt", frames: 2 } },

  // And another one, from the other deck clip.
  { clip: "deck-cards", at: 8.30, frames: 11, rate: 1.1,
    zoom: [1.32, 1.18], focus: [540, 1100], grade: "live", enter: "whip", whip: -1 },

  // The bento again, higher up, because the eye needs one calmer shot before the pole.
  { clip: "own-profile", at: 2.20, frames: 11, rate: 1.35,
    zoom: [1.16, 1.30], focus: [540, 900], grade: "live", enter: "whip", whip: 1 },

  // POLE TWO, first half: the brackets snapping shut around Kofi. Same ramp shape as DEFEAT,
  // deliberately, so the two poles rhyme.
  { clip: "deck-dark", at: 6.02, frames: 22, rate: { from: 1.5, to: 0.26 },
    zoom: [1.30, 1.14], focus: [540, 700], grade: "live", enter: "slam", shake: 0.8 },

  // POLE TWO, second half: it happens again, with someone else. One reveal is a screenshot;
  // two is a product.
  { clip: "duo-locked", at: 0.26, frames: 22, rate: { from: 1.2, to: 0.3 },
    zoom: [1.16, 1.34], focus: [540, 660], grade: "live", flash: { ink: "ink", frames: 2 } },

  // Out on the conversation that follows, which is the actual promise: you play tonight.
  { clip: "chat-priya", at: 2.20, frames: 14, rate: 1.2,
    zoom: [1.30, 1.16], focus: [540, 860], grade: "live", enter: "whip", whip: -1 },
];

export const shots: Shot[] = [...ACT_ONE, ...ACT_TWO];

/** The frame each shot starts on, and the length of the montage before the end beat. */
export const SHOT_STARTS: number[] = [];
let cursor = 0;
for (const shot of shots) {
  SHOT_STARTS.push(cursor);
  cursor += shot.frames;
}
export const BODY_FRAMES = cursor;

// ---------------------------------------------------------------------------------------
// The caption track. Three or four words at a time, none of it on screen for long.
//
// House content rules still apply here even though the look does not: lowercase, no em dash,
// and the app is platonic, so the only line that names dating is the one that denies it.
// ---------------------------------------------------------------------------------------
export const captions: Caption[] = [
  { shot: 0, hold: 20, lines: ["solo queue again"], accent: "again", accentInk: "hot",
    place: "low", instant: true },
  { shot: 1, offset: 3, hold: 10, lines: ["no mic"], place: "low" },
  { shot: 2, offset: 1, hold: 11, lines: ["no plan"], place: "low" },
  { shot: 3, offset: 1, hold: 12, lines: ["no chance"], place: "low" },
  // The callback, landing under the word DEFEAT once the ramp has slowed onto it. It is what
  // turns the first pole from a picture into the end of a sentence, and it closes the only
  // stretch of the video with no text on it.
  { shot: 6, offset: 9, hold: 15, lines: ["and again"], accent: "again", accentInk: "hot",
    place: "low" },

  { shot: 7, offset: 2, hold: 24, lines: ["you swipe on", "playstyles"], place: "low" },
  { shot: 9, offset: 1, hold: 22, lines: ["not on faces"], place: "low" },
  { shot: 11, offset: 1, hold: 23, lines: ["not a dating app"], accent: "not",
    accentInk: "hot", place: "mid" },
  { shot: 14, offset: 1, hold: 21, lines: ["just duos"], accent: "duos", accentInk: "volt",
    place: "low" },
  { shot: 17, offset: 8, hold: 26, lines: ["duo locked"], accent: "locked", accentInk: "volt",
    place: "low" },
  // Four words on a fourteen frame shot, so it starts on the first frame of the cut and the
  // last word still gets a beat on screen of its own.
  { shot: 19, offset: 0, hold: 14, lines: ["then you just play"], place: "low" },
];

/**
 * OffthreadVideo renders NOTHING past the end of a clip, so a shot whose ramp eats more
 * source than the clip has leaves a hole in the middle of a finished video that nobody sees
 * until upload. The whole cut is checked here, at module load, which means Studio and the
 * renderer both fail immediately and by name.
 */
const assertShotsFitTheirClips = (): void => {
  shots.forEach((shot, index) => {
    const clip = clips[shot.clip];
    const eaten = consumedSeconds(shot.rate ?? 1, shot.frames, shot.frames);
    const end = shot.at + eaten;
    if (shot.at < clip.from) {
      throw new Error(
        `Montage shot ${index} starts at ${shot.at}s of "${shot.clip}", before its ${clip.from}s in point.`,
      );
    }
    if (end > clip.to) {
      throw new Error(
        `Montage shot ${index} plays "${shot.clip}" from ${shot.at}s and eats ${eaten.toFixed(2)}s, ` +
          `ending at ${end.toFixed(2)}s. The clip stops at ${clip.to}s and renders nothing after it.`,
      );
    }
  });
};

/**
 * Captions are authored against shot indices, so renumbering the cut is exactly the edit that
 * can point one at a shot that no longer exists, or leave one running past the last frame of
 * the montage and into the end beat where nothing would ever show it.
 */
const assertCaptionsLandOnShots = (): void => {
  captions.forEach((caption, index) => {
    const start = SHOT_STARTS[caption.shot];
    if (start === undefined) {
      throw new Error(
        `Montage caption ${index} ("${caption.lines.join(" ")}") is on shot ${caption.shot}, and there are only ${shots.length}.`,
      );
    }
    const end = start + (caption.offset ?? 0) + caption.hold;
    if (end > BODY_FRAMES) {
      throw new Error(
        `Montage caption ${index} ("${caption.lines.join(" ")}") runs to frame ${end}, past the ${BODY_FRAMES} the montage has.`,
      );
    }
  });
};

assertShotsFitTheirClips();
assertCaptionsLandOnShots();
