/**
 * Direction C paints outside the Volt identity, and that is the point of the experiment.
 *
 * The daily formats are the app's identity on video: off-black, chartreuse, mono labels, a
 * graticule under everything. This direction is allowed to ignore all of it, because the
 * brief for these three experiments lifts the constraint and asks only for something that
 * stops a thumb.
 *
 * What replaces it is not a second brand. Every ink below is pulled OUT of the footage the
 * montage cuts together, so the graphics look like they belong to the clips rather than to a
 * kit sitting on top of them:
 *
 * - HOT is the red Valorant prints DEFEAT in. It is already on screen at the loudest frame
 *   of the video, so the one caption block that uses it reads as part of that moment.
 * - VOLT is the app's own button colour, imported from the app's tokens rather than typed,
 *   so the highlight on the answer half matches the buttons visible in the app footage.
 * - INK and SHADOW are plain white and plain black, because a caption over gameplay has to
 *   survive a bright sky and a dark tunnel in the same second.
 */
import { darkColors } from "@app/theme/tokens";

export const INK = "#FFFFFF";
export const VOID = "#000000";
/** Valorant's defeat red. */
export const HOT = "#FF4655";
/** The app's own volt, so the highlight matches the buttons in the footage. */
export const VOLT = darkColors.volt;
/** What sits behind a caption block's text when the block is filled. */
export const BLOCK_INK = darkColors.background;
