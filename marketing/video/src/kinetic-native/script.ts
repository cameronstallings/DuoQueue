/**
 * The cut, as data. Two tracks over one clock, and the clock is the voice.
 *
 * TRACK 1, the beats: a HERO line and its support over footage. Each beat names one line as
 * the hero in `hero`, and that line is the only thing in the beat set at display scale; every
 * other line is roughly a third of it, in a lighter face, tracked open. Which line is the hero
 * IS the authoring surface, and it is the thing the previous cut did not have.
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
 * THE FOURTH CUT, and the three notes that produced it
 * =====================================================================================
 *
 * The third cut ran 10.93s, six beats, and was correct in every measurable way: derived
 * timings, no drift, gameplay at 38% of the body, four app beats, the hook in frame one. Three
 * notes came back on it and none of them was about correctness.
 *
 *   1. IT TALKS TOO FAST AND FEELS RUSHED
 *   2. THE WORDS ARE TOO BIG, IT FEELS CHEAP
 *   3. IT SHOULD BE MORE POLISHED AND SMOOTH
 *
 * WHAT NOTE 2 ACTUALLY WAS, because it is not what it sounds like. The old type system fitted
 * EVERY line of a beat to the full frame width independently, and the file that did it said in
 * its own header that this was "the entire visual signature of this direction". It has two
 * consequences and both of them are the note.
 *
 * Every line is at its maximum, so there are no side margins anywhere in the film and nothing
 * is subordinate to anything. And because a fitted size is inversely proportional to the
 * length of the string, size was being handed out by SPELLING: the opening beat read
 * "THIS IS / NOT A / DATING / APP" with APP, a three letter function word, at about 500px and
 * THIS IS at about 215px. The largest thing on the film's most important frame was its least
 * meaningful word. That is not "big type", it is type with no hierarchy, and type with no
 * hierarchy is what reads as cheap at any size.
 *
 * So the fix is not uniform shrinkage. It is that size now means something: one hero per beat,
 * fitted to a fraction of the safe box so there is real air at both edges, and everything else
 * at about a third of it in Manrope Medium tracked open. See ./type-fit.
 *
 * WHAT NOTE 1 ACTUALLY WAS. "Shorter" and "slower" only conflict while the word count is
 * fixed. This script says 20 words where the last one said 25, the read rate is down to 0.9,
 * and the silence between statements is up from 0.27s to 0.60s. Nothing is padded: the film
 * is longer than the last one because it stops talking for longer, not because it says more.
 *
 * WHAT NOTE 3 ACTUALLY WAS. Every duration in ./motion is about a quarter longer, the accent
 * slab takes a third longer to cross its word, and the dramatic comma before the payoff is
 * 0.62s instead of 0.40s. What it is NOT is idle motion: the doctrine bans a float or a
 * breathe on a settled block outright, because it reads as the video waiting rather than as
 * the video moving. Smoothness here is duration and stillness, never drift.
 *
 * WHAT DID NOT CHANGE, because it was right: the derived clock, the audio chain, the seam
 * plan, the two live gameplay beats, all four app beats (the deck, the flood over the deck,
 * DUO LOCKED and the chat), and the hook in frame one.
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
   * and the answer to Cameron's second note on the FIRST cut. Nothing is greyscaled, blurred
   * or sunk: the audience is gamers and the footage is the only thing in the first second that
   * says so.
   */
  | "live"
  /**
   * The real product, graded almost not at all. The type moves out of its way rather than
   * sitting on top of it, which is what `anchor` below is for.
   */
  | "app"
  /** The frame floods accent and the type goes black. One beat, spent on meaning. */
  | "flood";

/**
 * Where the block sits in the frame.
 *
 * `center` is the default and the true frame centre, y = 960, per the captions doctrine: the
 * rail is an overlay and the composition under it is never shifted up to make room.
 *
 * `top` and `bottom` are not a shifted centre either. They are the APP beats getting out of
 * the product's way, which is a composition decision about a specific screenshot rather than a
 * rule about the frame. The deck's card lives in the lower two thirds of the phone, so those
 * beats take the top; DUO LOCKED's header, photo and confirmation line live in the upper half,
 * so that beat takes the bottom. A viewer gets the whole product either way.
 */
export type Anchor = "center" | "top" | "bottom";

export interface Beat {
  /**
   * Beat length in frames at 30fps, and NOT a number anybody chose by eye. Every boundary is
   * its phrase's own measured file position minus a fixed 6 frame lead, so the picture is
   * always the same distance ahead of the voice and the error cannot accumulate. See the table
   * above the beats below for the arithmetic, and `pnpm validate` for the assertion.
   */
  frames: number;
  /** Lines of the statement, in reading order. */
  lines: string[];
  /**
   * Index of the ONE line that carries this beat, set at display scale. Every other line is
   * support: about a third of the size, Manrope Medium, tracked open.
   *
   * This is the single most consequential field in the file and it is the fix for the note
   * that the type felt cheap. Before it existed, size was decided by how many letters a word
   * has, which put the film's least meaningful word at its largest size on its most important
   * frame. A hero is chosen, not measured.
   *
   * Choosing one is a copy decision as much as a design one, and it constrains the copy: a
   * fitted size is inversely proportional to string length, so a hero of three or four
   * characters lands around 300 to 360px and a hero of ten lands around 110px, which is not a
   * hero at all. Every beat below was rewritten until its hero was one short word.
   */
  hero: number;
  /**
   * Kokoro's rate for THIS beat's phrase, overriding the film's `KINETIC_SPEED`.
   *
   * Set on exactly one beat, and the measurement is the whole argument for it. At a uniform
   * 0.9 the six phrases were read at 242 / 133 / 174 / 126 / 183 / 193 words per minute: five
   * of them at or under broadcast pace and the opening 25% clear of the next fastest. Rate is
   * not what varied, LENGTH is. Kokoro reads a six word sentence close to conversationally and
   * a two word fragment deliberately, so the one whole sentence in the script came out as the
   * one rushed phrase, and it is also the first thing anybody hears.
   *
   * Dropping the film's rate far enough to fix it would have dragged the five phrases that
   * were already right, which is how a fix for "too fast" turns into a note about "too slow".
   * So the correction is local, and the number was measured rather than guessed: synthesised
   * at 0.86, 0.82 and 0.78, the spans came back 1.507 / 1.646 / 1.816s, which is 239 / 219 /
   * 198 wpm and 4.65 / 4.25 / 3.85 syllables per second. The film's mean is 3.92 syll/s, so
   * 0.78 does not merely reduce the outlier, it lands the opening on the film's own average.
   */
  speed?: number;
  /**
   * Local frame each LINE's cascade begins. One entry per line. This is the doctrine's STAGED
   * REVEAL route and it is the single thing that stops this film being a slideshow.
   *
   * Left off, every line arrives at once and the whole statement is composed within half a
   * second, and the beat then sits unchanged until its exit. The doctrine's test is to pause
   * at any second and find something meaningful mid flight, and a composed statement over a
   * plate you cannot see moving fails it. So the sentence FINISHES on screen.
   *
   * Where a line has natural sub phrases, the reveals are placed on the voice: each line lands
   * a few frames before the words it carries are spoken, which is what the phrase level clock
   * buys. A negative entry means the line is already partway through its own entrance at local
   * frame 0. Only the opening beat uses that, and it is how frame one carries the hook while
   * still being visibly in motion.
   *
   * This is a staged reveal and NOT a stagger, which is why it may span more than the
   * doctrine's 500ms stagger ceiling: each line is its own group, each group's internal
   * cascade is about 0.2s, and no single entry runs longer than 0.38s.
   */
  reveal?: number[];
  /**
   * Words rendered in the accent, matched case insensitively.
   *
   * Far scarcer than it used to be, and deliberately. Under the old system every beat needed
   * an accent because nothing else marked which word mattered; now SIZE marks it, and an
   * accent on a word that is already three times the size of everything around it is a second
   * emphasis on something that is not ambiguous. What is left is the two words that carry a
   * slab, which need the hot ink before the slab arrives under them.
   */
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
   * How that word is marked. `box` is the highlighter, and it is this direction's scarce peak.
   *
   * ONE in the whole film now, down from two. The note was that the boxed words and the flood
   * were loud and that fewer, larger gestures beat many small ones; a highlighter that appears
   * twice in eleven seconds is a device, and one that appears once is a peak.
   *
   * WHICH beat gets it is decided by what else is red on that frame rather than by which line
   * deserves it most. The display register carries two accent slabs, on NOT and on DUO, and the
   * rail rides 50px under the block: a boxed word on either of those beats stacks with the slab
   * into one two tier red mass. So it goes on beat 3, the one beat whose display type carries
   * no accent at all, where it is the only mark on the frame.
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
 * `pnpm video:audio` synthesises each beat's line as its own WAV at this film's own read rate,
 * measures it with ffprobe and commits the result to src/audio/timings.generated.ts. The read
 * is 6 frames of lead in, then each phrase, then 18 frames of breath between phrases.
 *
 * TWO NUMBERS CHANGED IN THAT SENTENCE AND THEY ARE THE ANSWER TO "IT FEELS RUSHED". The rate
 * is 0.9 rather than 1, and the breath is 18 frames (0.60s) rather than 8 (0.27s). Both live on
 * this film's VoPlan (see ./vo.ts) rather than on the pipeline, so no other post moved: every
 * one of them hit its phrase cache on the rebuild. The third and largest lever is not in this
 * table at all, which is that the script says 20 words where the last one said 25.
 *
 * A THIRD NUMBER CHANGED AFTER MEASURING THE RESULT, and it is the reason `Beat.speed` exists.
 * At a uniform 0.9 the six phrases came back at 242 / 133 / 174 / 126 / 183 / 193 wpm. The film
 * as a whole was no longer rushed, but the OPENING still was, by a wide margin, and it is the
 * first thing anybody hears. So beat 1 alone now reads at 0.78 and lands at 197 wpm, which is
 * the same pace as beat 6 rather than 25% clear of it. See `Beat.speed` for the bench numbers.
 *
 * WHAT IS STILL 0.60 ON PAPER AND 0.74 IN THE EAR. `gapFrames` gaps the FILES, and every Kokoro
 * WAV carries roughly 0.03-0.05s of near silence at its head and 0.07-0.15s at its tail. So the
 * silence a listener actually hears between two statements is the tail, plus the 18 frames, plus
 * the head: measured off the stem it is 0.689 / 0.767 / 0.737 / 0.769 / 0.719s, a mean of 0.736.
 * That is 23% more breath than the parameter says, and it is left alone deliberately, because
 * this is the breath that was reviewed and found to work. The number is written down here so the
 * next person to touch it knows the parameter is not the quantity.
 *
 * WHERE THE CUTS LAND, and the rule changed with the gaps. The old cut put every boundary at
 * the MIDPOINT of the silence between two phrases, which at an 8 frame gap was 4 frames of lead
 * and worked out at 0.16 to 0.27s of picture ahead of voice. At an 18 frame gap the midpoint
 * would be 9 frames and the lead would have doubled to about 0.36s for no reason anybody chose.
 * So the rule is now a FIXED LEAD of 6 frames: a beat begins 6 frames before its phrase's file
 * does. That is the same rule stated in terms of the thing it was always for, and it holds the
 * measured lead where Cameron already approved it whatever the gap becomes.
 *
 *   beat  line                       its beat         phrase file       audible    leads by
 *      1  this is not a dating app   0.000 -  2.533   0.200 -  2.120    0.248      0.248s
 *      2  duo finder                 2.533 -  4.200   2.720 -  3.808    2.763      0.230s
 *      3  same game same hours       4.200 -  6.333   4.408 -  5.923    4.448      0.248s
 *      4  no faces                   6.333 -  8.067   6.523 -  7.653    6.565      0.232s
 *      5  find your duo              8.067 -  9.800   8.253 -  9.384    8.286      0.220s
 *      6  then go play               9.800 - 11.533   9.984 - 11.051   10.011      0.211s
 *
 * The file positions are what ffprobe measured; the audible column is where the first sample a
 * listener hears actually is, read off the stem's RMS envelope at 20ms, because every WAV
 * carries about 0.04s of near silence at its head. The lead is flat at 0.211 to 0.248s, a
 * spread of 1.1 frames, and it does not accumulate: it trends very slightly DOWN across the
 * film, which is the opposite of drift, because every boundary is computed from its OWN phrase
 * rather than from the one before it.
 *
 *   0     76        50      64       52      52       52       346
 *   |  1   |   2    |   3   |   4    |   5   |   6    |
 *
 * Every phrase is fully contained by its own beat, with 6 frames of head and at least 12 of
 * tail everywhere. That is the check to re-run after ANY retime: the doctrine's rule is that a
 * seam is re-opened by an edit to either side of it, and re-timing to a new read re-opens all
 * of them. `pnpm validate` now asserts it rather than asking anybody to remember, see
 * checkKineticNative in scripts/validate-content.ts.
 *
 * Body is 346 frames, 11.53s, and the whole film is 376, 12.53s. The last beat's block begins
 * its exit at frame 332, which is the frame the read's file ends on, so the film starts leaving
 * exactly when it stops talking.
 *
 * ONE CONSTRAINT ON GROWING A `live` BEAT, and it is a camera fact rather than a taste one. A
 * live plate pans at 4.4px a frame around its own centre and starts its beat 0.0017 scale per
 * frame below its base, and the crop has to stay above 1.371 for the game's own HUD banners to
 * miss the frame at both edges (see `lift` in Plate.tsx). That holds up to 75 frames. The two
 * live beats below are 66 and 63, so both are inside it; a beat that grew past 75 would need a
 * camStop rather than a shrug.
 *
 * And the read lands where this table says it does IN THE MP4 rather than 1.28 frames later.
 * The AAC encode Remotion muxes the mix into delays it by 2048 samples that its edit list does
 * not take back, so the master is trimmed by exactly that at the head before it is ever handed
 * over. Every number above is a position in the file people watch.
 */
export const KINETIC_NATIVE: KineticNativeScript = {
  id: "kinetic-native-001",
  caption: "no, not that kind of swiping. it is a duo finder.",

  // 76 + 50 + 64 + 52 + 52 + 52 = 346 frames of body, 11.53s.
  beats: [
    // ---------------------------------------------------------------------------------
    // Beat 1. THE DENIAL, over a sunlit map. THE HERO IS "NOT".
    //
    // Everyone assumes wrong and the correction is the hook, so it is the first thing said and
    // the first thing on screen.
    //
    // The hero is the word the whole film turns on, and under the old system it was not even
    // the biggest thing in its own beat: APP was, at more than twice the size, because APP is
    // short. Now the frame is a huge NOT with THIS IS above it and A DATING APP below it, both
    // quiet. That ordering matters beyond hierarchy for hire: this is a platonic app, and
    // "A DATING APP" set at 500px as the largest words in frame one was a real risk that the
    // old composition took for no reason at all.
    //
    // A DATING APP is the one line in the film that reaches the support measure ceiling: at
    // twelve characters it comes out at 98px rather than the 102px the ratio alone would give
    // it, so it is the one line in the cut whose size is set by its own width. It is also the
    // widest and quietest line in the film and it sits right across the block, which is what
    // makes the lockup read as composed rather than as stacked.
    //
    // The footage is the other half of the hook and it is why this beat is `live`. A viewer
    // deciding in the first quarter second whether this is for them is looking at a picture,
    // not reading a sentence. broll-quiet is Breeze in daylight, sandstone and sea and palms
    // with a weapon across the bottom of the frame: it reads as a video game at any size,
    // where the firefight measures a mean luma of 49 and reads as a brown rectangle at
    // thumbnail. It also has no faces and no straight edges in it, which matters under a
    // sentence denying that this is about faces.
    // ---------------------------------------------------------------------------------
    {
      frames: 76,
      lines: ["this is", "not", "a dating app"],
      hero: 1,
      // The film's one rate override. See `Beat.speed`: this is the only whole sentence in the
      // script and at the film's 0.9 it was the only phrase that came back rushed.
      speed: 0.78,
      accent: ["not"],
      // The stamp. NOT is already the accent at frame 0, so the hook is red in frame one; at
      // local frame 24 a filled slab wipes across it over 8 frames and the word flips to near
      // black. NOT is spoken from local 15.6, so the stamp lands about a third of a second
      // after the word, as punctuation on it rather than as a caption of it. It is the beat's
      // second event and it sits in the middle of the 40 frames between the sentence settling
      // and its exit beginning, which is what that stretch is for.
      slab: ["not"],
      slabAt: 24,
      // ALL THREE lines are already in flight at frame 0, the last of them 4 frames into its
      // own 11 frame power4.out: 83% of the way home at 94% opacity, which is unmistakably the
      // word and unmistakably still travelling. The opening frame reads THIS IS NOT A DATING
      // APP, complete, at full size, and is visibly moving while it does. Frame 0 is the poster
      // frame and the scroll stop; holding any part of the sentence back truncates the hook,
      // and a truncated hook is not a hook.
      reveal: [-11, -8, -4],
      clip: "broll-quiet",
      clipFrom: 1.5,
      treatment: "live",
      tilt: -1.2,
      open: true,
    },
    // ---------------------------------------------------------------------------------
    // Beat 2. WHAT IT ACTUALLY IS, over the real deck. THE HERO IS "DUO".
    //
    // The first of the three product beats. The window covers a card, a swipe, and the next
    // card arriving, so the viewer sees the deck WORKING rather than a screenshot of it.
    //
    // "duo finder" and not "it is a duo finder", which is three words cut and a materially
    // better frame. Three lines in the top band shrink to fit and DUO lands at about 251px;
    // two lines do not shrink at all and it lands at about 338px. The sentence a viewer reads
    // is DUO / FINDER either way, and the film has already said "this is not" out loud, so the
    // correction does not need a subject and a verb to be understood.
    //
    // The type takes the top of the frame and the card keeps the bottom two thirds. A full
    // width statement across the middle would land squarely on the card's name, its game and
    // its playstyle tag, which are the three things this beat exists to show.
    //
    // No accent. DUO is already three times the size of the only other word on the frame, and
    // a hot ink on top of that is an emphasis on something that was never ambiguous.
    // ---------------------------------------------------------------------------------
    {
      frames: 50,
      lines: ["duo", "finder"],
      hero: 0,
      // DUO at 0 and FINDER on its own word. Measured: the phrase's own envelope puts DUO at
      // 0.04s and FINDER at 0.46s into the file, which is local 7.2 and local 19.8, so 13 gives
      // the second line exactly the lead the first one gets.
      reveal: [0, 13],
      clip: "deck-cards",
      clipFrom: 2.4,
      treatment: "app",
      anchor: "top",
    },
    // ---------------------------------------------------------------------------------
    // Beat 3. THE FILTER, over the firefight. THE HERO IS "HOURS".
    //
    // The longest beat in the film, and the copy is down from six words to four. "same game
    // same hours same energy" was a list with no shape: three parallel lines, all the same
    // size, and the accent on the vaguest of the three. What is here now is two quiet lines
    // stepping down into one large one, which is the same rhythm the ear already hears.
    //
    // HOURS rather than ENERGY, and it is the sharper claim of the two. Energy is a vibe;
    // hours is the actual problem, which is that the people you like are never online when you
    // are. It also sets up the back half of the film, where a locked duo is shown asking when
    // somebody is going to be on tonight.
    //
    // SAME on its own line is not a widow. The register gap only appears where the register
    // CHANGES, so SAME GAME and SAME sit tight together as one quiet block and the air is all
    // between them and HOURS. Two things on the frame, not three.
    //
    // 6.5s into the clip, and the window was chosen by measuring rather than by scrubbing.
    // Sampled at 10Hz through the crop this grade actually shows, the file's mean luma sits
    // between 23 and 56 everywhere except 7.1 to 8.7, where it runs 105 to 138: that is where
    // the fight comes out of a dark interior into daylight, and it is the only stretch of the
    // take that looks like something a viewer would want to be doing.
    //
    // 63 frames, inside the 75 frame limit a live plate's camera imposes (see the header), so
    // this beat needs no camStop and its plate travels for every frame of it.
    //
    // Two names are on that footage and neither reaches the frame: the player's own along the
    // bottom left, and a spectated teammate's in the same place after 7.1. The crop is the
    // middle 586 of 2560 source columns, so both are hundreds of pixels outside it.
    // ---------------------------------------------------------------------------------
    {
      frames: 64,
      lines: ["same game", "same", "hours"],
      hero: 2,
      // Measured off the read's own RMS envelope at 20ms rather than guessed. The four words
      // are cleanly separated in it, at 0.04, 0.38, 0.66 and 0.88 into the file, which is local
      // 6.8, 17.0, 25.4 and 32.0. The two quiet lines carry the first three words and the hero
      // carries the last, so the reveals are 0, 19 and 25: the same 6.8 frame lead on each.
      reveal: [0, 19, 25],
      clip: "broll-teamfight",
      clipFrom: 6.5,
      treatment: "live",
      tilt: 0.8,
    },
    // ---------------------------------------------------------------------------------
    // Beat 4. THE FLOOD, and the stillness before the climax. THE HERO IS "NO".
    //
    // Two words, and the whole screen changes colour while the words from beat 3 are still
    // streaking off it. It is the one beat that is pure meaning rather than proof, and a flat
    // vermillion field between two photographic beats is what stops the film reading as a
    // slideshow of footage.
    //
    // "no faces" rather than "not faces", and it avoids saying NOT at full size twice in one
    // film. It is also the beat that set the hero cap: two wide letters fit to this measure
    // come out at 449px against beat 1's 319px for three, a 41% jump decided by one letter and
    // by nothing else. BOX.cap catches it at 340, so NO and NOT are within 7% of each other and
    // the film's two denials read as a pair rather than as an escalation nobody chose.
    //
    // It is also the dramatic comma, and it is why this beat sits immediately before the
    // payoff rather than earlier in the argument. FACES settles at local 22 and the camera
    // parks at 25, so the block and the plate both hold from 25 to the receding exit at 44:
    // 19 frames, 0.633s, at the top of the doctrine's 0.3 to 0.75s window and half again what
    // the last cut held. It is the only held stretch in the film, and the beat after it is the
    // climax.
    // ---------------------------------------------------------------------------------
    {
      frames: 52,
      lines: ["no", "faces"],
      hero: 0,
      // NO at 0 and FACES on its own word. Measured: 0.04s and 0.42s into the file, which is
      // local 7.3 and local 18.7, so 11 gives the second line the same lead as the first.
      // FACES settles at 22, three frames before the camera parks, so the comma below is
      // exactly as long as it says it is.
      reveal: [0, 11],
      // The deck under the flood rather than gameplay, because this is a statement about what
      // is in the deck. At 16% over a flooded field it is texture, not a screen.
      clip: "deck-cards",
      clipFrom: 6.2,
      treatment: "flood",
      camStop: 25,
    },
    // ---------------------------------------------------------------------------------
    // Beat 5. THE PAYOFF, the second product beat, and the film's ARRIVAL. THE HERO IS "DUO".
    //
    // It is the only beat that does not enter on the current: it arrives OVERSIZED on the
    // reserved inverse zoom and retracts into the focal plane over 0.62s, which is the vector
    // the doctrine reserves for something bigger landing. What lands is the product, at the
    // moment it says DUO LOCKED.
    //
    // Its words are composed rather than cascaded, because a grow from small entrance under a
    // retracting wrapper flips the scale sign, and camStart holds the plate still until the
    // retraction has settled for the same reason. Then it keeps performing: the slab wipes in
    // under DUO at local 22, its leading edge crossing the word as the word is said, and the
    // plate pushes on through the cut.
    //
    // This is the one beat in the film whose height budget binds. The band between the app's
    // own Send a message button and the caption rail is 320px and the block wants 400px, so the
    // whole block is scaled by 0.80 and DUO comes out at 243px rather than 304px. The ratio
    // survives it, because the shrink is one factor applied to every size and every gap. That
    // trade has always been the right one here: the whole product reads, and this is the frame
    // where a viewer sees what the app actually does.
    //
    // match-kofi rather than duo-locked. The two clips are the same screen, pixel for pixel, at
    // two moments of one session; duo-locked's photo is a shirtless beach selfie in sunglasses,
    // which is every visual convention of the category this film's first two seconds spend
    // denying. Kofi's is a man in a black t-shirt standing next to a suit of samurai armour,
    // which reads as somebody's hobby rather than as somebody's profile.
    // ---------------------------------------------------------------------------------
    {
      frames: 52,
      lines: ["find your", "duo"],
      hero: 1,
      accent: ["duo"],
      slab: ["duo"],
      // 2.2s in. The new match banner has cleared, the card is composed, and DUO LOCKED, the
      // lime ring, the photo and "You and Kofi both queued up" all sit above the type's scrim
      // and read cleanly. The iOS notification along the top edge is taken out by the app
      // grade's 76px mask, which also keeps the word "matched" off screen.
      clip: "match-kofi",
      clipFrom: 2.2,
      treatment: "app",
      anchor: "bottom",
      arrival: true,
      // 13, not 19. The retraction is an expo.out over 19 frames and it is within a thousandth
      // of settled by 13, so holding the plate the full length would buy six frames of nothing
      // between the arrival landing and the slab stamping. From 13 the plate's push is an order
      // of magnitude faster than what is left of the retraction, so the composite still grows
      // and the scale sign never flips.
      camStart: 13,
      // 20, and it is a sync figure rather than a taste one. Measured off this phrase's own
      // envelope, "duo" runs from 0.52 to 0.92 into the file, which is local 21.6 to 33.6, so an
      // 8 frame wipe starting at 20 has its leading edge crossing the word as the word is said.
      // That is what a stamp on a spoken word is supposed to do.
      slabAt: 20,
    },
    // ---------------------------------------------------------------------------------
    // Beat 6. THE CHAT, and the third of Cameron's four named features. THE HERO IS "PLAY".
    //
    // The note on the first cut was that a viewer gets a strong claim and almost no product,
    // and it named four things: the deck, a match, a chat, playstyle matching. The first two
    // are beats 2 and 5, the fourth is a card's own tag under beat 2 and the rail's line under
    // beat 3, and this beat is the third. It is the one shot in the film of two people
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
    //
    // PLAY gets no accent and no slab. The two stamps are spent, and a third would make all
    // three ordinary.
    // ---------------------------------------------------------------------------------
    {
      frames: 52,
      lines: ["then go", "play"],
      hero: 1,
      // "then go" opens the phrase at 0.02 into the file and PLAY lands at 0.50, which is local
      // 6.5 and local 20.9. What separates them in the envelope is the closure before the /p/ of
      // PLAY: two frames at -58 dBFS, a real boundary rather than an inferred one.
      reveal: [0, 14],
      clip: "chat-typing",
      clipFrom: 5.35,
      treatment: "app",
      anchor: "top",
      // The one beat that overrides its treatment's camera, and both overrides are the same
      // fact about this screen: a chat is text to both edges. The bubble's right side reaches
      // video x 1031 of 1080 before the camera touches it, so the treatment's own 1.1 base has
      // the message clipped in the opening frame and its SENDING label gone.
      //
      // Parking the camera instead was the first answer and it was wrong. Frame differenced at
      // 30fps the whole clip is essentially a still: the typing moves single letters, the send
      // is one small slide, and from 6.0s onward nothing moves but a five letter status label.
      //
      // So the plate pushes for every frame of the beat from a base of 1.0, and the push is
      // pinned to the right edge so the bubble cannot be reached by it. The right hand side of
      // the screen holds still, the left drifts out of frame, and what leaves is the empty half
      // of the conversation and the outer keys of the keyboard.
      camScale: 1,
      camPinRight: true,
    },
  ],

  // The rail. Cue lengths are timed against the beats above by hand and sum to the same total.
  //
  // Not one of these lines appears in the display type, which is the rule the two register
  // design stands on. Read on its own the rail is a second, quieter argument: everyone gets
  // this wrong / this is the deck / you match on playstyle / nobody is picked on looks / 18
  // plus and platonic / no more solo queue.
  cues: [
    // Colour rather than a highlighter. The film has one highlighter now and it is spent on
    // the positioning line five beats from here; two of them in eleven seconds made both of
    // them ordinary, which is the note about fewer and larger gestures applied to the rail.
    { line: "everyone gets this wrong", frames: 76, accent: "wrong", mark: "color", instant: true },
    // Names the thing on screen while the type makes the claim about it. A caption doing what
    // a caption is for.
    { line: "this is the deck", frames: 50, accent: "deck" },
    // THE FILM'S ONE HIGHLIGHTER, and it is here because this is the only beat with no red
    // anywhere else in it: the display type on beat 3 carries no accent and no slab, so a
    // boxed word on the rail is the single mark on the frame. It is also the last quiet beat
    // before the whole screen floods, which makes it a small red mark immediately followed by
    // a large one.
    { line: "you match on playstyle", frames: 64, accent: "playstyle", mark: "box" },
    // The consequence rather than the fact, and it is a rewrite. The old line was "no photos
    // on the cards", which under a display hero reading NO was the same claim twice at two
    // sizes, and that is the one thing the two register design is not allowed to do.
    //
    // No accent, and it is the flood's fault rather than the line's: the accent ink IS the
    // flooded field, so an accented word there is vermillion on vermillion held apart by its
    // own black keyline, which reads as an outlined word rather than as an emphasis.
    { line: "nobody gets picked on looks", frames: 52 },
    // The positioning line, said plainly once, over the only shot of a locked duo, because a
    // photograph of a person is the one frame in the film that has to be unambiguous about what
    // this app is.
    //
    // COLOUR AND NOT A HIGHLIGHTER, and the reason is the frame rather than the sentence. This
    // beat's hero carries the film's second slab, and the rail sits 50px under it: rendered, a
    // boxed word here and the slab under DUO stacked into a single two tier red block, which is
    // both of the film's peaks spent on one frame and neither of them landing. The doctrine's
    // rule for a promoted word is that it is earned and never adjacent to another one. So the
    // highlighter moved three beats earlier, to the only frame with no other red in it, and
    // this line keeps the accent ink.
    { line: "18 plus and platonic", frames: 52, accent: "platonic", mark: "color" },
    // The last thing read, and the only line in either register that names the feeling rather
    // than the product. It is the pain the whole thing exists to answer.
    { line: "no more solo queue", frames: 52, accent: "solo" },
  ],
};

/** Body length in frames, derived rather than typed, so a retimed beat moves the composition
 * with it and the end card cannot end up overlapping the last statement. */
export const bodyFrames = (script: KineticNativeScript): number =>
  script.beats.reduce((total, beat) => total + beat.frames, 0);

/**
 * 1.0 second of end card.
 *
 * The card is a call to action, not a scene, and in a film this short every frame it holds is
 * a frame the film is over. It was 36 frames once and 20 of them rendered frozen in three
 * blocks, because the card's four events did not reach the end of it. 30 frames is the seam
 * entry (0 to 10), the slab wipe (12 to 22), the URL arriving under it (20 to 26) and a fifth
 * of a second of hold on the finished lockup, which is the shortest the last thing a viewer
 * reads can be held for and still be read.
 *
 * It did NOT grow with the rest of this cut, and that is deliberate. The note was that the
 * film feels rushed, and a rushed film is one whose CONTENT is crowded; the end card has one
 * lockup on it and holding it longer would be padding, which the same note explicitly rules
 * out.
 *
 * It lives here rather than in EndCard.tsx because the audio path has to lay a bed under the
 * whole composition and asks a node script for its length. Importing that component would pull
 * `@/lib/fonts` in behind it, which opens a `delayRender` handle at module scope, and outside
 * Chromium there is no render to hold back. This file imports nothing but the frame rate.
 */
export const END_FRAMES = Math.round(1 * FPS);

/** The whole composition: every beat, then the card. */
export const kineticNativeDuration = (script: KineticNativeScript): number =>
  bodyFrames(script) + END_FRAMES;
