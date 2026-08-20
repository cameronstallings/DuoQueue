/**
 * The cut, as data. Two tracks over one clock, and the clock is the voice.
 *
 * TRACK 1, the beats: huge fitted type over footage. Each line is fitted to the frame width on
 * its own, so a three letter line comes out enormous and a ten letter line comes out modest
 * and the block is flush on both edges with no sizing anywhere in this file. Breaking the copy
 * into short lines by hand IS the authoring surface.
 *
 * TRACK 2, the rail: a small caption line low in the frame, revealed word by word with one
 * keyword picked out in the accent. Per the captions doctrine it is an OVERLAY composited on
 * top of the whole film rather than a band the layout makes room for. It runs on its own
 * clock: a cue may hold across a cut, and a cut may land inside a cue.
 *
 * The two tracks are two registers and never say the same words. The display type is the
 * CLAIM; the rail is the READ. A rail that echoed the type would be the same sentence twice at
 * two sizes, which is the failure mode of every kinetic video with captions bolted on.
 *
 * =====================================================================================
 * THE THIRD CUT, and what a two pass review of the second one found
 * =====================================================================================
 *
 * The first cut ran 14.1 seconds and Cameron gave it three notes: too long, not enough
 * gameplay, does not show the app. The second cut answered all three and ran 9.8 seconds. It
 * was then read frame by frame and measured sample by sample by two independent passes, and
 * this cut is what those found. Every change below is a defect that was measured, not a taste
 * revision.
 *
 * WHAT THE SECOND CUT ALREADY GOT RIGHT, and this cut does not touch:
 *
 *   the length     9.8 seconds against 14.1, every beat derived from the measured read.
 *   the gameplay   two full bleed live beats in colour and in focus, 40% of the body.
 *   frame one      the whole hook, at full size, already in flight. The report that said
 *                  frame 0 read "THIS IS NOT A DATING" was measured on a file rendered four
 *                  minutes BEFORE the fix landed in this file; the render that followed it
 *                  carries all four lines at frame 0. Nothing was wrong and nothing changed.
 *   the two tracks the claim in display type, the read on the rail, never the same words.
 *
 * WHAT THIS CUT CHANGES, in the order the damage was worth:
 *
 * 1. THE PAYOFF WAS A BEACH SELFIE. Beat 5 held a circular photograph in a lime ring above a
 *    "Send a message" button, and the photograph was a shirtless man in sunglasses at the
 *    beach. Every visual convention on that frame belonged to the category the first two
 *    seconds spend denying. The screen is the product and is not negotiable; what is in the
 *    circle is. `match-kofi` is the same screen at a different moment of the same session with
 *    a different person in it: a man in a black t-shirt next to a suit of samurai armour.
 *
 * 2. NO CHAT, AND NO PLAY. Cameron named four things and the second cut showed two. Beat 6 is
 *    new and it is the chat: a first message being sent, reading "when are you gonna be on
 *    tn". It costs about a second, it is the only thing in this cut that got longer, and it is
 *    what turns the frame before it from a match screen into two people arranging to play.
 *
 * 3. THE SLABS CUT THEIR OWN LETTERS. Both accent slabs and both rail highlighters were inset
 *    from the LINE BOX, and at these leadings the baseline is not the bottom of the line box.
 *    DUO, the film's last and largest word, lost the bottom tenth of every letter and read as
 *    a red bar with three holes in it; the rail read "wronq" for the whole opening beat. Every
 *    such field is now placed from the baseline off measured face metrics. See FACE in ./skin.
 *
 * 4. THE APP BEATS STOPPED DEAD. A portrait screen recording has no horizontal headroom, so
 *    both app plates parked their camera twelve frames in and stood still for the rest of the
 *    beat. Measured, that left 0.57s of decay into a frozen frame with four identical frames
 *    inside it, and then a hard cut with nothing moving on either side. The app treatment now
 *    pushes for the whole beat instead, which needs no headroom at all. See `camera` in
 *    ./Plate.
 *
 * 5. THE GAMEPLAY WAS DARK AND THE HUD WAS CUT IN HALF. The opening beat was a dark interior
 *    at a mean luma of 49; at thumbnail size it was a brown black rectangle. Beat 1 is now the
 *    sunlit map and beat 3 is the firefight, which is also the better pairing: a fight belongs
 *    under the word ENERGY, and an empty map does not. Both live beats gained a vertical lift
 *    that takes the game's own event banners off the top edge, where they used to arrive cut in
 *    half in a red within a few degrees of the brand accent.
 *
 * 6. THE END CARD FINISHED BEFORE IT ENDED. 20 of its 36 frames were pixel for pixel
 *    identical. It is 30 frames now and its four events reach the end of it.
 *
 * 7. THE MIX PLAYED 42.67ms LATE. Not a picture note: Remotion's AAC encode delays every mix
 *    by 2048 samples and its edit list takes only 512 of them back. The master is now trimmed
 *    by exactly that at the head, so the committed clock below describes the delivered video
 *    rather than a file 1.28 frames ahead of it. See ENCODER_PRIMING_SAMPLES in src/audio/mix.
 *
 * COPY RULES, which the direction does not relax. Platonic only: this is an 18+ gaming app and
 * nothing may imply dating. The banned words are sayable only inside a denial, which is why
 * beat 1 exists at all, because "no, this is not a dating app" is the strongest opening the
 * spec has. No em dash anywhere a viewer can read. Stored lowercase in the house voice and
 * uppercased at render time, because all caps is a typographic decision rather than a change
 * of voice.
 */
import { FPS } from "@/lib/scale";
import type { ClipName } from "@/types";

export type Treatment =
  /**
   * Gameplay, full bleed, in colour and sharp, with the type on a scrim over it. THE default,
   * and the answer to Cameron's second note. Nothing is greyscaled, blurred or sunk: the
   * audience is gamers and the footage is the only thing in the first second that says so.
   */
  | "live"
  /**
   * The real product, graded almost not at all. The type moves out of its way rather than
   * sitting on top of it, which is what `anchor` below is for. Exactly two per cut.
   */
  | "app"
  /** The frame floods accent and the type goes black. One beat, spent on meaning. */
  | "flood";

/**
 * Where the fitted stack sits in the frame.
 *
 * `center` is the default and the true frame centre, y = 960, per the captions doctrine: the
 * rail is an overlay and the composition under it is never shifted up to make room.
 *
 * `top` and `bottom` are not a shifted centre either. They are the two APP beats getting out
 * of the product's way, in opposite directions, which is a composition decision about a
 * specific screenshot rather than a rule about the frame. The deck's card lives in the lower
 * two thirds of the phone, so that beat's type takes the top; DUO LOCKED's header, photo and
 * confirmation line live in the upper half, so that beat's type takes the bottom. A viewer
 * gets the whole product either way, and the two app beats end up composed as opposites,
 * which is worth having on its own.
 */
export type Anchor = "center" | "top" | "bottom";

export interface Beat {
  /**
   * Beat length in frames at 30fps, and NOT a number anybody chose by eye. It is the distance
   * between two midpoints of measured silence in the finished voiceover. See the table above
   * the beats below for the arithmetic.
   */
  frames: number;
  /** Lines of the statement, each fitted to the frame width independently. */
  lines: string[];
  /**
   * Local frame each LINE's cascade begins. One entry per line. This is the doctrine's STAGED
   * REVEAL route and it is the single thing that stops this film being a slideshow.
   *
   * Left off, every line arrives at once and the whole statement is composed within half a
   * second, and the beat then sits unchanged until its exit. The doctrine's test is to pause
   * at any second and find something meaningful mid flight, and a composed statement over a
   * plate you cannot see moving fails it. So the sentence FINISHES on screen.
   *
   * Where a line has natural sub phrases, the reveals are placed on the voice: beat 3's three
   * lines land within a frame or two of the moment each is spoken, which is what the phrase
   * level clock buys. A negative entry means the line is already partway through its own
   * entrance at local frame 0. Only the opening beat uses that, and it is how frame one
   * carries the hook while still being visibly in motion.
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
  /** Where the block sits. Defaults to the true frame centre. */
  anchor?: Anchor;
  /**
   * Fraction of the safe box width the lines are fitted to. Left off, a statement takes the
   * full width, which is the direction's default and its whole signature. The app beats pull
   * in a little so the block has a margin against the product behind it.
   */
  fitWidth?: number;
  /** Whole block tilt in degrees. One or two, never more. */
  tilt?: number;
  /**
   * Only the opening beat sets this. Documentation rather than behaviour: the head start is
   * the negative `reveal` offsets, next to the copy they apply to. The doctrine's rule is that
   * the first frame carries the hook and that fading up into an empty opening frame is not
   * allowed; the first half second is the only half second there is.
   */
  open?: boolean;
  /**
   * This beat is the film's ARRIVAL and enters on the reserved inverse zoom rather than on the
   * current. Exactly one beat may set it. The beat before it inherits the matching receding
   * exit, and this beat composes its words instead of cascading them in, because a grow from
   * small entrance inside a retracting wrapper flips the scale sign.
   */
  arrival?: boolean;
  /** Local frame the camera parks at. Used to schedule stillness before the climax, and on the
   * app beats to keep a portrait plate's own edge out of the frame. */
  camStop?: number;
  /** Local frame the camera starts at. Used to hold the plate still under an inverse zoom
   * entry, so the plate's own push does not fight the retraction's sign. */
  camStart?: number;
  /**
   * Overrides the treatment's base scale for this beat only, and exactly one beat needs it.
   *
   * An app plate has no horizontal headroom, so its camera is a push (see Plate.tsx), and a
   * push crops the sides of whatever it is pushing into. The deck and the match screen can pay
   * that: their content is a card and a photograph with real margins, and losing 60px of a
   * rounded corner reads as a close-up. The chat cannot. Its message bubble runs to source x
   * 1127 of 1180 and its input field to 1173, so every stop of zoom eats a word, and the one
   * sentence in the film that proves this is not a dating app is the sentence in that bubble.
   */
  camScale?: number;
  /**
   * Anchors this beat's push to the RIGHT edge of the frame instead of its centre, so the
   * screen grows away to the left and whatever is on the right hand side never moves. Same
   * beat, same reason: see Plate.tsx for the arithmetic. It also turns a pure Z move into a
   * leftward drift, which is the film's current, so the beat gains an x vector it can hand to
   * the seam out of it.
   */
  camPinRight?: boolean;
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
   * How that word is marked. `box` is the highlighter, and it is this direction's scarce peak:
   * the captions doctrine's rail and embed model says the promoted word is earned, never two
   * adjacent and never more than one per beat. Two in the whole film, at the denial and at the
   * positioning line, and never anywhere near each other.
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

/**
 * THE CLOCK, and where every frame count below comes from.
 *
 * `pnpm video:audio` synthesises each beat's line as its own WAV, measures it with ffprobe and
 * commits the result. The read is 6 frames of lead in, then each phrase, then 8 frames of
 * breath between phrases. For this script that measured out as:
 *
 *   line                                 said            frames
 *   this is not a dating app             0.200 - 1.672     6 -  50
 *   it is a duo finder                   1.939 - 3.304    58 -  99
 *   same game same hours same energy     3.571 - 5.640   107 - 169
 *   not faces                            5.907 - 6.952   177 - 209
 *   find your duo                        7.219 - 8.243   217 - 247
 *   then go play                         8.509 - 9.555   255 - 287
 *
 * A cut lands at the MIDPOINT of the silence between two phrases, which puts the incoming
 * words on screen a few frames before the voice reaches them. The picture leads the voice by
 * about a sixth of a second, which is the right way round: a viewer reads faster than a
 * narrator speaks, and a word that arrives after it is said reads as a lag.
 *
 *   0    54       103          173      213      251        298
 *   |  1  |   2    |     3      |   4    |   5    |    6     |
 *
 * THOSE FIGURES ARE FILE POSITIONS, NOT ONSETS, and the difference is worth naming because it
 * is what the lead actually is. Each phrase's WAV carries its own head and tail of near
 * silence, so the number above is where the phrase's FILE starts, and the first sample a
 * listener hears is about 0.06s later. Measured off the assembled stem's own RMS envelope at
 * 20ms, which is the same file the mix is built from:
 *
 *   phrase                              audible          its beat        picture leads by
 *   this is not a dating app            0.260 - 1.607    0.000 - 1.800       0.260s
 *   it is a duo finder                  1.993 - 3.195    1.800 - 3.433       0.193s
 *   same game same hours same energy    3.600 - 5.490    3.433 - 5.767       0.167s
 *   not faces                           5.948 - 6.814    5.767 - 7.100       0.181s
 *   find your duo                       7.260 - 8.080    7.100 - 8.367       0.160s
 *   then go play                        8.540 - 9.380    8.367 - 9.933       0.173s
 *
 * Every phrase is fully contained by its own beat, and the lead is the same 0.17s everywhere
 * except the opening, which is longer on purpose because frame 0 has no cut in front of it.
 * That table is the check to re-run after ANY retime: the doctrine's rule is that a seam is
 * re-opened by an edit to either side of it, and re-timing to a new read re-opens all of them.
 *
 * Body is 298 frames, 9.93s. The last beat's exit begins at frame 287, which is the frame the
 * last word of the read finishes on, so the film starts leaving exactly when it stops talking.
 *
 * And the read now lands where this table says it does IN THE MP4 rather than 1.28 frames
 * later. The AAC encode Remotion muxes the mix into delays it by 2048 samples that its edit
 * list does not take back, so the master is trimmed by exactly that at the head before it is
 * ever handed over. Every number above is a position in the file people watch.
 */
export const KINETIC_NATIVE: KineticNativeScript = {
  id: "kinetic-native-001",
  caption: "no, not that kind of swiping. it is a duo finder.",

  // 54 + 49 + 70 + 40 + 38 + 47 = 298 frames of body, 9.93s.
  beats: [
    // ---------------------------------------------------------------------------------
    // Beat 1. THE DENIAL, over a sunlit map.
    //
    // Everyone assumes wrong and the correction is the hook, so it is the first thing said and
    // the first thing on screen. Four short lines rather than two long ones is what lets it
    // fill the frame instead of sitting in a caption bar.
    //
    // The footage is the other half of the hook and it is why this beat is `live`. A viewer
    // deciding in the first quarter second whether this is for them is looking at a picture,
    // not reading a sentence.
    //
    // broll-quiet rather than broll-teamfight, and the swap is a legibility decision. The
    // firefight is a dark interior looking at a crate and a wall: it measures a mean luma of
    // 49 out of 255, and at 150px, which is the size a thumb sees, it is a brown black
    // rectangle that says nothing about anything. This is Breeze in daylight, sandstone and
    // sea and palms with a weapon across the bottom of the frame, and it reads as a video game
    // at any size. It also has no faces and no straight edges in it, which matters under a
    // sentence denying that this is about faces. The firefight is not thrown away: it moves to
    // beat 3, where the copy is about energy and a fight is what that word means.
    // ---------------------------------------------------------------------------------
    {
      frames: 54,
      lines: ["this is", "not a", "dating", "app"],
      accent: ["not"],
      // The stamp. NOT is already the accent at frame 0, so the hook is red in frame one; at
      // local frame 24 a filled slab wipes across it and the word flips to near black. That is
      // the beat's second event and it lands on the word the whole film turns on.
      slab: ["not"],
      slabAt: 24,
      // ALL FOUR lines are already in flight at frame 0, the last of them 2 frames into its
      // own power4.out. The opening frame reads THIS IS NOT A DATING APP, complete, at full
      // size, and is visibly moving while it does. Frame 0 is the poster frame and the scroll
      // stop, and holding APP back to local 12 made it read THIS IS NOT A DATING: a truncated
      // sentence is not a hook, and the one that got truncated was the denial the whole film is
      // built on. At frame 0 APP is 2 frames into a 9 frame power4.out, 48px right of home at
      // 71% opacity, which is unmistakably the word and unmistakably still travelling.
      reveal: [-9, -7, -5, -2],
      clip: "broll-quiet",
      clipFrom: 1.5,
      treatment: "live",
      tilt: -1.2,
      open: true,
    },
    // ---------------------------------------------------------------------------------
    // Beat 2. WHAT IT ACTUALLY IS, over the real deck.
    //
    // The first of the three product beats. The window covers a card, a swipe, and the next
    // card arriving, so the viewer sees the deck WORKING rather than a screenshot of it.
    //
    // The type takes the top of the frame and the card keeps the bottom two thirds. A full
    // width statement across the middle would land squarely on the card's name, its game and
    // its playstyle tag, which are the three things this beat exists to show.
    //
    // The camera no longer parks here. See `camera` in Plate.tsx: an app plate pushes for the
    // whole beat instead of panning for twelve frames and then standing still, because the
    // still half of that was measurably a dead stop and the cut out of it was a slideshow
    // seam.
    // ---------------------------------------------------------------------------------
    {
      frames: 49,
      lines: ["it is a", "duo", "finder"],
      // Accent rather than a slab. The slab is the film's stamp and there are two of them, on
      // the word the denial turns on and on the last word of the payoff; a third here would
      // stop them meaning anything.
      accent: ["duo"],
      // Staged onto the voice: "it is a" lands at 0, "duo" as it is said, "finder" after it.
      reveal: [0, 12, 24],
      clip: "deck-cards",
      clipFrom: 2.4,
      treatment: "app",
      anchor: "top",
      fitWidth: 0.88,
    },
    // ---------------------------------------------------------------------------------
    // Beat 3. THE FILTER, over the firefight.
    //
    // The longest beat in the film and the one that answers Cameron's second note hardest, and
    // it is now the FIGHT rather than the empty map. The three lines land ON the three phrases
    // as they are spoken, and under them a rifle is trained on a doorway, it fires, and an
    // enemy comes through it. The word the beat accents is ENERGY, and a firefight is what
    // that word means; two and a third seconds of walking an abandoned map alone was the
    // correct picture for the copy and the wrong picture for the claim.
    //
    // 6.5s, and the window was chosen by measuring rather than by scrubbing. Sampled at 10Hz
    // through the crop this grade actually shows, the file's mean luma sits between 23 and 56
    // everywhere except 7.1 to 8.7, where it runs 105 to 138: that is where the fight comes out
    // of a dark interior into daylight, and it is the only stretch of the take that looks like
    // something a viewer would want to be doing. 6.5 to 8.83 is the brightest 2.33s in the
    // file at a mean of 102, against 30 for the 3.4 window this beat used first. It opens on
    // half a second of an ability in hand and then the frame opens out, which is a beat that
    // GAINS information rather than one that holds a picture.
    //
    // Two names are on that footage and neither reaches the frame: the player's own along the
    // bottom left, and a spectated teammate's in the same place after 7.1. The crop is the
    // middle 586 of 2560 source columns, so both are hundreds of pixels outside it, and the
    // kill feed on the right is gone with them. The event banner along the top is handled by
    // this grade's lift.
    // ---------------------------------------------------------------------------------
    {
      frames: 70,
      lines: ["same game", "same hours", "same energy"],
      accent: ["energy"],
      // 2, 21, 41, measured rather than guessed. Kokoro reads this phrase with no pause in it
      // at all, so the sub phrase boundaries are not in silencedetect's output at any
      // threshold; they are in the RMS envelope, as two dips to about -26 dBFS inside a read
      // that otherwise sits at -16. Every other line in the film leads its own words by about
      // 0.17s, which is deliberate: a viewer reads faster than a narrator speaks, so a word
      // that arrives on the syllable reads as a lag.
      reveal: [2, 21, 41],
      clip: "broll-teamfight",
      clipFrom: 6.5,
      treatment: "live",
      tilt: 0.8,
    },
    // ---------------------------------------------------------------------------------
    // Beat 4. THE FLOOD, and the stillness before the climax.
    //
    // Two words, and the whole screen changes colour while the words from beat 3 are still
    // streaking off it. It is the one beat that is pure meaning rather than proof, and a flat
    // vermillion field between two photographic beats is what stops the film reading as a
    // slideshow of footage.
    //
    // It is also the dramatic comma, and it is why this beat sits immediately before the
    // payoff rather than earlier in the argument. FACES settles at local 20 and the camera
    // parks at 22, so nothing at all moves from 22 to the receding exit at 34: 12 frames,
    // 0.40s, inside the doctrine's 0.3 to 0.75s window. It is the only motionless stretch in
    // the film and the beat after it is the climax.
    // ---------------------------------------------------------------------------------
    {
      frames: 40,
      lines: ["not", "faces"],
      // "not" and "faces" are measured off the same envelope as beat 3. 11 puts FACES on
      // screen leading its own word by about 0.14s and still settling at 20, two frames before
      // the camera parks at 22, so the comma below is exactly as long as it says it is.
      reveal: [0, 11],
      // The deck under the flood rather than gameplay, because "not faces" is a statement
      // about what is in the deck. At 16% over a flooded field it is texture, not a screen.
      clip: "deck-cards",
      clipFrom: 6.2,
      treatment: "flood",
      camStop: 22,
    },
    // ---------------------------------------------------------------------------------
    // Beat 5. THE PAYOFF, the second product beat, and the film's ARRIVAL.
    //
    // It is the only beat that does not enter on the current: it arrives OVERSIZED on the
    // reserved inverse zoom and retracts into the focal plane, which is the vector the doctrine
    // reserves for something bigger landing. What lands is the product, at the moment it says
    // DUO LOCKED.
    //
    // Its words are composed rather than cascaded, because a grow from small entrance under a
    // retracting wrapper flips the scale sign, and camStart holds the plate still until the
    // retraction has settled for the same reason. Then it keeps performing: the slab wipes in
    // under DUO at local 16, its leading edge crossing the word as the word is said, and the
    // plate pushes on through the cut.
    //
    // match-kofi rather than duo-locked, and this is the most consequential single change in
    // the cut. The two clips are the same screen, pixel for pixel, at two moments of one
    // session: DUO LOCKED, a circular photo in a lime ring, "You and someone both queued up",
    // and a full width Send a message button. The composition is not negotiable, because it is
    // the product. WHAT IS IN THE CIRCLE is. duo-locked's photo is a shirtless beach selfie in
    // sunglasses, and a beach selfie in a ring above a message button is every visual
    // convention of the category this film's first two seconds spend denying. Kofi's is a man
    // in a black t-shirt standing next to a suit of samurai armour, which reads as somebody's
    // hobby rather than as somebody's profile. One word of a clip name buys the difference.
    //
    // The beat after this one is the other half of the answer: a real conversation about when
    // to get online, which is what a locked duo is FOR.
    // ---------------------------------------------------------------------------------
    {
      frames: 38,
      lines: ["find your", "duo"],
      slab: ["duo"],
      // 2.2s in. The new match banner has cleared, the card is composed, and DUO LOCKED, the
      // lime ring, the photo and "You and Kofi both queued up" all sit above the type's scrim
      // and read cleanly. The iOS notification along the top edge is taken out by the app
      // grade's 76px mask, which also keeps the word "matched" off screen.
      clip: "match-kofi",
      clipFrom: 2.2,
      treatment: "app",
      anchor: "bottom",
      fitWidth: 0.88,
      // 10, not 15. The retraction is an expo.out over 15 frames and it is within a
      // thousandth of settled by frame 10, so holding the plate to 15 bought five frames of
      // nothing between the arrival landing and the slab stamping, which the render's own
      // motion energy picked up as a stall. From 10 the plate's push is an order of magnitude
      // faster than what is left of the retraction, so the composite still grows and the scale
      // sign never flips.
      arrival: true,
      camStart: 10,
      // 16, and it is a sync figure rather than a taste one. "duo" is spoken over about 13
      // frames from local 20, so a wipe starting at 16 has its leading edge crossing the word
      // as the word is said, which is what a stamp on a spoken word is supposed to do. It
      // settles at 22 and holds, which is the same weight the denial's slab gets in beat 1.
      slabAt: 16,
    },
    // ---------------------------------------------------------------------------------
    // Beat 6. THE CHAT, and the third of Cameron's four named features.
    //
    // The note was that a viewer gets a strong claim and almost no product, and it named four
    // things: the deck, a match, a chat, playstyle matching. The first two were already here,
    // the fourth is a card's own tag under beat 2 and the rail's line under beat 3, and this
    // beat is the third. It costs about a second, which is the only place in this cut where
    // anything got LONGER, and it earns it: it is the one shot in the film of two people
    // arranging to play a game.
    //
    // It is also the film's answer to the frame before it. Beat 5 is a photograph of a person
    // above a message button, and however platonic the copy around it is, that composition
    // carries a category with it. What follows it here is the message actually being sent, and
    // what it says is "when are you gonna be on tn". Nothing about that is a date.
    //
    // The window catches the send: the text is sitting in the field, it goes, and the bubble
    // arrives and says SENDING. That is the doctrine's sequenced UI life route, and it is the
    // product doing the thing the type says while the type says it.
    // ---------------------------------------------------------------------------------
    {
      frames: 47,
      lines: ["then", "go play"],
      // The last statement in the film, and the one word in it that no dating app would put on
      // a screen. It gets no accent and no slab: the two stamps are spent, and a third would
      // make all three ordinary.
      // Measured off the read's own RMS envelope at 20ms, like beats 3 and 4: "then" opens
      // at 8.540 and "go play" at 8.840, with the plosive of PLAY leaving a clean 0.12s hole
      // at 8.96 that a threshold detector would have called the phrase boundary. The beat
      // starts at 8.367, so 0 and 9 put each line on screen 0.173s before its own words, which
      // is the same lead every other beat in the film runs.
      reveal: [0, 9],
      clip: "chat-typing",
      clipFrom: 5.35,
      treatment: "app",
      anchor: "top",
      fitWidth: 0.88,
      // The one beat that overrides its treatment's camera, and both overrides are the same
      // fact about this screen: a chat is text to both edges. The bubble's right side reaches
      // video x 1031 of 1080 before the camera touches it, so the treatment's own 1.1 base has
      // the message clipped in the opening frame and its SENDING label gone.
      //
      // Parking the camera instead was the first answer and it was wrong. The argument for it
      // was that the product animates through the whole beat, so the plate does not need to;
      // measured, that argument is false. Frame differenced at 30fps the whole clip is
      // essentially a still: the typing moves single letters, the send is one small slide, and
      // from 6.0s onward nothing moves but a five letter status label. The render agreed and
      // showed 16 near frozen frames in the beat's second half.
      //
      // So the plate pushes for every frame of the beat from a base of 1.0, and the push is
      // pinned to the right edge so the bubble cannot be reached by it. The right hand side of
      // the screen holds still, the left drifts out of frame at 1.8px a frame, and what leaves
      // is the empty half of the conversation and the outer keys of the keyboard.
      camScale: 1,
      camPinRight: true,
    },
  ],

  // The rail. Cue lengths are timed against the beats above by hand and sum to the same total.
  //
  // Not one of these lines appears in the display type, which is the rule the two register
  // design stands on. Read on its own the rail is a second, quieter argument: everyone gets
  // this wrong / this is the deck / you match on playstyle / no photos on the cards / 18 plus
  // and platonic / no more solo queue.
  cues: [
    { line: "everyone gets this wrong", frames: 54, accent: "wrong", mark: "box", instant: true },
    // Names the thing on screen while the type makes the claim about it. A caption doing what
    // a caption is for.
    { line: "this is the deck", frames: 49, accent: "deck" },
    { line: "you match on playstyle", frames: 70, accent: "playstyle" },
    // The one cue with no accent, and it is the flood's fault rather than the line's: the
    // accent ink IS the flooded field, so an accented word there is vermillion on vermillion
    // held apart by its own black keyline, which reads as an outlined word rather than as an
    // emphasis. The beat is already doing the emphasis in near-black type a foot high.
    //
    // "cards" rather than "deck", which the cue two lines up already spent, and it is also the
    // more precise claim: the deck is the screen, the cards are the things with no photographs
    // on them.
    { line: "no photos on the cards", frames: 40 },
    // The positioning line, said plainly once, over the only shot of a locked duo. It is the
    // single most load bearing sentence in the account, which is why it gets the film's second
    // and last highlighter, and why it is on THIS frame: a photograph of a person is the one
    // frame in the film that has to be unambiguous about what this app is.
    { line: "18 plus and platonic", frames: 38, accent: "platonic", mark: "box" },
    // The last thing read, and the only line in either register that names the feeling rather
    // than the product. It is the pain the whole thing exists to answer.
    { line: "no more solo queue", frames: 47, accent: "solo" },
  ],
};

/** Body length in frames, derived rather than typed, so a retimed beat moves the composition
 * with it and the end card cannot end up overlapping the last statement. */
export const bodyFrames = (script: KineticNativeScript): number =>
  script.beats.reduce((total, beat) => total + beat.frames, 0);

/**
 * 1.0 second of end card, down from 1.2, and down from 1.7 before that.
 *
 * The card is a call to action, not a scene, and in a film this short every frame it holds is
 * a frame the film is over. 36 frames was six too many, measured rather than felt: the render
 * showed 20 of them frozen in three blocks, the longest 8 frames, because the card's four
 * events did not reach the end of it. 30 frames is the seam entry (0 to 10), the slab wipe
 * (12 to 22), the URL arriving under it (20 to 26) and a fifth of a second of hold on the
 * finished lockup, which is the shortest the last thing a viewer reads can be held for and
 * still be read. See EndCard.tsx, where the four numbers live.
 *
 * It lives here rather than in EndCard.tsx because the audio path has to lay a bed under the
 * whole composition and asks a node script for its length. Importing that component would pull
 * `@/lib/fonts` in behind it, which opens a `delayRender` handle at module scope, and outside
 * Chromium there is no render to hold back. This file imports nothing but the frame rate.
 */
export const END_FRAMES = Math.round(1 * FPS);

/** The whole composition: every beat, then the card. 294 frames, 9.80s. */
export const kineticNativeDuration = (script: KineticNativeScript): number =>
  bodyFrames(script) + END_FRAMES;
