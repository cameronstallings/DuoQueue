/**
 * WHICH THEME OF THE APP THIS FILM WAS SHOT IN, and the surface law that follows from it.
 *
 * Cameron recorded both themes on purpose so the two could be compared on real footage, and a
 * comparison is only worth something if ONE variable moves. So the light films are not a second
 * design: they are the same components, the same schedule, the same read and the same ground,
 * asking this context which half of the footage table to draw and which surface law an object
 * made of that footage obeys.
 *
 * =====================================================================================
 * WHY A LIGHT FRAGMENT NEEDS A LAW AT ALL, MEASURED BEFORE ANY OF IT WAS BUILT
 * =====================================================================================
 *
 * A dark fragment does not need help. Its own field is #0A0B09 and it sits on #F6F3EA, so the
 * boundary is a step of about 200 luma and the shadow underneath is decoration. Measured with
 * ffmpeg signalstats on the outer six pixel ring of each crop, against a ground of 224:
 *
 *   frag-dark-card-top    top 25   bottom 43   left 20   right 27      step 181-204
 *   frag-dark-games       top 21   bottom 16   left 11   right 19      step 203-213
 *
 * The light half of the same table is a different problem, and it is NOT uniformly pale, which
 * is the thing worth knowing before reaching for a border:
 *
 *   frag-light-card-top   top 235  bottom 49   left 254  right 226     step 2-30 on three edges
 *   frag-light-locked     top 237  bottom 241  left 241  right 241     step 13-17, all four
 *   frag-light-send       top 241  bottom 237  left 241  right 241     step 13-17, all four
 *   frag-light-games      top 21   bottom 134  left 18   right 26      step 90-206
 *   frag-light-role       top 51   bottom 62   left 75   right 73      step 149-173
 *
 * The deck card itself is a PHOTOGRAPH in both themes, so `games` and `role`, whose crops sit on
 * that photograph, keep their edge for free. What loses it is every crop whose surround is the
 * app's own light field: `lightColors.background` is #F2F4EB, which is luma 224, and the ground
 * is #F6F3EA, which is luma 224. Not close. The same. Three of the seven states in direction B
 * are a rectangle whose boundary is within 2 to 17 luma of the paper it is lying on, and that is
 * 178 of the film's 551 frames.
 *
 * =====================================================================================
 * SO A LIGHT OBJECT EARNS ITS EDGE FOUR WAYS, NONE OF THEM A STICKER
 * =====================================================================================
 *
 *   1  A CONTACT PASS IN THE SHADOW. The dark law is two soft passes, 30px and 96px of blur, and
 *      a 30px blur spends 0.13 of alpha over 30 pixels: the darkest pixel anywhere near the
 *      boundary is about 11 luma down and it decays immediately. On a dark object nobody notices,
 *      because the object is the step. On a light object that IS the step, so the light law adds
 *      a THIRD pass at 6px and 0.34, which puts a trough of about 176 within three pixels of the
 *      edge. It is the line of contact a real card on real paper has, and like the other two it
 *      is driven by the live rotation rather than parked: its offset is the same sin(rot)
 *      projection at a third of the travel, because the nearest shadow moves least.
 *
 *   2  THE RIM BECOMES THE APP'S OWN HAIRLINE. `elevation` already returns a rim and the dark
 *      films draw it as a white bevel catching the key light. White on a near-white face is
 *      nothing, so on light it is drawn in `lightColors.border`, #C9CFBB, luma 192: a 32 luma
 *      step, inset, guaranteed on every edge whatever the footage happens to contain. It is not
 *      a border somebody added to the film. It is the line the app itself draws round its own
 *      surfaces when it is on paper, at the app's own width, in the app's own ink.
 *
 *   3  THE SPECULAR TURNS INTO SHADING. `sheen` is a white band under a `screen` blend, which on
 *      a face already at the ceiling does nothing at all. A pale object reads as lit the other
 *      way round: the face DARKENS away from the key light. So light surfaces get the same band
 *      travelling the same way with the same rotY, multiplying instead of screening, which puts
 *      about 26 luma of gradient across the face. A rectangle of one flat value is paper; a
 *      rectangle with a light falling across it is an object.
 *
 *   4  THE FIELD BEHIND THE CORNERS FOLLOWS THE APP. A rounded corner reveals whatever is painted
 *      under the footage, and painting #0A0B09 under a light fragment would put a black notch on
 *      three of its corners.
 *
 * WHAT DOES NOT CHANGE: the ground, the camera, the grid, the type, the inks, the schedule, the
 * flood, the wipe, the streaks, the grain and the end card. Those are the film, not the app.
 */
import { createContext, useContext, type ReactNode } from "react";

export type AppTheme = "dark" | "light";

const Ctx = createContext<AppTheme>("dark");

/** Dark by default, so the three finished directions cannot change by having this file exist. */
export const useAppTheme = (): AppTheme => useContext(Ctx);

export const AppThemed = ({ theme, children }: { theme: AppTheme; children: ReactNode }) => (
  <Ctx.Provider value={theme}>{children}</Ctx.Provider>
);
