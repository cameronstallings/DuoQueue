import { CANVAS, CXA, CXB, CY, mix, NUB, R, VB_H, VB_W, VB_X, VB_Y, W } from "../../theme/logo-geometry";
import { darkColors } from "../../theme/tokens";
import { BRACKET_FADE_MS, RING_TRAVEL_UNITS } from "../match/matchMoment";

import { springFirstReachMs } from "./springMath";

/**
 * The cold-start intro's rules: the native splash shows the O and the Q apart, the JS overlay
 * (LaunchIntro.tsx) takes over on the same picture and runs the bracket lock (the rings wind up,
 * rush together on a spring and lock, the mark pops, DUO LOCKED's brackets close around it), then
 * fades once the app is ready. Pure, relative imports only: launchTiming.test.ts runs it in node,
 * and scripts/generate-launch-splash.ts draws the native splash from these same numbers.
 */

/** The splash field, the mark's two inks exactly as the dark app draws them, and the brackets'
 * volt. iOS shows the launch screen before any JS runs, so it cannot follow the theme: the intro
 * is always dark. */
export const LAUNCH_PALETTE = {
  background: darkColors.background,
  ink: darkColors.text,
  duo: mix(darkColors.text, darkColors.background, 0.58),
  volt: darkColors.volt,
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

/**
 * The bracket lock, in RingsLock's progress (0 = apart, 1 = locked), all measured from the preview
 * Cameron approved on 24 Sept 2026 (launch-pop/bracket.mp4).
 *
 * Wind-up: the rings first pull apart by 7% of their travel over 110ms, Easing.out(Easing.quad),
 * so they come to rest there and the rush starts from a standstill.
 */
export const LAUNCH_WINDUP = -0.07;
export const LAUNCH_WINDUP_MS = 110;
/** The rush: a real spring from the wind-up to the lock. Damping ratio 0.6, so it crosses the
 * lock at speed, overshoots 10% (to 1.101: the centres 1.32R apart, inside the weave's 1.3R) and
 * settles. Full config on purpose: Reanimated 4 merges a partial one over mass 4 / stiffness 900. */
export const LAUNCH_RUSH_SPRING = { stiffness: 225, damping: 18, mass: 1 } as const;
/** The pop: the mark's scale, at rest at 1, set moving the instant the rings first reach the lock
 * with the velocity that peaks it at 1.08 (60ms later). Damping ratio 0.5. Its target is where it
 * starts, so it only runs through launchPop.ts's launchPopKick: Reanimated drops it as a bare
 * withSpring. */
export const LAUNCH_POP_SPRING = { stiffness: 400, damping: 20, mass: 1, velocity: 2.9288 } as const;
/** When the rush first reaches the lock, after it starts: ~184.5ms. The weave switches on, the mark
 * pops and the haptic fires here, detected on the UI thread; withSpring's own completion callback
 * would come ~900ms later, once the overshoot has died away. */
export const LAUNCH_RUSH_REACH_MS = springFirstReachMs(LAUNCH_RUSH_SPRING, LAUNCH_WINDUP, 1);
/** The lock, after the opening starts: the beat, the wind-up and the rush. ~444.5ms. */
export const LAUNCH_LOCK_MS = LAUNCH_BEAT_MS + LAUNCH_WINDUP_MS + LAUNCH_RUSH_REACH_MS;
/**
 * When DUO LOCKED's brackets set off, after the opening starts: timed so their spring
 * (BRACKET_SPRING, first home 132.2ms after it starts) reaches home at the lock, 150 + 110 + 184.5
 * - 132.2 = 312.3, to the whole ms. They start 40pt out (BRACKET_TRAVEL, scaled to the launch mark),
 * fade in over BRACKET_FADE_MS, overshoot 4.1pt inward 57ms after the lock and stay until the fade.
 */
export const LAUNCH_BRACKETS_AT_MS = 312;

/** Reduce Motion: no wind-up, spring, overshoot or pop. The rings apart dissolve into the locked
 * mark over this long, and the brackets fade in at home over its second half, so both finish at
 * the lock. Not over the whole of it: the rings apart reach past the brackets' home, and brackets
 * fading in from the start were drawn over the O and the Q while those were still well over half
 * there. From halfway the rings apart are at half opacity and going. */
export const LAUNCH_DISSOLVE_MS = 200;
/** The locked mark always stays up at least this long after the lock, so the fade never starts
 * mid-pop: the rings, the pop and the brackets have all settled to within half an @3x pixel 496ms
 * after the lock. */
export const LOCKED_HOLD_MS = 500;
/** Still loading this long after the lock: the mark starts to breathe so it never looks frozen. */
export const BREATHE_AFTER_MS = 1500;
/** The lock is timed from the moment the UI thread reports it, not from the JS clock, so a UI thread
 * held up on a busy cold start cannot fade the mark before it has locked. If no report has come
 * this long after the lock was due, it counts as locked anyway: a lost report must never keep the
 * overlay over a ready app, nor keep the app from mounting behind it. */
export const LOCK_LATE_MS = 2000;
/** The old LoadingScreen's pulse: opacity to 0.35 over 700ms and back, eased. */
export const BREATH_LOW = 0.35;
export const BREATH_MS = 700;
/** The overlay's fade out, once the app is ready. */
export const LAUNCH_FADE_MS = 250;

/**
 * How the overlay gets from the native frame to the locked mark.
 *  - "bracket-lock": iOS. The wind-up, the rush, the lock with its pop, weave and haptic, and the
 *    brackets closing around the mark.
 *  - "dissolve": iOS under Reduce Motion. The native frame cannot know the setting, so the rings
 *    apart dissolve into the locked mark and the brackets fade in at home; the haptic still fires.
 *  - "none": Android. Its native splash is already the locked mark (ANDROID_SPLASH_IMAGE_WIDTH), so
 *    there is no lock to see: no brackets and no haptic.
 */
export type LaunchOpening = "bracket-lock" | "dissolve" | "none";

export function launchOpening(platform: string, reducedMotion: boolean): LaunchOpening {
  if (platform !== "ios") return "none";
  return reducedMotion ? "dissolve" : "bracket-lock";
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
  /** When the mark should be locked. */
  lockMs: number;
  /** When the intro stops waiting for the UI thread's report and counts the mark as locked. */
  lockBackstopMs: number;
  /** The wind-up, the rush's overshoot and the pop. */
  springs: boolean;
  /** The brackets, or null where they are not drawn: when they set off, how long they fade in,
   * and whether they travel in (on BRACKET_SPRING) or only fade in at home. */
  brackets: { atMs: number; fadeMs: number; travel: boolean } | null;
  /** The success haptic at the lock. */
  haptic: boolean;
}

export function launchSchedule(opening: LaunchOpening): LaunchSchedule {
  if (opening === "bracket-lock") {
    return {
      lockMs: LAUNCH_LOCK_MS,
      lockBackstopMs: LAUNCH_LOCK_MS + LOCK_LATE_MS,
      springs: true,
      brackets: { atMs: LAUNCH_BRACKETS_AT_MS, fadeMs: BRACKET_FADE_MS, travel: true },
      haptic: true,
    };
  }
  if (opening === "dissolve") {
    const lockMs = LAUNCH_BEAT_MS + LAUNCH_DISSOLVE_MS;
    const half = LAUNCH_DISSOLVE_MS / 2;
    return {
      lockMs,
      lockBackstopMs: lockMs + LOCK_LATE_MS,
      springs: false,
      brackets: { atMs: LAUNCH_BEAT_MS + half, fadeMs: half, travel: false },
      haptic: true,
    };
  }
  return { lockMs: 0, lockBackstopMs: LOCK_LATE_MS, springs: false, brackets: null, haptic: false };
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
