/**
 * THE STAGE: one ground, one camera, one grid, shared by all three directions.
 *
 * Everything in this file is either a number lifted straight out of the frame-by-frame
 * measurement of the three reference reels (converted from their 720x1280 to this frame's
 * 1080x1920 by x1.5), or a number derived from one. Where a reference number could not be used
 * as measured, the reason is written beside it, because the last nine directions failed by
 * inventing constants and then defending them in a comment.
 *
 * =====================================================================================
 * 1. THE GRID: ONE HORIZONTAL CENTRE, ONE VERTICAL BAND, ONE MEASURE
 * =====================================================================================
 *
 * The single most expensive mistake in the rejected directions was a claim in src/frag/ground.ts
 * that the Uber reel is left-aligned. It is not. Measured line centres against a frame centre of
 * 360 in that reel's own 720px width:
 *
 *   "You have got options"   x 114-628   centre 371   vertical centre 639.5 (frame 640)
 *   "move your way"          x 137-593   centre 365   vertical centre 623
 *   "ready when you are."    x 194-525   centre 360   vertical centre 639.5
 *   UberX card                           centre 360
 *   picker card                          centre 360
 *
 * Every line and every object is horizontally centred within 11px, which is 1.5% of the width,
 * for 25.6 seconds without a single exception. So:
 *
 *   CENTRE_X   540, always. Nothing in these three films hangs off a margin.
 *   BAND       the vertical optical centre of content lives between 42% and 53% of the height.
 *              Type sits at exactly 50%. Heavier objects sit slightly high, at 44%, because
 *              their shadow and their bottom-weighted content pull the optical centre down.
 *   MEASURE    a centred column 63-75% of the frame width. 745px is 69%, the middle of the
 *              measured band, and it leaves 167px of air on both sides.
 *
 * That is the whole answer to "the text is in weird spots". The rejected cut had type at
 * 42-52% of the height on a left edge at x=118 and objects centred at 59%: two vertical
 * anchors, one left edge, a ragged right edge and an empty bottom third.
 *
 * =====================================================================================
 * 2. THE GROUND IS LIGHT. THE ARGUMENT THAT SAID OTHERWISE ANSWERED THE WRONG QUESTION
 * =====================================================================================
 *
 * This section used to argue at length for a near-black ground. That argument is set out again
 * here rather than deleted, because it is seductive and the next person to read this file would
 * otherwise re-derive it from the same true premise.
 *
 * THE PREMISE IS CORRECT. #CDFF3D is about 1.4:1 on white and about 13:1 on the app's own
 * #0A0B09. Chartreuse laid ON a pale field is not a colour, it is a smudge, and a film that
 * loses its chartreuse has lost the one thing that makes DuoQueue recognisable.
 *
 * THE CONCLUSION DOES NOT FOLLOW, because the premise assumes the chartreuse has to sit on the
 * ground. IT DOES NOT. The accent lives INSIDE the dark app fragments, and a fragment is a dark
 * object sitting ON a light ground: it keeps its 13:1 against its own near-black field while the
 * frame around it stays bright. Light ground, DARK product, chartreuse burning inside the
 * product. The only thing the arithmetic actually forbids is accent TYPE set directly on paper,
 * and the app answers that itself. `lightColors.volt` is an olive ink, which is what the brand
 * resolves chartreuse to when it is printed rather than lit. See INK below.
 *
 * AND IT IS MEASURED RATHER THAN ARGUED. Mean luma, ffmpeg signalstats YAVG, every 30th frame,
 * averaged over the file:
 *
 *   Uber reference           194 / 255
 *   ClickUp reference        223 / 255
 *   this file when dark       19 / 255   (pro-a; pro-b was 21 and pro-c 19)
 *   src/frag/, light ground  223 / 255   with the chartreuse fully intact inside its fragments
 *
 * An order of magnitude, on the single most visible property of the reference material, and
 * src/frag/ is the standing proof that the light ground costs the brand nothing. Every reference
 * reel Cameron chose is near white. THE GROUND VALUES BELOW ARE src/frag/ground.ts's, unchanged,
 * because those are the ones that measured 223.
 *
 * The dark version was not wrong about everything, and the half of it that was right is section
 * 3: a flat field cannot carry an object, so the ground is a lit surface rather than a swatch.
 *
 * =====================================================================================
 * 3. LIGHT AND SHADOW, WHICH IS NOW THE MEASUREMENT THE RIGHT WAY UP
 * =====================================================================================
 *
 * Measured on the Uber card at rest (255 = the white ground):
 *
 *   below, x=360:   255 255 255 255 242 248 252 255      a 15px band bottoming at 242, -5%
 *   left,  y=500:   255 ... 250 246 244 238 235          an 18px gradient to 235, -8%
 *   right, y=500:   232 rising to 255 over 20px                                     -9%
 *
 * Left, right and below are SYMMETRIC and there is essentially no offset. That is an ambient
 * occlusion ring, not a drop shadow, and src/frag/ground.ts's static
 * `38px 44px 92px rgba(...,0.28)` was 3.1x too dark and twice as far offset.
 *
 * The dark cut had to INVERT this measurement to use it at all: on off-black the object is the
 * bright thing, so elevation was carried by an occlusion pool plus a rim of light. On paper no
 * inversion is needed and `elevation()` below is simply the measurement in the direction it was
 * taken. Elevation gets EASIER on this ground rather than harder, because a shadow on paper is
 * conventional and there is finally something for it to darken.
 *
 * WHAT DOES NOT CHANGE IS THAT THE SHADOW IS DRIVEN. The reference's shadow moves with the
 * geometry: measured at f162, peak tilt, the shadow under x=360 had moved down 25px while the
 * shadow under x=150 had not moved at all. It is the projection of a tilted quad, not a filter
 * riding along behind one, and every offset and every spread below is still a function of the
 * object's live rotation. Every object in these three films still has to read as sitting above
 * the ground with its shadow answering its tilt.
 *
 * THE OTHER HALF OF ELEVATION ALSO SURVIVES, INVERTED. On the dark ground a receding object was
 * DARKENED toward the field. On paper the same depth cue runs the other way: distance washes an
 * object toward the paper, which is ordinary atmospheric perspective and is what both references
 * do to their background layers. So every recede scrim in the three directions now lightens
 * where it used to darken, and PAPER below is the colour they all lighten toward.
 */
import { darkColors, lightColors } from "@app/theme/tokens";

/** The frame, and the two axes everything is placed against. */
export const FRAME = { w: 1080, h: 1920 } as const;

/**
 * The one horizontal centre. Measured 360 +/- 11 on a 720 frame, so 540 +/- 16 here, and these
 * films spend none of that tolerance: everything is at 540 exactly.
 */
export const CENTRE_X = FRAME.w / 2;

/**
 * The vertical band content's optical centre may occupy, 42% to 53% of the height.
 *
 * TYPE is at 50.0% exactly, which is where all three measured Uber lines sit. OBJECT is at 44%,
 * the measured mean of the three Uber hero cards (41.7%, 43.4%, 43.1%), which is high of centre
 * because a card is bottom-weighted: its shadow and its heaviest content are below its middle,
 * so its geometric centre has to sit above the frame's for its optical centre to land on it.
 */
export const BAND = {
  top: Math.round(FRAME.h * 0.42),
  bottom: Math.round(FRAME.h * 0.53),
} as const;
export const TYPE_Y = Math.round(FRAME.h * 0.5);
export const OBJECT_Y = Math.round(FRAME.h * 0.44);

/**
 * The centred column. 745 of 1080 is 69%, the middle of the measured 63-75%.
 *
 * It governs BOTH type and objects, which is the correction: the rejected direction had one
 * measure for the type block and a different anchor for the objects, so the film had two
 * columns and neither of them was the frame's.
 */
export const MEASURE = 745;

/** The largest an object may be drawn. The measured Uber heroes run 56-78% of the width; the
 * gameplay plate, which is the one landscape image in the set and the one shot in the film that
 * is not the product, is allowed past this by name rather than by accident. */
export const OBJECT_MAX_W = Math.round(FRAME.w * 0.78);

/**
 * THE CAMERA. One perspective for the whole film, stated once.
 *
 * 1400px is 1.30x the frame width. The rejected direction used 2400px, which is 2.2x the width,
 * and a perspective that far away barely projects: at 2400 a 7 degree rotateY on a 678px card
 * produces a 3.7% difference between its two vertical edges, which is a mockup preset. At 1400 a
 * 20 degree rotateY on the same card produces the measured 12.7% trapezoid.
 *
 * The origin sits at 45% of the height rather than 50%, matching the measured vanishing point in
 * both the Uber and ClickUp arrivals: objects enter from slightly above the eyeline and settle
 * down onto it.
 */
export const CAMERA = { perspective: 1400, origin: "50% 45%" } as const;

/**
 * THE INKS. Five, and each one is the app's own answer to a question this film asks rather than
 * a colour somebody chose. Imported rather than retyped, so a brand change moves the film.
 *
 *   `type`    lightColors.text. The film's words are set in the same near black the app sets its
 *             own words in when it is on paper.
 *   `dim`     lightColors.textMuted, for the register under a statement and for the one rule.
 *   `accent`  lightColors.volt, and THIS IS THE IMPORTANT ONE. The app already knows chartreuse
 *             is illegal at type scale on paper and resolves it to an olive ink, so the film's
 *             key word is the brand's accent rendered the way the brand renders it on this
 *             ground rather than a sixth colour somebody picked.
 *   `brand`   darkColors.voltRaw, raw #CDFF3D, legal ONLY inside a dark fragment or on a dark
 *             slab, where it has its 13:1. Never on the ground, at any size.
 *   `app`     darkColors.background. The dark field a brand-coloured element sits on, and the
 *             fill behind a fragment's rounded corners, so a corner reveals the app's own field
 *             rather than a sliver of paper through an antialiased edge.
 */
export const INK = {
  type: lightColors.text,
  dim: lightColors.textMuted,
  accent: lightColors.volt,
  brand: darkColors.voltRaw,
  app: darkColors.background,
} as const;

/**
 * THE GROUND. src/frag/ground.ts's values, unchanged, because those are the ones that measured
 * 223 against ClickUp's 223.
 *
 * A vertical sweep rather than a flat fill, because a flat swatch reads as a slide and a lit
 * sweep reads as a surface. It is also the cheapest insurance against H.264 banding, which a
 * 1080x1920 field of one near-white value will show every time. The sweep is 178 degrees and not
 * 180 on purpose: a gradient exactly on the axis bands in horizontal stripes, and two degrees of
 * tilt breaks the stripe into a diagonal the encoder dithers away.
 *
 * The measurement behind these three stops lives in src/frag/ground.ts and is not repeated here:
 * 239 to 248, nine steps of falloff, warm and no longer beige, about 6 luma under Uber's flat
 * white and stopping there deliberately, because the mid stop is the value directly behind every
 * object in the film.
 *
 * THE POOL IS THE ONE NUMBER THAT MOVED IN THE PORT, and it moved because the grid did. frag is
 * a left-aligned film with its stage at 59% of the height, so its pool sits at 42% 58%. This one
 * is centred with its object band at 44%, so the pool sits at 50% 46%: under the object, which
 * is the only thing a pool is for. Its size and its alpha are frag's.
 */
export const GROUND = {
  base: "#F6F3EA",
  sweep: "linear-gradient(178deg, #FAF8F2 0%, #F6F3EA 52%, #F3EFE5 100%)",
  pool: "radial-gradient(56% 32% at 50% 46%, rgba(255,255,251,0.5) 0%, rgba(255,255,251,0) 74%)",
} as const;

/**
 * GROUND.base as three numbers, for the scrims that have to lighten toward it at an alpha.
 *
 * Every recede in the three films is one of these. An object pushed back in Z is also washed
 * toward the paper, because on this ground depth is a loss of contrast in the direction of the
 * ground rather than away from it. See section 3 of the header.
 */
export const PAPER = "246,243,234";

/**
 * The colour the field floods to on a beat.
 *
 * Measured, the Uber reel's two full-frame floods land the whole frame on #C7E2FB and #FAF79D:
 * pale, unmistakably coloured, and nowhere near white. Ours is the volt family's own pale, which
 * is the one dilution at which the brand colour is allowed to cover the ground, because at this
 * strength it is a tint rather than the 1.4:1 smudge of section 2.
 */
export const FLOOD = "#E6FBA4";

const RAD = Math.PI / 180;

/**
 * The shadow and the rim, both computed from the object's live rotation.
 *
 * The reference's shadow moves with the geometry: at peak tilt the pool under the card's centre
 * had moved down 25px while the pool under its left edge had not moved at all, because what is
 * being drawn is the projection of a tilted quad rather than a filter following an element
 * around. A box-shadow cannot skew, but it can be DRIVEN, and the two things the eye actually
 * reads off a tilted object's shadow are which way it has slid and how much it has spread.
 *
 *   offset   37px * sin(rotation), which is the measured projection distance for a card of this
 *            size at this perspective. A rotateX that brings the bottom edge toward camera slides
 *            the pool up behind it; a rotateY that swings the right edge away slides it right.
 *   spread   the blur grows 20% on the corner that lifts, which a single box-shadow expresses as
 *            a 20% growth scaled by the total tilt magnitude.
 *   rim      a hairline of the studio's light along the object's own top edge. It is drawn INSET,
 *            on a face that is near black, so it is a bevel catching a key light rather than a
 *            halo on the paper.
 *
 * THE ALPHAS ARE THE MEASUREMENT, IN THE DIRECTION IT WAS TAKEN. rgba(41,34,18,0.13) over
 * #F6F3EA lands at about 224, which is the -8% the Uber occlusion ring measured; the wide pass is
 * pulled in by 18px of negative spread so it reads as the surface being lit rather than as a drop
 * shadow filter. The near-black is WARM, the ground's own hue darkened, because a neutral grey
 * shadow on warm paper is one of the two or three things that make a mockup look like a mockup.
 */
export const elevation = (
  rotX: number,
  rotY: number,
): { shadow: string; rim: string } => {
  const dx = 37 * Math.sin(rotY * RAD);
  const dy = -37 * Math.sin(rotX * RAD);
  const tilt = Math.min(1, (Math.abs(rotX) + Math.abs(rotY)) / 34);
  const near = 30 * (1 + 0.2 * tilt);
  const far = 96 * (1 + 0.2 * tilt);
  return {
    shadow: [
      `${dx.toFixed(1)}px ${(dy + 4).toFixed(1)}px ${near.toFixed(0)}px rgba(41,34,18,0.13)`,
      `${(dx * 1.6).toFixed(1)}px ${(dy * 1.6 + 18).toFixed(1)}px ${far.toFixed(0)}px -18px rgba(41,34,18,0.20)`,
    ].join(", "),
    rim: `rgba(255,255,255,${(0.055 + 0.05 * (1 - tilt)).toFixed(3)})`,
  };
};

/**
 * The specular band on a piece of glass, as a function of its rotateY.
 *
 * Direction A needs it and the other two use it on their card faces at a third of the strength.
 * The reference reels do not have this, because none of them lights anything; it is the thing
 * that separates a device rotating in a studio from a rectangle with a picture on it. The band
 * travels across the face in the opposite direction to the rotation, which is what a fixed key
 * light does when you turn a phone in your hand.
 *
 * It is untouched by the ground going light, because it lives on the FACE of a near-black
 * object. A specular highlight is a property of the object and its key light, not of the surface
 * the object happens to be standing on.
 */
export const sheen = (rotY: number, strength = 1): string => {
  const at = 50 - rotY * 2.4;
  const a = (0.16 * strength).toFixed(3);
  return `linear-gradient(${String(102 - rotY)}deg, rgba(255,255,255,0) ${String(Math.round(at - 26))}%, rgba(255,255,255,${a}) ${String(Math.round(at))}%, rgba(255,255,255,0) ${String(Math.round(at + 22))}%)`;
};

/**
 * =====================================================================================
 * TYPE
 * =====================================================================================
 *
 * Measured, in the reference's 720 space and converted:
 *
 *   cap height, 4-word line     39px  ->  58px
 *   font size,  4-word line    ~54px  ->  81px
 *   font size,  3-word line    ~86px  -> 129px
 *   line measure            63-75% of width  ->  680-810px
 *   end-card tagline           ~43px  ->  65px, and SMALLER than the body lines
 *
 * THE RULE THE REJECTED DIRECTION GOT BACKWARDS. Size is not chosen; the MEASURE is held and the
 * size falls out of it. A four word line is 81px and a three word line is 129px because both are
 * the same number of pixels wide. `TYPE_CAP = 76` was a ceiling on the wrong variable, and it
 * made the film's short, loud lines small.
 *
 * `max` exists so a one word clause cannot fill the frame edge to edge, which is the failure
 * that produced "APP at 500px" three directions ago. It binds only on the shortest clauses of
 * beat four.
 *
 * THERE IS NO MINIMUM, AND THERE MUST NOT BE ONE. A floor of 68 was here and it was measured
 * doing exactly the damage the ceiling was added to prevent: `groupSize` fits a line to the
 * measure and a floor then RAISES that size, which makes the line wider than the measure it was
 * just fitted to. Rendered and measured off the frame, beat one came out 1024px wide, 94.8% of
 * the frame against a 69% measure, and beat three ran off the right edge at x=1079 with its
 * centre pushed 82px off 540. A clamp may only ever make type SMALLER. If a line is so long that
 * its honest size looks weak, the line is too long and the fix is to break it, which is why the
 * two eleven and twelve word beats in script.ts are set as three lines rather than two.
 */
export const TYPE = {
  measure: MEASURE,
  max: 138,
  tracking: "-0.022em",
  /** Leading as a multiple of the size. 1.06 is tight enough that a two line stack reads as one
   * block, which is what every measured reference stack does. */
  leading: 1.06,
} as const;
