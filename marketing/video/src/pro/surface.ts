/**
 * HOW AN OBJECT MADE OF APP FOOTAGE SITS ON THE PAPER, per theme.
 *
 * ./ground.ts is the stage: one ground, one camera, one grid, one set of inks, shared by every
 * direction and by both themes. Nothing in this file touches any of that. What lives here is the
 * one thing that genuinely cannot be shared, which is how the boundary between an object and the
 * paper is made, because on the dark half the footage makes it and on the light half the footage
 * does not. The measurement that says so, ring by ring, is the header of ./theme.tsx.
 *
 * `elevationOf(rotX, rotY, "dark")` is `elevation(rotX, rotY)` exactly, forwarded rather than
 * re-typed, so the three finished directions cannot move by a pixel because this file exists.
 */
import { lightColors } from "@app/theme/tokens";

import { elevation, INK, sheen } from "./ground";
import type { AppTheme } from "./theme";

const RAD = Math.PI / 180;

/**
 * The per theme surface constants an object needs, and nothing else.
 *
 *   `field`    painted under the footage, so a rounded corner reveals the app's own background
 *              rather than a notch of the other theme or a sliver of paper.
 *   `falloff`  what the studio light falls off TO across a whole phone screen in direction A.
 *              On the dark screen that is the app's own near black and the gradient is invisible
 *              as a gradient. On the light screen it is the app's own paper, because a wash
 *              toward white erases dark type exactly as a wash toward black erases light type,
 *              and because below the card the wash colour IS the field colour, so the falloff
 *              has no visible edge on either theme. Falling to near black there would put a hard
 *              horizontal bar across a bright phone, which is a graphic rather than a light.
 */
export const SURFACE: Record<AppTheme, { field: string; falloff: string }> = {
  dark: { field: INK.app, falloff: "8,9,7" },
  light: { field: lightColors.background, falloff: "242,244,235" },
};

/**
 * The shadow and the rim.
 *
 * DARK is ./ground's `elevation`, unchanged and forwarded.
 *
 * LIGHT is that law plus a CONTACT PASS, and with the rim carrying the app's own hairline instead
 * of the studio's white bevel. See ./theme.tsx for the two paragraphs of measurement behind both.
 * Every offset is still the same sin(rotation) projection the dark law uses, so the shadow answers
 * the tilt rather than following the element around; the contact pass travels at a third of the
 * distance because the nearest shadow moves least when a quad turns.
 */
export const elevationOf = (
  rotX: number,
  rotY: number,
  theme: AppTheme,
  /**
   * How far this object has already been washed toward the paper by a recede that draws its own
   * scrim over the content, 0 to 1.
   *
   * IT IS HONOURED ON LIGHT AND IGNORED ON DARK, and the asymmetry is the point rather than an
   * oversight. The dark rim is white at 0.055 and the dark shadow is 0.13 of a warm near black,
   * so once the content behind them has washed out there is nothing left of either to see, and
   * the three finished directions are entitled to render exactly as they already have. The light
   * rim is a solid 192 luma line and the light contact pass is 0.34: on a receded light object
   * they are most of its remaining visual weight, and left at full strength they draw a crisp
   * empty outlined box sitting on top of the statement. That is the second plane RECEDE exists to
   * delete, arriving through the back door. An object that has gone has taken its edge with it.
   */
  veil = 0,
): { shadow: string; rim: string; rimWidth: number } => {
  if (theme === "dark") {
    return { ...elevation(rotX, rotY), rimWidth: 1 };
  }
  const here = Math.max(0, 1 - veil);
  const dx = 37 * Math.sin(rotY * RAD);
  const dy = -37 * Math.sin(rotX * RAD);
  const tilt = Math.min(1, (Math.abs(rotX) + Math.abs(rotY)) / 34);
  return {
    shadow: [
      // The line of contact. 6px of blur and 0.34 of the ground's own warm near black puts a
      // trough of about 176 luma within three pixels of an edge that is otherwise 224 against
      // 224. It is the only high frequency term in the shadow and it is the whole reason a pale
      // object on pale paper has a boundary at all.
      `${(dx * 0.3).toFixed(1)}px ${(dy * 0.3 + 3).toFixed(1)}px 6px -1px rgba(41,34,18,${(0.34 * here).toFixed(3)})`,
      `${dx.toFixed(1)}px ${(dy + 6).toFixed(1)}px ${(34 * (1 + 0.2 * tilt)).toFixed(0)}px rgba(41,34,18,${(0.17 * here).toFixed(3)})`,
      `${(dx * 1.6).toFixed(1)}px ${(dy * 1.6 + 22).toFixed(1)}px ${(104 * (1 + 0.2 * tilt)).toFixed(0)}px -18px rgba(41,34,18,${(0.24 * here).toFixed(3)})`,
    ].join(", "),
    // lightColors.border, the hairline the app draws round its own surfaces on paper. Luma 192
    // against a ground of 224.
    //
    // 1.5px RATHER THAN THE APP'S OWN 1, and the half pixel is measured rather than cautious. A
    // plane in this film is rotated and scaled inside a 1400px perspective, so a 1px inset lands
    // on a fraction of a device pixel and antialiases away: measured on the first light render,
    // the outermost pixel of the card's right edge came back at 223 against an interior of 235,
    // which is about a third of the hairline surviving. At 1.5 the line is fully present at every
    // pose the film uses, and it is still a hairline rather than a stroke.
    rim: `rgba(201,207,187,${here.toFixed(3)})`,
    rimWidth: 1.5,
  };
};

/**
 * The key light on the face.
 *
 * DARK screens the studio's specular across near black glass, which is ./ground's `sheen` and is
 * the thing that separates a device in a studio from a rectangle with a picture on it.
 *
 * LIGHT multiplies the same band travelling the same way at the same rotY, because a face already
 * at the white ceiling cannot be made brighter and a pale object reads as lit by DARKENING away
 * from the key. Same light, same geometry, opposite sign. About 26 luma of gradient across the
 * face, which is what stops the object from being a flat sheet of paper on a flat sheet of paper.
 */
export const faceLight = (
  rotY: number,
  gloss: number,
  theme: AppTheme,
): { image: string; blend: "screen" | "multiply" } => {
  if (theme === "dark") {
    return { image: sheen(rotY, gloss), blend: "screen" };
  }
  const at = 50 - rotY * 2.4;
  // A floor plus a gloss term. The floor is there because the shading is doing structural work
  // here rather than decorative work, and the matte chips are the ones that need it most.
  const a = (0.06 + 0.1 * gloss).toFixed(3);
  const stop = (value: number): string => String(Math.round(value));
  return {
    image: `linear-gradient(${String(102 - rotY)}deg, rgba(41,34,18,${a}) 0%, rgba(41,34,18,0) ${stop(at)}%, rgba(41,34,18,${a}) 100%)`,
    blend: "multiply",
  };
};
