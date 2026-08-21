/**
 * THE TYPE DIRECTION'S LAYOUT SYSTEM, stated before it is used.
 *
 * =====================================================================================
 * WHAT THIS DIRECTION IS, AND WHAT IT IS A REBUILD OF
 * =====================================================================================
 *
 * Cameron asked for "the type that we originally started", clean and concise. The original is
 * src/kinetic-native/, and his verdict on it was "the words on the screen are to big still i
 * think, it feels cheap". The diagnosis is written out in the header of
 * src/kinetic-native/type-fit.ts and it is worth restating in one sentence, because everything
 * below is a consequence of it:
 *
 *   THE OLD CUT FITTED EVERY LINE TO THE FULL FRAME WIDTH AND CALLED THAT ITS SIGNATURE.
 *
 * A fitted size is inversely proportional to the length of the string, so size was assigned by
 * spelling. On the opening frame that put APP, a three letter function word, at about 500px and
 * THIS IS at about 215px: the largest thing on the film's most important frame was its least
 * meaningful word. And fitting to the FULL width means the block runs to the bleed on both
 * sides of every line, so there is no negative space anywhere in the frame by construction.
 * Type at the bleed is a poster. Type with air around it is a film.
 *
 * The fix that worked, and which this file inherits by importing its three numbers rather than
 * retyping them, is one HERO line per beat and everything else SUPPORT, separated on several
 * axes at once so the difference reads as a decision rather than as two sizes of one thing.
 *
 * =====================================================================================
 * BIG TYPE IS STILL THE POINT. IT IS THE HIERARCHY THAT WAS MISSING, NOT THE SCALE.
 * =====================================================================================
 *
 * The finished fragment ad sets its whole film at 76px, about 2.9% of frame height, because it
 * is built from three reels whose display type measures 3 to 4.5%. This direction is not that
 * film and must not converge on it. Its hero runs at HERO_CAP, roughly 11% of frame height and
 * about 3.7x the fragment ad's, which is squarely inside the range the approved rebuild of
 * kinetic-native shipped at (its six heroes ran 340 / 319 / 304 / 269 / 243 / 188).
 *
 * What is different from the rejected cut is not the size. It is that:
 *
 *   ONE beat's line is the hero and the rest is support (see ./plan.ts for which, and why).
 *   The two registers are separated on FOUR axes at once: about 3.1x size, three weight steps,
 *   opposite tracking signs, and opposite case. See SUPPORT_RATIO and the tracking pair below.
 *   The hero is ONE SIZE FOR THE WHOLE FILM, so beat four is exactly as large as beat one and
 *   no word is bigger because of how it happens to be spelled. See ./type.ts.
 *   Nothing runs to the bleed. Every line is fitted or capped inside a MEASURE that is itself
 *   inset 118px a side, so the tightest right hand margin in the film is 140px on the two
 *   longest heroes and the loosest is about 600px on "duo". The rejected cut left 72px on both
 *   sides of every line of every beat, which is what made it read as a poster.
 *
 * =====================================================================================
 * WHAT IS IMPORTED, LITERALLY, AND WHY
 * =====================================================================================
 *
 * The ground and its sweep, the three inks, the left edge, the measure, the shadow, the gap
 * between two pieces of one shot and the leftward current are IMPORTED from src/frag/ground.ts,
 * not restated. Not "the same values", the same constants. Three ads go out under one name and
 * the only way to guarantee they cannot drift is to have one file own the numbers.
 *
 * SUPPORT_RATIO, SUPPORT_TRACKING and REGISTER_GAP are imported from src/kinetic-native/skin.ts
 * for the same reason pointed the other way: they ARE the fix Cameron responded to, and a
 * rebuild that retypes them is a rebuild that can quietly disagree with the thing it is
 * rebuilding.
 *
 * Only three things are authored here: the vertical placement, which had to be re-solved
 * because this film's type block is 377px tall against the fragment ad's 204; the hero's own
 * face settings, because the hero is lower case here and kinetic-native's leadings assume all
 * caps and would clip every descender in the script; and the light pool, whose position follows
 * the stage and therefore could not be imported. See POOL.
 */
import { GROUND, INK, MEASURE, PIECE_GAP, SHADOW, X0 } from "@/frag/ground";
import { REGISTER_GAP, SUPPORT_RATIO, SUPPORT_TRACKING } from "@/kinetic-native/skin";

export {
  GROUND,
  INK,
  MEASURE,
  PIECE_GAP,
  REGISTER_GAP,
  SHADOW,
  SUPPORT_RATIO,
  SUPPORT_TRACKING,
  X0,
};

/**
 * THE CURRENT, AS A DISTANCE PER BEAT RATHER THAN A RATE PER FRAME, AND THAT IS THE CHANGE.
 *
 * src/frag/ground.ts states the current as 1.25 pixels a frame and every object and the type
 * block drift left at it, re-centred so each beat is symmetric about the grid and the drift
 * never accumulates. The rate is right and the film needs it: four of the six fragments are
 * deliberately still holds, because a fragment that is being drawn is a fragment you cannot
 * read, so without a carrier this film has four beats of frozen pixels.
 *
 * A RATE PER FRAME MAKES THE MARGIN A FUNCTION OF HOW LONG THE PHRASE IS. A beat centred on
 * the grid and drifting at a fixed rate swings half its total distance either side of it, so
 * the amplitude is CRUISE times the beat's own length over two. This film's beats run 70, 68,
 * 56, 49, 52 and 52 frames, which is 44, 43, 35, 31, 33 and 33 pixels of amplitude: the widest
 * beat swings 43% further off the grid than the tightest, for no reason except that "queue up
 * with a duo" takes longer to say than "duo locked".
 *
 * Measured on the first render, that put the type block's left margin at 83px on beat one and
 * 98px on beat four, on frames where the ink is at full strength. Cameron rejected a cut that
 * ran 72px a side, and this direction exists because of that note; 83 is 11px from it, and it
 * is 11px from it on the LONGEST beat rather than on the busiest frame. A margin that varies
 * with the read is the same class of accident as a type size that varies with the spelling,
 * which is the defect ./type.ts exists to remove. It should not survive in the layout.
 *
 * So the current is a DISTANCE. Every beat drifts exactly this far, whatever it costs in rate,
 * and the tightest margin in the film is therefore one number rather than six.
 *
 * 56px is 5.2% of the frame width, and it is inside the range the delivered ad already proved
 * visible on this exact ground against these exact objects: src/frag/ground.ts records its own
 * current as "61px across the shortest beat and 88px across the longest". This is 92% of the
 * smallest of those. The rate it implies runs 0.80px a frame on the 70 frame beat to 1.14 on
 * the 49 frame one, and the spread does not reach the seams: an entry or an exit moves TRAVEL,
 * 130px, in 10 to 13 frames, which is ten times the cruise, so the velocity either side of a
 * cut is set by the curve and not by this.
 *
 * WHAT IT BOUGHT, read off the re-render rather than predicted. Per beat, on frames where the
 * ink is at full strength, tightest type left margin then object left then object right:
 *
 *   before   83 / 84 / 44    85 / 85 / 51    87 / 91 / 58    98 / 97 / -    96 / 95 / 44    93 / 95 / 61
 *   after    96 / 95 / 60    97 / 96 / 63    93 / 96 / 64   101 / 99 / -    99 / 98 / 64    97 / 98 / 64
 *
 * The floor rose 10 to 16px on every axis, and the point is the second row's flatness: the type
 * margin now spans 8px across six beats where it spanned 15, and the object's right hand margin
 * spans 4px where it spanned 17. The tightest margin in the film is 93px, and it is 93px
 * because that is what this file says it is rather than because beat one has five words in it.
 */
export const CRUISE_SPAN = 56;

/**
 * The cruise offset for a frame, in pixels, positive to the right.
 *
 * Symmetric about zero by construction: it is +span/2 on a beat's first frame and -span/2 on
 * its last, so the object's mean position over the beat IS the grid and six beats of drift
 * cannot accumulate into a seventh.
 */
export const cruiseAt = (beatFrame: number, beatLength: number): number =>
  CRUISE_SPAN * (0.5 - beatFrame / Math.max(1, beatLength));

/**
 * THE CEILING ON THE HERO, and it is a ceiling rather than a target.
 *
 * ./type.ts picks ONE hero size for the entire film: the largest that lets every hero line fit
 * the measure, capped here. Measured on the render, the binding constraint is the longest hero,
 * "they play", so this number does not currently bind. It exists for the reason BOX.cap exists
 * in kinetic-native, which is the last place the rejected cut's problem could get back in: if
 * the copy ever loses its longest hero, a two letter hero would otherwise fit at over 700px and
 * the film's size would once again be decided by orthography.
 *
 * 240 is set where the approved rebuild's largest hero sat, less a margin. Its six ran 188 to
 * 340 on this same frame at TYPE_SCALE.a, and this film's copy is shorter and lower case, so it
 * needs less ceiling to say the same thing.
 */
export const HERO_CAP = 240;

/**
 * Tracking for the hero, and it sits between the two directions either side of it on purpose.
 *
 * The fragment ad sets -0.02em, which its own file explains was loosened from -0.035em because
 * -0.035 "was tuned for 340px words and closes the counters up at 70". This film's hero is
 * around 210px, which is much nearer the 340 than the 70, and tight negative tracking is most
 * of what makes a heavy line read as MASS rather than as a big sentence. -0.03em is where the
 * counters of the a, the e and the o in "message" and "game" are still open at this size.
 *
 * It is also half of the axis that separates the two registers: this is negative and
 * SUPPORT_TRACKING is positive, and opposite signs is a difference a reader feels without being
 * able to name it. Tight letters lock into one shape and read as an object. Wide letters
 * separate and read as an annotation on whatever they sit next to.
 */
export const HERO_TRACKING = "-0.03em";

/**
 * Leading for the hero, and the number is a measurement rather than a preference.
 *
 * kinetic-native sets 0.86 because every line in that film is upper case and an all caps line
 * has no descenders to clear. This film's hero is LOWER CASE, because the brand is lower case
 * everywhere it writes its own name, and four of the six heroes carry a descender: the g of
 * "game", the y of "play" and "they play", the g of "message".
 *
 * Manrope ExtraBold, measured off public/fonts/Manrope_800ExtraBold.ttf and recorded in
 * src/kinetic-native/skin.ts as FACE: ascent 1.066em, descent 0.300em, real ink tail 0.255em
 * below the baseline. A line box is one leading tall with the glyphs centred in it by half
 * leading, so the baseline sits at (leading + 0.766) / 2 from the top of the box and the tail
 * reaches 0.255em below that. Requiring the tail to stay inside the box gives leading >= 1.276.
 *
 * 1.34 is the fragment ad's, which clears it with 0.032em to spare, 7px at this size. Using its
 * number rather than solving a new one keeps one leading across the campaign, and it is already
 * verified: no sampled frame of either delivered cut has a clipped descender.
 */
export const HERO_LEADING = 1.34;

/**
 * Leading for the support, and 0.96 is kinetic-native's unchanged.
 *
 * The support IS upper case here, so it has no descenders and can take a leading under 1. It is
 * looser than that file's hero leading of 0.86 for the reason stated there: two support lines
 * can sit adjacent, and at 0.86 with positive tracking they set as a grey block rather than as
 * two readable lines. This film never has two, so it is inherited rather than needed.
 */
export const SUPPORT_LEADING = 0.96;

/**
 * THE SINGLE BASELINE, expressed as the bottom of the hero's line box.
 *
 * The block is anchored at its BOTTOM and not its top, which is the fragment ad's rule and the
 * carousel's, and the reason is the same in all three: the eye needs one line to come back to
 * across six cuts. Here it is stronger than it is there. The hero is ONE size for the whole
 * film and it is always the last line of the block, so anchoring the block's bottom anchors the
 * hero's baseline exactly, to the pixel, on every beat. Six cuts and the biggest word on the
 * frame never moves.
 *
 * 665 rather than the fragment ad's 640, and the 25px is bought rather than picked. This film's
 * type block is 377px tall against that film's 204, so it starts 161px higher; pushing the
 * baseline down 25 puts 288px of sky above the block, which is 15% of the frame and reads as a
 * margin rather than as a headline jammed against the top edge.
 */
export const TYPE_BASE = 665;

/**
 * THE HANG BAND, re-solved for a taller type block.
 *
 * An object's top is the stage centre minus half its height, CLAMPED into [TOP_MIN, TOP_MAX].
 * The clamp exists because these objects differ in height by a factor of six and a half, from a
 * 113px playstyle chip to a 745px card and action row, and centring all of them on one line
 * marooned the short ones hundreds of pixels below the words with nothing in between. That is
 * the defect the fragment ad found on its first render, where the brightest pixel on the chip
 * beats was the empty gap between the type and the picture.
 *
 * TOP_MIN is 160 under TYPE_BASE, the film's tightest vertical interval, and it binds on the two
 * tallest objects. TOP_MAX binds on the four fragments under 210px tall, and it is 65px tighter
 * than the fragment ad's equivalent, measured off the first render of this film: at 1005 the
 * playstyle chip, which is 113px tall, sat 340px below the hero with nothing in between, and on
 * a frame whose type block is 347px tall that gap read as a hole rather than as air. At 935 the
 * interval across the film runs 160 to 270px, inside the range the delivered ad ships.
 *
 * The tallest stack in the film is the opening card with its action row at 745px, so the lowest
 * anything reaches is 1570, which is 60px clear of the ~1630 line where Instagram and TikTok
 * begin stacking their own chrome over the frame.
 *
 * =====================================================================================
 * THE COST THIS BAND DOES NOT PAY, STATED SO NOBODY RE-DISCOVERS IT
 * =====================================================================================
 *
 * Three of the six beats hang a thin strip here: the overlap chip at 172px, the playstyle chip
 * at 113 and the Send button at 163. Clamped to 935 they bottom at 1107, 1048 and 1098, which
 * leaves 813 to 872px of bare ground under them, the lower 42 to 45% of the frame. Beats one,
 * four and six fill to 1570, 1502 and 1424. That is the largest visual inconsistency between
 * this film's beats and it is real.
 *
 * IT WAS RE-TESTED RATHER THAN ARGUED. TOP_MAX at 1075 was rendered as stills on beats three and
 * five and set beside the shipped frames. It moves a strip 140px down: the ground below it goes
 * from 872 to 732 and the gap above it goes from 270 to 410. Neither frame is better. The strip
 * is no less alone, and on beat three the extra 140px above starts to read as the hole the 1005
 * measurement already caught. The emptiness is not in the band, it is in the objects: a 113px
 * crop on a 1920px frame has nowhere good to be.
 *
 * The fix that would work is a TALLER CROP of those two chips, with some of the card around
 * them, which is new footage and not a layout number. It is also constrained: every crop that
 * reaches further down Kofi's card reaches the prompt sentence whose most legible words are
 * "solo queue". See `frag-dark-card-top` in src/data/clips.ts.
 */
export const TOP_MIN = 825;
export const TOP_MAX = 935;
export const STAGE_Y = 1180;

/**
 * THE LIGHT POOL, and it is the one thing in this file that could not be imported.
 *
 * The stops are the fragment ad's verbatim. Only the position moved, and it had to: that file
 * puts its pool at 58% of the frame because its stage is centred on 1130, and it moved it there
 * from 50% after finding that the brightest pixel on the frame was the empty gap between the
 * words and the object. Under this band the objects' centres run 991 for the shortest to 1197
 * for the tallest, and 57% is 1094, which is inside every one of them.
 *
 * Importing the number rather than the intent would have reproduced the exact defect the number
 * was chosen to fix. The light falls where the object is.
 */
export const POOL =
  "radial-gradient(56% 32% at 42% 57%, rgba(255,255,251,0.5) 0%, rgba(255,255,251,0) 74%)";

/**
 * THE OBJECT IS SQUARE ON IN THIS FILM, AND THAT IS THE DELIBERATE DIVERGENCE.
 *
 * There is no TILT constant here and the omission is the point, so it is recorded rather than
 * left as an absence. The fragment ad puts every object inside one perspective container at
 * rotateY(7deg), and that is that direction's identity: it is the dimensional one, the one
 * built from three reels whose fourth shared property is "tilted objects with soft shadows on a
 * lit ground". Cameron asked for three ads, and two films that share a ground, a palette, a
 * script, a read and a shot plan need to disagree about something a viewer can see in one
 * frame.
 *
 * A rotated plane under a 210px headline is also a second perspective system competing with
 * flat type for no gain: the type cannot be tilted, so the frame ends up holding two cameras.
 * Square on, the fragment reads as an exhibit rather than as a product shot, which is the right
 * register for a film whose subject is its own words.
 *
 * SHADOW still applies, and it is what stops this being the failure that file warns about,
 * "flat rectangles pasted on a swatch". The two layer shadow, a tight contact and a long soft
 * cast, is what says the object is a millimetre off a lit surface. The perspective was never
 * the thing carrying that; the shadow was.
 */
