/**
 * DIRECTION B data. A kinetic post is a list of beats, not a hook with two lines, so it needs
 * its own shape rather than a fifth arm on the `Hook` union in src/types.ts. Nothing here is
 * imported by the shipping pipeline and `pnpm video:day` cannot see it.
 *
 * The rhythm rule this file exists to enforce: no beat runs longer than 45 frames (1.5s) and
 * the median is around 30 (1.0s). That is the cut rate of the feed this has to survive in.
 * When a statement needs longer than that, it gets split into two beats over the same clip at
 * different framings, which reads as a jump cut and buys the extra second without stillness.
 *
 * Copy rules are the repo's and are not relaxed by the direction: platonic only, and the
 * banned words are sayable only inside a denial ("this is not a dating app" is the strongest
 * opening the spec has). No em dash. Stored lowercase in the house voice and uppercased at
 * render time, because all-caps is a typographic decision and not a change of voice.
 */
import type { ClipName } from "@/types";

export type Treatment =
  /** Footage sunk almost to black behind full-width type. The default. */
  | "shadow"
  /** Footage duotoned black-to-accent. Reads as texture, not as a screen recording. */
  | "duotone"
  /** The frame floods accent and the type goes black. Used on the shortest beats. */
  | "flood"
  /** Footage visible only inside the letterforms, on black. The payoff move. */
  | "knockout"
  /** Footage nearly clean under one small line. The proof beat, and the only place a viewer
   * gets to see that the app is real. Exactly one per cut. */
  | "proof";

export interface Beat {
  /** Beat length in frames at 30fps. Keep inside 15 to 45. */
  frames: number;
  /** Lines of the statement, each fitted to the frame width independently. Two or three at
   * most: four lines of display type is a paragraph and paragraphs do not get watched. */
  lines: string[];
  /** Words rendered in the accent colour, matched case insensitively against the copy. */
  accent?: string[];
  /** Words that get a filled accent slab behind them, which wipes in under the word. */
  slab?: string[];
  clip: ClipName;
  /** Seconds into the clip this beat starts at, so two beats over one clip are two different
   * moments rather than the same second played twice. */
  clipFrom: number;
  treatment: Treatment;
  align?: "center" | "left";
  /** Where the type block sits vertically inside the safe box. */
  anchor?: "high" | "mid" | "low";
  /** Whole-block tilt in degrees. One or two, never more. */
  tilt?: number;
  /** Frames of accent flash at the cut into this beat. 0 to 3. */
  flash?: number;
  /** A small mono line under the block. The machine voice, used sparingly. */
  note?: string;
  /** Only the opening beat sets this. It shifts the whole word stagger backwards so that
   * frame 0 is already carrying the statement rather than fading it up out of black. The
   * first half second decides whether anyone watches, and an empty frame spends it. */
  openLanded?: boolean;
}

export interface KineticPostData {
  id: string;
  /** The post caption, same job as `Hook.caption` in the shipping pipeline. */
  caption: string;
  beats: Beat[];
}

/**
 * The sample cut. Nine beats, 278 frames of body, 9.3 seconds, average cut 31 frames, shortest 18.
 *
 * The argument it makes, in order: the denial (which is the hook, because everyone assumes
 * wrong), what it actually is, what you are actually choosing on, the three things a duo
 * needs, proof that the product exists, and the ask.
 *
 * Gameplay b-roll only ever appears knocked out or duotoned past recognition. That is a
 * design choice and also a practical one: another player's gamertag is on screen in the
 * source recording, and it must not be readable in anything published.
 */
export const kineticSample: KineticPostData = {
  id: "kinetic-001",
  caption: "no, not that kind of swiping. it is a duo finder.",
  beats: [
    // Line breaks are the authoring surface, not decoration. Each line is fitted to the frame
    // width on its own, so a four-character line comes out enormous and a twelve-character
    // line comes out modest. Breaking the denial across four short lines is what lets it fill
    // the frame instead of sitting in a caption bar.
    {
      frames: 44,
      lines: ["this is", "not a", "dating", "app"],
      accent: ["not"],
      clip: "duo-locked",
      clipFrom: 1.2,
      treatment: "shadow",
      align: "left",
      anchor: "mid",
      tilt: -1.2,
      openLanded: true,
    },
    {
      frames: 34,
      lines: ["it is", "where you", "find", "a duo"],
      slab: ["duo"],
      clip: "deck-cards",
      clipFrom: 0.4,
      treatment: "duotone",
      align: "left",
      anchor: "mid",
      flash: 2,
    },
    {
      frames: 32,
      lines: ["you swipe", "on how", "they play"],
      accent: ["play"],
      clip: "deck-cards",
      clipFrom: 4.4,
      treatment: "shadow",
      align: "left",
      anchor: "low",
      tilt: 1,
    },
    {
      frames: 26,
      lines: ["not", "faces"],
      clip: "deck-dark",
      clipFrom: 2.0,
      treatment: "flood",
      align: "center",
      anchor: "mid",
      flash: 2,
    },
    // Three beats of eighteen to twenty four frames, one clause each. The fastest stretch of
    // the cut, and the one that makes the whole thing feel like it was edited on a phone.
    {
      frames: 18,
      lines: ["same", "game"],
      clip: "broll-teamfight",
      clipFrom: 7.4,
      treatment: "knockout",
      align: "center",
      anchor: "mid",
    },
    {
      frames: 18,
      lines: ["same", "hours"],
      clip: "broll-quiet",
      clipFrom: 0.6,
      treatment: "knockout",
      align: "center",
      anchor: "mid",
    },
    {
      frames: 24,
      lines: ["same", "energy"],
      clip: "broll-loss",
      clipFrom: 0.4,
      treatment: "knockout",
      align: "center",
      anchor: "mid",
    },
    // The one beat that shows the product. Smaller type on purpose: this is the second the
    // footage is the argument rather than the surface.
    {
      frames: 38,
      lines: ["everyone here", "wants a duo"],
      accent: ["duo"],
      clip: "duo-locked",
      clipFrom: 4.4,
      treatment: "proof",
      align: "left",
      anchor: "low",
      note: "that is the whole filter",
    },
    {
      frames: 44,
      // The payoff knocks out of the Paper deck rather than a dark screen. A knockout letter
      // is only ever as bright as the plate behind it, and the light half of the recording is
      // the brightest material in the set, so this is the one beat where the words go white.
      lines: ["find", "your", "duo"],
      clip: "deck-light",
      clipFrom: 1.2,
      treatment: "knockout",
      align: "center",
      anchor: "mid",
      flash: 3,
    },
  ],
};

/** Body length in frames, derived rather than typed, so a retimed beat moves the composition
 * with it and the end card cannot end up overlapping the last statement. */
export const bodyFrames = (post: KineticPostData): number =>
  post.beats.reduce((total, beat) => total + beat.frames, 0);
