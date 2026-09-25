import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  type HostInstance,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from "react-native";
import Animated, {
  type AnimatedRef,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

import {
  PEEK_DELAY_MS,
  PEEK_HOLD_MS,
  PEEK_OFFSET,
  adjustedPage,
  clampPage,
  pageAtOffset,
  settledPage,
  shouldPeek,
} from "./pagerMath";
import { useReduceMotionLive, useScreenReader } from "./useAccessibilityFlags";

/**
 * How long after a turn VoiceOver is moved to the new page's title: long enough for the page's
 * hidden-from-VoiceOver flag to have reached the native side (PagerPage), short enough to land
 * before VoiceOver settles on whatever it picks by itself.
 */
const FOCUS_DELAY_MS = 120;

export interface PagerController {
  count: number;
  width: number;
  /** The page the pager has settled on: a swipe's end, the dots, the chevron. */
  page: number;
  /** The live horizontal offset on the UI thread. The dots and the tour's foot follow it. */
  scrollX: SharedValue<number>;
  ref: AnimatedRef<Animated.ScrollView>;
  /** `focus`: move VoiceOver to the new page's title once it is there (the paywall's chevron,
   * which is gone on page one, so VoiceOver would otherwise be left on nothing). */
  goTo: (index: number, options?: { focus?: boolean }) => void;
  /** VoiceOver's increment/decrement on the dots. Focus stays on the dots; their value names
   * the new page (pagerA11yValue). */
  adjust: (action: string) => void;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  onScrollBeginDrag: () => void;
  onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Where each page's title registers (PagerPage passes it to PageHeading / TourHeading). */
  registerHeading: (index: number, node: HostInstance | null) => void;
}

/**
 * One swipe pager's state, shared by the paywall and the tour. Previously's pattern
 * (previously/app/paywall.tsx, tour.tsx) on a Reanimated scroll offset instead of RN Animated.
 */
export function usePager(count: number, options: { peekReady: boolean }): PagerController {
  const { width } = useWindowDimensions();
  const ref = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [page, setPage] = useState(0);
  const reduceMotion = useReduceMotionLive();
  const screenReader = useScreenReader();
  // Refs, not state: the peek's timers read them, and neither should re-render the screen.
  const touched = useRef(false);
  const peeked = useRef(false);
  const headings = useRef(new Map<number, HostInstance>());
  const focusOnArrival = useRef<number | null>(null);

  const goTo = useCallback(
    (index: number, goToOptions?: { focus?: boolean }) => {
      // Any turn the user makes (chevron, dots) counts as touching the pager, so the peek can
      // never slide it out from under them.
      touched.current = true;
      const next = clampPage(index, count);
      focusOnArrival.current = goToOptions?.focus ? next : null;
      // A slide, or a cut under Reduce Motion. The user's own swipe is never affected.
      ref.current?.scrollTo({ x: next * width, y: 0, animated: !reduceMotion });
      if (reduceMotion) scrollX.value = next * width;
      setPage(next);
    },
    [count, width, reduceMotion, ref, scrollX],
  );

  const adjust = useCallback((action: string) => goTo(adjustedPage(action, page, count)), [goTo, page, count]);

  const registerHeading = useCallback((index: number, node: HostInstance | null) => {
    if (node) headings.current.set(index, node);
    else headings.current.delete(index);
  }, []);

  // After a turn that asked for it, VoiceOver goes to the new page's title, which then reads
  // itself ("Choose your plan., heading"). The page was hidden from VoiceOver until `page`
  // changed, so this waits for that render, and a moment more for the native side.
  useEffect(() => {
    if (focusOnArrival.current !== page) return;
    focusOnArrival.current = null;
    const timer = setTimeout(() => {
      const title = headings.current.get(page);
      if (title) AccessibilityInfo.sendAccessibilityEvent(title, "focus");
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [page]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onScrollBeginDrag = useCallback(() => {
    touched.current = true;
  }, []);

  // A drag released exactly on a page with no speed left never decelerates, so no momentum end
  // follows it (pagerMath settledPage). Between pages this is null and the momentum end decides.
  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const settled = settledPage(event.nativeEvent.contentOffset.x, width, count);
      if (settled !== null) setPage(settled);
    },
    [width, count],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => setPage(pageAtOffset(event.nativeEvent.contentOffset.x, width, count)),
    [width, count],
  );

  const { peekReady } = options;
  useEffect(() => {
    if (
      !shouldPeek({
        count,
        ready: peekReady,
        peeked: peeked.current,
        touched: touched.current,
        reduceMotion,
        screenReader,
      })
    ) {
      return;
    }
    // Reads the pager's node when it is called, not when the effect ran: the cleanup below must
    // reach the ScrollView that is on screen at that moment (a no-op once it has unmounted).
    const scrollPagerTo = (x: number, animated: boolean) => ref.current?.scrollTo({ x, y: 0, animated });
    let out = false;
    let back: ReturnType<typeof setTimeout> | undefined;
    const start = setTimeout(() => {
      if (touched.current) return;
      // Marked when it actually runs, so an effect torn down before its timer (Strict Mode's
      // double run) does not use up the one peek.
      peeked.current = true;
      out = true;
      scrollPagerTo(PEEK_OFFSET, true);
      back = setTimeout(() => {
        out = false;
        if (!touched.current) scrollPagerTo(0, true);
      }, PEEK_HOLD_MS);
    }, PEEK_DELAY_MS);
    return () => {
      clearTimeout(start);
      if (back) clearTimeout(back);
      // Torn down mid-peek (Reduce Motion switched on, the screen closing): never leave the
      // pager parked 32pt off a page.
      if (out && !touched.current) scrollPagerTo(0, false);
    };
  }, [count, peekReady, reduceMotion, screenReader, ref]);

  return {
    count,
    width,
    page: clampPage(page, count),
    scrollX,
    ref,
    goTo,
    adjust,
    scrollHandler,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    registerHeading,
  };
}
