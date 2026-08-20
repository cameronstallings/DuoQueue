/**
 * DIRECTION A: "native". The look, in one file.
 *
 * Everything under `src/` other than this directory takes its colours, faces and spacing from
 * `apps/mobile/src/theme/tokens.ts`, because the four shipping formats are the Volt identity
 * on video. This direction is a deliberate exception: Cameron lifted the identity constraint
 * for it so that a version exists whose only job is to survive a thumb on TikTok. Nothing here
 * is imported by the shipping formats, and nothing here changes them.
 *
 * The one thing it does borrow is the typeface, and only because it is the heaviest face
 * already on this machine. Manrope ExtraBold is not Archivo Black, so `CaptionText` thickens
 * it with a same-colour stroke before the black outline goes on: the outline reads as the
 * caption edge, the inner stroke reads as weight. Swap in Archivo Black or Inter Black by
 * adding the file to sync-assets.ts and changing FACE below; nothing else has to move.
 */
import { FONT_FAMILY } from "@/lib/fonts";

export const FACE = FONT_FAMILY.extrabold;

/** Pure white on a near-black edge, because that is what survives compression, an autoplaying
 * feed at half brightness, and a 6cm-wide phone. */
export const INK = "#FFFFFF";
export const EDGE = "#000000";
/** The one hot colour. Yellow rather than the app's chartreuse: on a chartreuse product it is
 * still a step away from the interface underneath, so an accented word never reads as part of
 * the app's own UI. */
export const ACCENT = "#FFE24B";
export const ACCENT_INK = "#101013";
export const BACKDROP = "#000000";

/**
 * Pushed well past neutral, on purpose. Feed video is watched at low brightness next to
 * other people's over-graded phone video, and a correctly graded clip is the one that looks
 * flat. Saturation carries the app's chartreuse and Valorant's reds; contrast is what keeps
 * white captions off a mid-grey background.
 */
export const GRADE = "saturate(1.38) contrast(1.14) brightness(1.02)";

/** Corner falloff. Not a vignette for mood: it is what stops the corners of a bright gameplay
 * frame from competing with the caption block. */
export const VIGNETTE =
  "radial-gradient(ellipse 80% 66% at 50% 44%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.52) 100%)";

/** Caption geometry, in composition pixels.
 *
 * `bottom` is the important number. TikTok's own caption, handle and button rail eat roughly
 * the bottom fifth of the frame, and Reels eats a similar band, so text under about 380px
 * from the bottom is either covered or fighting for attention. This sits just above that,
 * which is also where a viewer's eye already is. */
export const CAPTION = {
  /** Width the longest line is fitted to, inside a 1080 frame. */
  box: 900,
  /** Distance from the bottom of the frame to the bottom of the last line. */
  bottom: 396,
  /** Ceiling for fitted type. A four-word line hits this and stops. */
  maxSize: 112,
  /** Multiple of the font size. Tight, the way a caption preset is. */
  leading: 1.02,
  /** Frames between one word popping and the next. 3 is 100ms: fast enough to read as one
   * phrase arriving, slow enough to see the cascade. */
  stagger: 3,
  /** Both strokes as a fraction of the font size, so they hold at any fitted size. */
  outline: 0.15,
  weightBoost: 0.045,
} as const;
