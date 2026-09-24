import { useCallback, useEffect, useRef, useState } from "react";
import { type NativeScrollEvent, type NativeSyntheticEvent, useWindowDimensions } from "react-native";
import Animated, {
  type AnimatedRef,
  type SharedValue,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";

import { PEEK_DELAY_MS, PEEK_HOLD_MS, PEEK_OFFSET, adjustedPage, clampPage, pageAtOffset, shouldPeek } from "./pagerMath";
import { useReduceMotionLive, useScreenReader } from "./useAccessibilityFlags";

export interface PagerController {
  count: number;
  width: number;
  /** The page the pager has settled on: a swipe's end, the dots, the chevron. */
  page: number;
  /** The live horizontal offset on the UI thread. The dots and the tour's foot follow it. */
  scrollX: SharedValue<number>;
  ref: AnimatedRef<Animated.ScrollView>;
  goTo: (index: number) => void;
  /** VoiceOver's increment/decrement on the dots. */
  adjust: (action: string) => void;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  onScrollBeginDrag: () => void;
  onMomentumScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
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

  const goTo = useCallback(
    (index: number) => {
      // Any turn the user makes (chevron, dots) counts as touching the pager, so the peek can
      // never slide it out from under them.
      touched.current = true;
      const next = clampPage(index, count);
      // A slide, or a cut under Reduce Motion. The user's own swipe is never affected.
      ref.current?.scrollTo({ x: next * width, y: 0, animated: !reduceMotion });
      if (reduceMotion) scrollX.value = next * width;
      setPage(next);
    },
    [count, width, reduceMotion, ref, scrollX],
  );

  const adjust = useCallback((action: string) => goTo(adjustedPage(action, page, count)), [goTo, page, count]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onScrollBeginDrag = useCallback(() => {
    touched.current = true;
  }, []);

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
    onMomentumScrollEnd,
  };
}
