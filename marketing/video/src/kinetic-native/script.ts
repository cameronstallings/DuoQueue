/**
 * The cut, as data. Two tracks over one clock.
 *
 * TRACK 1, the beats: huge fitted type over a graded plate. This is direction B, which is what
 * Cameron picked, and it is what stops the scroll. Each line is fitted to the frame width on
 * its own, so a three letter line comes out enormous and a seven letter line comes out
 * modest and the block is flush on both edges with no sizing anywhere in this file. Breaking
 * the copy into short lines by hand IS the authoring surface.
 *
 * TRACK 2, the rail: a small caption line low in the frame, revealed word by word with one
 * keyword picked out in the accent. This is direction A's treatment, and per the captions
 * doctrine it is an OVERLAY composited on top of the whole film rather than a band the layout
 * makes room for. It runs on its own clock: a cue may hold across a cut, and a cut may land
 * inside a cue. Cue 5 does exactly that, holding across the seam between "same game" and
 * "same hours", which is what proves the two tracks are independent.
 *
 * The two tracks are two registers and never say the same words. The display type is the
 * claim; the rail is the read. A rail that echoed the type would be the same sentence twice
 * at two sizes, which is the failure mode of every kinetic video with captions bolted on.
 *
 * PACING. Cameron's note on direction B was that it is a little fast when switching between
 * clips. Two things are done about it and only one of them is length. Every beat is longer
 * than B's equivalent, with a floor of 30 frames where B went down to 18, because an 18 frame
 * beat cannot contain a 0.6s seam and still hold. But the fix that matters is that the cuts
 * are now velocity matched and land mid motion on both sides, which is what makes fast
 * cutting read as deliberate rather than as jarring. B's cuts were hard and unmatched: the
 * eye's momentum died at every one of them, and eight dead stops in nine seconds is what
 * "too fast" actually feels like.
 *
 * COPY RULES, which the direction does not relax. Platonic only: this is an 18+ gaming app
 * and nothing may imply dating. The banned words are sayable only inside a denial, which is
 * why beat 1 exists at all, because "no, this is not a dating app" is the strongest opening
 * the spec has. No em dash anywhere a viewer can read. Stored lowercase in the house voice
 * and uppercased at render time, because all caps is a typographic decision rather than a
 * change of voice.
 */
import type { ClipName } from "@/types";

export type Treatment =
  /** Footage sunk almost to black behind full width type. The default. */
  | "shadow"
  /** Footage duotoned black to accent. Reads as texture, not as a screen recording. */
  | "duotone"
  /** The frame floods accent and the type goes black. Spent on the shortest beats. */
  | "flood"
  /** Footage visible only inside the letterforms, on black. */
  | "knockout"
  /** Footage nearly clean under a smaller statement. The proof beat, and the only place a
   * viewer gets to see that the app is real. Exactly one per cut. */
  | "proof";

export interface Beat {
  /** Beat length in frames at 30fps. Floor of 30: a 0.6s seam is 18 of them. */
  frames: number;
  /** Lines of the statement, each fitted to the frame width independently. */
  lines: string[];
  /**
   * Local frame each LINE's cascade begins. One entry per line. This is the doctrine's
   * STAGED REVEAL route and it is the single thing that stops this film being a slideshow.
   *
   * Left off, every line arrives at once and the whole statement is composed within half a
   * second. That is what the first render did, and the result was that every beat in the film
   * was pixel for pixel identical for between two thirds of a second and a second and a
   * quarter before its exit began. The doctrine's test is to pause at any second and find
   * something meaningful mid flight, and a composed statement over a plate you cannot see
   * moving fails it. The route the doctrine names for two or more content groups is to hold
   * content back and pay it off, so the sentence now finishes ON SCREEN rather than arriving
   * whole and then waiting.
   *
   * A negative entry means the line is already partway through its own entrance at local
   * frame 0. Only the opening beat uses that, and it is how frame one carries the hook while
   * still being visibly in motion.
   *
   * This is a staged reveal and NOT a stagger, which is why it may span more than the
   * doctrine's 500ms stagger ceiling: each line is its own group, each group's internal
   * cascade is about 0.2s, and no single entry runs longer than 0.3s.
   */
  reveal?: number[];
  /** Words rendered in the accent, matched case insensitively. */
  accent?: string[];
  /** Words that get a filled accent slab behind them, which wipes in under the word. */
  slab?: string[];
  clip: ClipName;
  /** Seconds into the trimmed clip this beat starts at, so two beats over one clip are two
   * different moments rather than the same second played twice. */
  clipFrom: number;
  treatment: Treatment;
  /**
   * Left is only for a block that is deliberately narrower than the frame.
   *
   * Every line of a full width statement is fitted to the SAME width, so left and centre
   * produce an identical block and differ only in where the leftover margin goes. When the
   * height budget scales a four line stack down, that leftover is real: left alignment parks
   * all of it on the right hand side and the frame reads as unbalanced rather than as flush.
   * Centre splits it. The proof beat is the exception and means it, because a block at 62% of
   * the width anchored left is a caption to a screenshot rather than a headline over one.
   */
  align?: "center" | "left";
  /**
   * Fraction of the safe box width the lines are fitted to. Left off, a statement takes the
   * full width, which is the direction's default and its whole signature.
   *
   * The proof beat is the one that sets it. That beat is the only place a viewer sees the
   * real product, and a statement at full width lands squarely across the app's own interface
   * copy: two things fighting to be read at once, which is worse than either alone. Fitting it
   * to two thirds of the box makes the type the caption to a screenshot rather than a headline
   * over one, which is what that beat is actually doing.
   */
  fitWidth?: number;
  /** Whole block tilt in degrees. One or two, never more. */
  tilt?: number;
  /** A small mono line under the block. The machine voice, used once. */
  note?: string;
  /** Local frame the note arrives. A staged reveal in its own right. */
  noteAt?: number;
  /**
   * Only the opening beat sets this. It shifts the whole word cascade backwards so frame 0
   * already carries the statement, mid flight rather than at rest. The doctrine's rule is
   * that the first frame carries the hook and that fading up into an empty opening frame is
   * not allowed; the first half second is the only half second there is.
   */
  open?: boolean;
  /**
   * This beat is the film's ARRIVAL and enters on the reserved inverse zoom rather than on
   * the current. Exactly one beat may set it. The beat before it inherits the matching
   * receding exit, and this beat composes its words instead of cascading them in, because a
   * grow from small entrance inside a retracting wrapper flips the scale sign.
   */
  arrival?: boolean;
  /** Local frame the camera parks at. Used to schedule stillness before the climax. */
  camStop?: number;
  /** Local frame the camera starts at. Used to hold the plate still under an inverse zoom
   * entry, so the plate's own push does not fight the retraction's sign. */
  camStart?: number;
  /** Local frame the accent slab wipes in at. A staged reveal, used on the payoff so the
   * arrival keeps performing after it lands instead of sitting there. */
  slabAt?: number;
}

/** One caption. Lines are authored rather than wrapped, because where a phrase breaks is a
 * reading decision and a container width is not. One line per cue. */
export interface Cue {
  line: string;
  /** How long it holds. Cues run back to back and are timed against the beats by hand. */
  frames: number;
  /** The word that carries the beat, matched case insensitively. */
  accent?: string;
  /**
   * How that word is marked. `box` is the highlighter, and it is this direction's scarce
   * peak: the captions doctrine's rail and embed model says the promoted word is earned,
   * never two adjacent and never more than one per beat. Two in the whole film, at the
   * denial and at the ask, and never anywhere near each other.
   */
  mark?: "color" | "box";
  /** Puts the whole line up already composed. The opening cue uses it, for the same reason
   * beat 1 sets `open`. */
  instant?: boolean;
}

export interface KineticNativeScript {
  id: string;
  /** The post caption, doing the same job as `Hook.caption` in src/data/hooks.ts. */
  caption: string;
  beats: Beat[];
  cues: Cue[];
}

export const KINETIC_NATIVE: KineticNativeScript = {
  id: "kinetic-native-001",
  caption: "no, not that kind of swiping. it is a duo finder.",

  // 50 + 42 + 38 + 32 + 30 + 30 + 34 + 50 + 50 = 356 frames of body, 11.9s.
  beats: [
    // Beat 1, frames 0 to 50. The denial, because everyone assumes wrong and the correction
    // is the hook. Four short lines rather than two long ones is what lets it fill the frame
    // instead of sitting in a caption bar.
    {
      frames: 50,
      lines: ["this is", "not a", "dating", "app"],
      accent: ["not"],
      // The stamp. NOT is already the accent at frame 0, so the hook is red in frame one; at
      // local frame 22 a filled slab wipes across it and the word flips to near black. That
      // is the beat's second event and it lands on the word the whole film turns on.
      slab: ["not"],
      slabAt: 22,
      // Three lines are already landed at frame 0 and the last of them is 3 frames into its
      // own power4.out, so the opening frame carries the hook AND is visibly moving. APP is
      // held back to local frame 10, so the sentence completes on screen rather than arriving
      // whole and then sitting there for a second and a quarter.
      reveal: [-8, -6, -3, 10],
      // Gameplay, not the app, and this is a copy decision rather than a look decision.
      //
      // It used to run over duo-locked, which is a phone screen with a large round photo of a
      // face in the middle of it. A blurred face behind the words THIS IS NOT A DATING APP
      // argues the opposite of the sentence: it is the single most counterproductive image
      // available to this beat. The app's own message bar also sat as a hard bright band
      // straight across the word DATING and read as a rendering fault rather than as footage.
      //
      // A firefight says "game" in the frame that carries the hook, which is what the denial
      // is actually denying, and it has no faces and no straight edges in it.
      clip: "broll-teamfight",
      clipFrom: 1.0,
      treatment: "shadow",
      align: "center",
      tilt: -1.2,
      open: true,
    },
    // Beat 2, 50 to 92. What it actually is.
    {
      frames: 42,
      lines: ["it is", "where you", "find", "a duo"],
      slab: ["duo"],
      // The answer is held back: the setup lands, then FIND, then A DUO, then the slab stamps
      // DUO. Four events across 42 frames, and the last one is the word that matters.
      reveal: [0, 2, 9, 16],
      slabAt: 25,
      clip: "deck-cards",
      clipFrom: 0.4,
      treatment: "duotone",
      align: "center",
    },
    // Beat 3, 92 to 130. What you are choosing on.
    {
      frames: 38,
      lines: ["you swipe", "on how", "they play"],
      accent: ["play"],
      reveal: [0, 3, 12],
      clip: "deck-cards",
      clipFrom: 4.4,
      treatment: "shadow",
      align: "center",
      tilt: 1,
    },
    // Beat 4, 130 to 162. The frame floods. Two words, and the whole screen changes colour
    // while the words from beat 3 are still streaking off it.
    {
      frames: 32,
      lines: ["not", "faces"],
      reveal: [0, 9],
      clip: "deck-dark",
      clipFrom: 2.0,
      treatment: "flood",
      align: "center",
    },
    // Beats 5 to 7, 162 to 256. The three filters, one clause each, over gameplay knocked out
    // of the letterforms. The fastest stretch of the cut. Thirty frames is the floor: at
    // eighteen, which is what direction B used, a 0.6s seam leaves nothing on screen to hold.
    //
    // The gameplay clips only ever appear knocked out. Another player's gamertag is on screen
    // throughout the source recording and it must not be legible in anything published; the
    // centre crop loses the kill feed and the letterform mask finishes the job.
    // SAME is the constant and the second word is the variable, so SAME lands first and the
    // word that changes is the paid off reveal. Over 30 frames that is: cascade in, second
    // word lands at 8, exit begins at about 19. The beat is never at rest, and the gameplay
    // inside the letterforms travels under the camera the whole time.
    //
    // The clipFrom values are picked for what is actually in the letters, and the currency
    // is VALUE rather than subject: a knockout letter is only ever as bright as the plate
    // behind it. 7.4s of the firefight is a flat bright wall and 2.6s is a dark corridor that
    // knocked SAME GAME down to a mid grey; 4.2s is the fight itself, lit. 4.6s
    // of the lost round is the dark scoreboard, which knocks out as grey letters on black;
    // 1.6s is the ability going off, which is the brightest and busiest frame in that clip
    // and is also the one that means what the word ENERGY means.
    {
      frames: 30,
      lines: ["same", "game"],
      reveal: [0, 8],
      clip: "broll-teamfight",
      clipFrom: 4.2,
      treatment: "knockout",
      align: "center",
    },
    {
      frames: 30,
      lines: ["same", "hours"],
      reveal: [0, 8],
      clip: "broll-quiet",
      clipFrom: 0.6,
      treatment: "knockout",
      align: "center",
    },
    {
      frames: 34,
      lines: ["same", "energy"],
      reveal: [0, 8],
      clip: "broll-loss",
      clipFrom: 1.6,
      treatment: "knockout",
      align: "center",
    },
    // Beat 8, 256 to 306. The one beat that shows the product plainly, and the major action
    // the climax answers. Smaller type on purpose: this is the second the footage is the
    // argument rather than the surface.
    //
    // camStop parks the camera at local frame 29, which buys 15 frames of true stillness
    // before the 6 frame receding exit at 44. That pause is the doctrine's dramatic comma and
    // it is the only frame in the film where nothing at all is moving. Everywhere else a
    // still frame would be the bug; here it is the reason the payoff lands.
    {
      frames: 50,
      lines: ["everyone here", "wants a duo"],
      accent: ["duo"],
      reveal: [0, 11],
      clip: "duo-locked",
      clipFrom: 4.4,
      treatment: "proof",
      align: "left",
      fitWidth: 0.62,
      // It used to read "that is the whole filter", which is word for word the rail cue that
      // had been on screen for the second before it. Two registers saying the same sentence
      // at two sizes a second apart is the exact failure this file's own header warns about.
      note: "no photos in the deck",
      noteAt: 22,
      // Parked early and shallow. Two things want it there. The framing has to stay inside a
      // narrow window, between letting the recording's notification banner into the top of
      // the frame and cropping the lime DUO LOCKED header off it, and a full length push at
      // this beat's base scale would leave that window. And parking at 12 means the plate is
      // already at rest by the time the last staged reveal lands at 27, so what follows is 17
      // frames in which nothing at all moves before the receding exit at 44. That is 0.57s,
      // inside the doctrine's 0.3 to 0.75s dramatic comma, and it is the only still stretch
      // in the film.
      camStop: 12,
    },
    // Beat 9, 306 to 356. The payoff, and the film's ARRIVAL. It is the one beat that does not
    // enter on the current: it arrives oversized on the reserved inverse zoom and retracts
    // into the focal plane, which is the vector the doctrine reserves for something bigger
    // landing. Its words are composed rather than cascaded, because a grow from small
    // entrance under a retracting wrapper flips the scale sign, and camStart holds the plate
    // still until the retraction has settled for the same reason.
    //
    // Then it keeps performing: the slab wipes in under DUO at local frame 22, a staged
    // reveal rather than a wobble, and the block cuts left into the end card at 42.
    //
    // Knocking out of the Paper deck rather than a dark screen is deliberate. A knockout
    // letter is only ever as bright as the plate behind it, and the light half of the
    // recording is the brightest material in the set, so this is the one beat where the words
    // go properly white.
    {
      frames: 50,
      lines: ["find", "your", "duo"],
      slab: ["duo"],
      clip: "deck-light",
      clipFrom: 1.2,
      treatment: "knockout",
      align: "center",
      arrival: true,
      camStart: 15,
      slabAt: 24,
    },
  ],

  // The rail. Cue lengths are timed against the beats above by hand: 50, 42, 38, 32, then one
  // 60 frame cue holding across a cut, then 34, 50, 50. They sum to the same 356.
  cues: [
    { line: "everyone gets this wrong", frames: 50, accent: "wrong", mark: "box", instant: true },
    { line: "it is a duo finder", frames: 42, accent: "duo" },
    { line: "you match on playstyle", frames: 38, accent: "playstyle" },
    { line: "never on a photo", frames: 32, accent: "never" },
    // Holds across the seam between "same game" and "same hours". The cut lands inside it.
    { line: "three things have to match", frames: 60, accent: "three" },
    { line: "that is the whole filter", frames: 34, accent: "whole" },
    // The positioning line, said plainly once. It is the single most load bearing sentence in
    // the account and it plays over the only shot of the real product.
    { line: "18 plus and platonic", frames: 50, accent: "platonic" },
    // The ask, and the second and last highlighter in the film.
    { line: "stop queueing alone", frames: 50, accent: "alone", mark: "box" },
  ],
};

/** Body length in frames, derived rather than typed, so a retimed beat moves the composition
 * with it and the end card cannot end up overlapping the last statement. */
export const bodyFrames = (script: KineticNativeScript): number =>
  script.beats.reduce((total, beat) => total + beat.frames, 0);
