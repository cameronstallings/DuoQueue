/**
 * The queue for Direction A. Same idea as src/data/hooks.ts, one object per video, but a
 * native-format post is an edit and not a hook: it needs a shot list and a caption track, and
 * neither fits in a `Hook`. The four shipping formats and their queue are untouched by this
 * file, and `pnpm video:day` never reads it.
 *
 * House rules that still apply, because they are about the product and not about the look:
 * no line implies dating, and no string contains an em dash. The banned words appear here
 * exactly once, inside the denial that is the strongest hook this app has.
 *
 * Reading the shot list: every shot names the fraction of the SOURCE recording it is aiming
 * at (`fy`) and where in the 1080x1920 frame that point should sit (`ty`), at two scales. The
 * numbers came off the frames in this directory, not out of taste:
 *
 *   0.556  the middle of a deck card, in the app recording
 *   0.387  the middle of the DUO LOCKED block
 *   0.565  the message input, mid-type
 *   0.500  the middle of a gameplay frame, which is where the crosshair is
 *
 * Scale on app footage stays at or under about 1.16. The app recording is full bleed
 * horizontally once `cover` has fitted it to 1080, so a harder punch starts eating the first
 * character of every line of card copy. Gameplay has 68% of its width cropped away already
 * and can take as much punch as it likes.
 */
import type { ClipName } from "@/types";

import { aim, checkShots } from "./framing";
import type { NativeScript, Shot } from "./types";

const cut = (
  clip: ClipName,
  start: number,
  frames: number,
  move: { fy: number; from: [ty: number, scale: number]; to: [ty: number, scale: number] },
  extra: { rate?: number; punch?: number; flash?: boolean } = {},
): Shot => ({
  clip,
  start,
  frames,
  from: aim(clip, { fy: move.fy, ty: move.from[0], scale: move.from[1] }),
  to: aim(clip, { fy: move.fy, ty: move.to[0], scale: move.to[1] }),
  ...extra,
});

/** The ceiling for a caption that plays over app footage. Full size, it would sit across the
 * card it is describing. */
const OVER_APP = 84;

/**
 * native-001. Four beats of the evening, one flash, and six beats of what the app is.
 *
 * The turn is at frame 156, five and a quarter seconds in, and everything before it is
 * gameplay with no product in it at all: a viewer who scrolls at second four has still been
 * told something true about their own night. The first line the app appears under is the
 * denial, because "not a dating app" is the only sentence about this product that a stranger
 * will stop for.
 */
const soloQueue: NativeScript = {
  id: "native-001",
  caption: "your aim was never the problem",
  shots: [
    // DEFEAT, already legible at frame 0: the word, in red, under the hook. 5.5s and not 5.25s
    // because the screen arrives on a full-frame red wipe, and a first frame that is loud but
    // unreadable buys attention it then has nothing to spend on.
    cut("broll-loss", 5.5, 36, { fy: 0.52, from: [950, 1.06], to: [970, 1.16] }),
    // Jump cut back inside the same clip to the death that lost it. Pulls out where the shot
    // before pushed in, so two cuts of one file do not read as one long shot.
    cut("broll-loss", 1.3, 36, { fy: 0.52, from: [960, 1.2], to: [940, 1.08] }),
    // The one shot in the pain half with a fight in it: an enemy in a lit doorway over a
    // molly. The first second of this clip is a dark corridor and reads as nothing at all, and
    // it goes black at about 8.7s, which is why this ends at 8.45 and not later.
    cut("broll-teamfight", 7.25, 36, { fy: 0.5, from: [960, 1.1], to: [980, 1.22] }),
    // The longest shot in the video, and the emptiest: an entire site walked alone. It also
    // has the least happening in it, so it carries the widest push of the ten to compensate.
    cut("broll-quiet", 1.8, 48, { fy: 0.5, from: [960, 1.02], to: [990, 1.26] }),
    // The turn. Two frames of white, a scale kick, and the app for the first time.
    cut("deck-cards", 0.4, 45, { fy: 0.556, from: [1025, 1.18], to: [1050, 1.06] }, {
      rate: 1.3,
      punch: 0.06,
      flash: true,
    }),
    cut("duo-locked", 2.6, 39, { fy: 0.387, from: [760, 1.14], to: [740, 1.24] }, { rate: 1.2 }),
    // Marcus first and Remy second, because of what is on the two cards. "match on games" plays
    // over the card whose game tag is the loudest thing on it, and "not on looks" plays over
    // the one with generated art and no face: the line and the frame agree instead of arguing.
    cut("deck-cards", 6.3, 33, { fy: 0.556, from: [1045, 1.08], to: [1035, 1.15] }, { rate: 1.3 }),
    cut("deck-cards", 3.9, 33, { fy: 0.556, from: [1035, 1.16], to: [1045, 1.09] }, { rate: 1.3 }),
    cut("chat-typing", 2.6, 36, { fy: 0.565, from: [1040, 1.1], to: [1030, 1.18] }, { rate: 1.25 }),
    // Ends on the DUO stamp landing on a card, which is the one moment of app footage that is
    // the product working rather than the product being used.
    cut("deck-dark", 5.1, 42, { fy: 0.556, from: [1030, 1.12], to: [1040, 1.2] }, { rate: 1.15 }),
  ],
  cues: [
    { frames: 36, lines: ["nobody said", "a word"], accent: "nobody", instant: true },
    { frames: 36, lines: ["four games", "in a row"], accent: "four" },
    { frames: 36, lines: ["you played fine"] },
    { frames: 48, lines: ["you just", "played alone"], accent: "alone" },
    // The one highlighter in the video, on the word the whole positioning turns on.
    { frames: 45, lines: ["this is not a dating app"], accent: "not", accentStyle: "box", max: OVER_APP },
    { frames: 39, lines: ["it finds you a duo"], accent: "duo", max: OVER_APP },
    { frames: 33, lines: ["match on games"], max: OVER_APP },
    { frames: 33, lines: ["not on looks"], accent: "not", max: OVER_APP },
    { frames: 36, lines: ["18 plus and platonic"], max: OVER_APP },
    { frames: 42, lines: ["stop queueing", "alone"], accent: "alone" },
  ],
};

export const nativeScripts: readonly NativeScript[] = [soloQueue];
export const NATIVE_DEFAULT = soloQueue;

const framesOf = (parts: readonly { frames: number }[]): number =>
  parts.reduce((total, part) => total + part.frames, 0);

/** Runs when this module loads, which is before the first frame is drawn, so a shot that
 * outruns its clip or a framing that would show the frame edge stops the render with a
 * sentence instead of shipping a black corner. The cue track is checked against the shot
 * track for the same reason: a caption that runs past the last cut would play over the end
 * card. */
for (const script of nativeScripts) {
  checkShots(script.id, script.shots);
  const body = framesOf(script.shots);
  const captions = framesOf(script.cues);
  if (captions > body) {
    throw new Error(
      `${script.id} has ${captions} frames of caption over ${body} frames of footage.`,
    );
  }
}

export const nativeBodyFrames = (script: NativeScript): number => framesOf(script.shots);
