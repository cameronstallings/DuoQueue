/**
 * Drag-to-dismiss for the shared bottom sheet (`Sheet.tsx`): where the panel sits while a finger
 * pulls it, whether letting go closes it, how long it takes to leave, and how the scrim lightens
 * on the way. Pure, so every number is tested in node (sheetDrag.test.ts); every function is a
 * worklet because the sheet's pan gesture calls them on the UI thread.
 *
 * WHY. Build 19 testing (15 Oct): Queue Up and Highlights could only be closed by tapping the dim
 * area above them, while every screen presented as a native modal (Filters, Online now, the
 * paywall, a profile) swipes down. A sheet that looks like an iOS sheet has to behave like one.
 *
 * THE RELEASE. Past a quarter of the panel's own height it closes, so a short menu needs a short
 * pull and a tall form a longer one. A downward flick faster than 800pt/s (the deck's flick,
 * swipeRelease.ts) closes it from any distance; a panel thrown back up that hard stays, however
 * far it had gone, so changing your mind mid-drag works. A release that does neither springs
 * back.
 *
 * THE PULL UPWARD. The panel follows the finger one to one downward. Upward it rubber-bands on
 * UIScrollView's curve (coefficient 0.55): it starts at a little over half the finger's travel
 * and stiffens, and never lifts more than RUBBER_LIMIT, which the sheet's skirt (a strip of the
 * panel's own surface below its bottom edge) always covers, so no scrim ever shows under it.
 *
 * The numbers are first guesses to confirm on his iPhone, like the deck's (plan Q19).
 */

/** A release past this fraction of the panel's height closes the sheet. */
export const DISMISS_FRACTION = 0.25;
/** A downward release faster than this (pt/s) closes it from any distance; an upward one this fast
 * keeps it open. */
export const DISMISS_FLING_VELOCITY = 800;
/** The furthest the panel ever lifts above its resting place, however far the finger goes. */
export const RUBBER_LIMIT = 64;
/** UIScrollView's rubber-band coefficient: the slope of the pull at its start. */
const RUBBER_COEFFICIENT = 0.55;
/** The quickest and slowest a released panel takes to leave the screen. */
export const CLOSE_MIN_MS = 140;
export const CLOSE_MAX_MS = 280;
/** The pan starts only once the finger has gone this far DOWN, so a tap on a row stays a tap and
 * an upward scroll is never taken. */
export const DRAG_ACTIVATION = 10;
/** A finger that goes this far sideways first is scrolling a row (the Highlights faces), not
 * pulling the sheet: the pan gives up. */
export const DRAG_SIDEWAYS_FAIL = 20;

/**
 * True when letting go closes the sheet. `translationY` is the finger's travel since the drag
 * started (pt, positive down), `velocityY` its speed at release (pt/s, positive down),
 * `panelHeight` the panel's measured height (0 until its first layout).
 */
export function shouldDismiss(translationY: number, velocityY: number, panelHeight: number): boolean {
  "worklet";
  if (!Number.isFinite(translationY) || !Number.isFinite(velocityY)) return false;
  if (velocityY < -DISMISS_FLING_VELOCITY) return false;
  if (velocityY > DISMISS_FLING_VELOCITY && translationY > 0) return true;
  if (!(panelHeight > 0)) return false;
  return translationY > panelHeight * DISMISS_FRACTION;
}

/** Where the panel sits for a finger `translationY` from where the drag started: the finger
 * itself downward, a rubber band capped at RUBBER_LIMIT upward. */
export function sheetDragOffset(translationY: number): number {
  "worklet";
  if (!Number.isFinite(translationY)) return 0;
  if (translationY >= 0) return translationY;
  const pull = -translationY;
  return -RUBBER_LIMIT * (1 - 1 / ((pull * RUBBER_COEFFICIENT) / RUBBER_LIMIT + 1));
}

/**
 * How long a released panel takes to go the `remaining` points to fully off screen at
 * `velocityY` pt/s. The close runs on Easing.out(quad), which starts at twice its average speed,
 * so 2000 x remaining / speed leaves at exactly the speed the finger let go at (as the deck's
 * cards do); clamped to CLOSE_MIN_MS..CLOSE_MAX_MS, the slowest when there is no downward speed.
 */
export function closeDuration(remaining: number, velocityY: number): number {
  "worklet";
  if (!(remaining > 0)) return CLOSE_MIN_MS;
  if (!(velocityY > 0)) return CLOSE_MAX_MS;
  const ms = (2000 * remaining) / velocityY;
  return Math.round(Math.min(CLOSE_MAX_MS, Math.max(CLOSE_MIN_MS, ms)));
}

/** The scrim's opacity (times its usual dim) with the panel `offset` points below its resting
 * place: full at rest and while lifted, clear once the panel is all the way down, so the screen
 * behind lightens as the sheet goes, as an iOS sheet's does. Full until the panel is measured. */
export function scrimOpacity(offset: number, panelHeight: number): number {
  "worklet";
  if (!(panelHeight > 0) || !Number.isFinite(offset)) return 1;
  return 1 - Math.min(Math.max(offset / panelHeight, 0), 1);
}
