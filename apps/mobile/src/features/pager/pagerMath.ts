/**
 * The pure half of the swipe pager the paywall and the tour share (usePager.ts, Pager.tsx,
 * PagerDots.tsx). Relative imports only, so vitest runs it in node. The "worklet" directives let
 * the dots and the tour's foot call dotLight and footFade on the UI thread; in node they are
 * plain strings.
 */

/** The one-time peek: how far the pager slides to show the next page's edge, when, and for how long. */
export const PEEK_OFFSET = 32;
export const PEEK_DELAY_MS = 1400;
export const PEEK_HOLD_MS = 450;

/** One dot spec for both pagers (check.md #9): 7pt dots, 8pt apart, whose fill follows the finger. */
export const DOT_SIZE = 7;
export const DOT_GAP = 8;

export function clampPage(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(index)));
}

/** The page nearest a horizontal offset, clamped past the ends. */
export function pageAtOffset(x: number, width: number, count: number): number {
  if (width <= 0) return 0;
  return clampPage(x / width, count);
}

/** How lit dot `index` is at offset `x`: 1 on its own page, 0 a page away, linear between. */
export function dotLight(x: number, index: number, width: number): number {
  "worklet";
  if (width <= 0) return index === 0 ? 1 : 0;
  return Math.max(0, 1 - Math.abs(x / width - index));
}

/**
 * The tour's foot. Skip fades out over the first half of the last turn and Start swiping fades
 * in over the second half, so the two are never both half visible (found by rendering the
 * mid-swipe frame, design-tour.md).
 */
export function footFade(x: number, lastIndex: number, width: number): { skip: number; start: number } {
  "worklet";
  if (lastIndex <= 0) return { skip: 0, start: 1 };
  if (width <= 0) return { skip: 1, start: 0 };
  const lastX = lastIndex * width;
  const half = width / 2;
  const skip = Math.max(0, Math.min(1, (lastX - half - x) / half));
  const start = Math.max(0, Math.min(1, (x - (lastX - half)) / half));
  return { skip, start };
}

export interface PeekInputs {
  count: number;
  /** Page one has its content (a peek at an empty page teaches nothing). */
  ready: boolean;
  peeked: boolean;
  touched: boolean;
  reduceMotion: boolean;
  screenReader: boolean;
}

/**
 * Once, only with a next page to show, only once page one has content, and never under Reduce
 * Motion, under a screen reader (the dots say "Page 1 of 3" instead, and a pager that moves by
 * itself mid-sentence is an interruption), or once the user has moved the pager themselves.
 */
export function shouldPeek(i: PeekInputs): boolean {
  return i.count > 1 && i.ready && !i.peeked && !i.touched && !i.reduceMotion && !i.screenReader;
}

/** The dot row's accessibilityValue: VoiceOver reads "Page, 1 of 3". */
export function pagerA11yValue(index: number, count: number): { min: number; max: number; now: number; text: string } {
  const max = Math.max(count, 1);
  const now = clampPage(index, count) + 1;
  return { min: 1, max, now, text: `${now} of ${max}` };
}

/** VoiceOver's swipe up or down on the dots: one page per action, clamped at the ends. */
export function adjustedPage(action: string, index: number, count: number): number {
  if (action === "increment") return clampPage(index + 1, count);
  if (action === "decrement") return clampPage(index - 1, count);
  return clampPage(index, count);
}
