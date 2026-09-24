import { CANVAS, CXA, CXB, CY, mix, NUB, R, VB_H, VB_W, VB_X, VB_Y, W } from "../../theme/logo-geometry";
import { darkColors } from "../../theme/tokens";
import { RING_TRAVEL_UNITS, RINGS_MS } from "../match/matchMoment";

/**
 * The cold-start intro's rules: the native splash shows the O and the Q apart, the JS overlay
 * (LaunchIntro.tsx) takes over on the same picture and slides them together into the lock, then
 * fades once the app is ready. Pure, relative imports only: launchTiming.test.ts runs it in node,
 * and scripts/generate-launch-splash.ts draws the native splash from these same numbers.
 */

/** The splash field and the mark's two inks exactly as the dark app draws them. iOS shows the
 * launch screen before any JS runs, so it cannot follow the theme: the intro is always dark. */
export const LAUNCH_PALETTE = {
  background: darkColors.background,
  ink: darkColors.text,
  duo: mix(darkColors.text, darkColors.background, 0.58),
} as const;

/**
 * The locked mark's width at launch, in points: DUO LOCKED's 168, moved to 502/3 (~167.3) for
 * two pixel reasons, both measured by the launch-verify check.
 *  - 3 x width is a whole, even number of pixels, so the mark's box centres on the same @3x pixel
 *    as the native splash's box on 393, 430 and 375-wide screens.
 *  - Each ring then starts ringTravel(width) = 36.99pt from its place: 110.96px at @3x, 0.04px
 *    from a whole pixel, so the first frame is not resampled half a pixel off the native one.
 */
export const LAUNCH_MARK_W = 502 / 3;

/** app.json's expo-splash-screen imageWidth (iOS): the square, in points, that iOS draws the
 * native splash image into, centred on the screen. Even, like 3 x LAUNCH_MARK_W, for the reason
 * above; wide enough to hold the rings apart with 8pt to spare each side. */
export const SPLASH_IMAGE_WIDTH = 256;

/** The PNG is drawn at the @3x size, so the @3x asset expo cuts from it is the file unchanged. */
export const SPLASH_IMAGE_PX = SPLASH_IMAGE_WIDTH * 3;

/** Mark viewBox units per point at launch. */
const UNITS_PER_PT = VB_W / LAUNCH_MARK_W;

/** The native splash image's square in the mark's own viewBox units, centred where RingsLock's
 * box is centred: the centre of the locked mark's viewBox. */
export function splashViewBox(): { x: number; y: number; size: number } {
  const size = SPLASH_IMAGE_WIDTH * UNITS_PER_PT;
  return { x: VB_X + VB_W / 2 - size / 2, y: VB_Y + VB_H / 2 - size / 2, size };
}

/** Where the rings apart (RingsLock at progress 0) reach, in viewBox units. */
export function ringsApartBounds(): { left: number; right: number; top: number; bottom: number } {
  const t = RING_TRAVEL_UNITS;
  return {
    left: CXA - t - R - W / 2,
    right: Math.max(CXB + t + R + W / 2, NUB.cx + t + NUB.r),
    top: CY - R - W / 2,
    bottom: Math.max(CY + R + W / 2, NUB.cy + NUB.r),
  };
}

/** Android keeps the old splash, the locked mark at imageWidth 180 on the 1024 canvas: Android 12
 * masks the splash icon to a 192dp circle, which would cut the rings apart off at both ends. */
export const ANDROID_SPLASH_IMAGE_WIDTH = 180;
export const ANDROID_MARK_W = ANDROID_SPLASH_IMAGE_WIDTH * (VB_W / CANVAS);

/** After the overlay takes over, the rings rest apart this long before they move. */
export const LAUNCH_BEAT_MS = 150;
/** Reduce Motion: the rings do not slide; the apart frame dissolves into the locked mark. */
export const LAUNCH_DISSOLVE_MS = 200;
/** The locked mark always stays up at least this long after the lock, so the lock is seen once. */
export const LOCKED_HOLD_MS = 250;
/** Still loading this long after the lock: the mark starts to breathe so it never looks frozen. */
export const BREATHE_AFTER_MS = 1500;
/** The lock is timed from the moment the UI thread reports it (the opening's completion callback),
 * not from the JS clock, so a UI thread held up on a busy cold start cannot fade the mark before it
 * has locked. If no report has come this long after the lock was due, it counts as locked anyway:
 * a lost callback must never keep the overlay over a ready app. */
export const LOCK_LATE_MS = 2000;
/** The old LoadingScreen's pulse: opacity to 0.35 over 700ms and back, eased. */
export const BREATH_LOW = 0.35;
export const BREATH_MS = 700;
/** The overlay's fade out, once the app is ready. */
export const LAUNCH_FADE_MS = 250;

/**
 * How the overlay gets from the native frame to the locked mark.
 *  - "slide": iOS. The rings slide together (DUO LOCKED's duration and curve) and lock.
 *  - "dissolve": iOS under Reduce Motion. The native frame cannot know the setting, so the rings
 *    apart dissolve into the locked mark instead of sliding.
 *  - "none": Android. Its native splash is already the locked mark (ANDROID_SPLASH_IMAGE_WIDTH).
 */
export type LaunchOpening = "slide" | "dissolve" | "none";

export function launchOpening(platform: string, reducedMotion: boolean): LaunchOpening {
  if (platform !== "ios") return "none";
  return reducedMotion ? "dissolve" : "slide";
}

/** The mark's width in the overlay: whatever the native splash under it was drawn at. */
export function launchMarkWidth(opening: LaunchOpening): number {
  return opening === "none" ? ANDROID_MARK_W : LAUNCH_MARK_W;
}

/**
 * The opening, in ms after it starts (when the native splash is hidden). Everything after the lock
 * (the hold before the fade, the breath) counts from the lock the UI thread reports instead:
 * LOCKED_HOLD_MS and BREATHE_AFTER_MS.
 */
export interface LaunchSchedule {
  /** When the mark should be locked: the opening's own delay and duration. */
  lockMs: number;
  /** When the intro stops waiting for the UI thread's report and counts the mark as locked. */
  lockBackstopMs: number;
}

export function launchSchedule(opening: LaunchOpening): LaunchSchedule {
  const lockMs =
    opening === "slide" ? LAUNCH_BEAT_MS + RINGS_MS : opening === "dissolve" ? LAUNCH_BEAT_MS + LAUNCH_DISSOLVE_MS : 0;
  return { lockMs, lockBackstopMs: lockMs + LOCK_LATE_MS };
}

/** How long to wait, from `now`, before the moment `atMs` after `since`. Never negative. */
export function msUntil(atMs: number, since: number, now: number): number {
  return Math.max(0, since + atMs - now);
}

/**
 * The intro runs once per JS runtime: a cold start. Returning from the background keeps the
 * runtime (and shows no native splash), so it never plays again until the app is launched anew.
 * Module state rather than component state, so a remounted root layout cannot replay it.
 */
let coldStartPending = true;

export function isColdStart(): boolean {
  return coldStartPending;
}

export function endColdStart(): void {
  coldStartPending = false;
}
