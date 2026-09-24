import type { ReactNode } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import type { PagerController } from "./usePager";

/**
 * The horizontal pager the paywall and the tour share: one page per swipe (pagingEnabled plus
 * disableIntervalMomentum, so a hard fling cannot skip a page), no bounce, and every page
 * mounted so each keeps its own vertical scroll. There is no Continue button anywhere in it: the
 * swipe is the way forward (Cameron, 24 Sept 2026). Each child is a PagerPage.
 */
export function Pager({ pager, children }: { pager: PagerController; children: ReactNode }) {
  return (
    <Animated.ScrollView
      ref={pager.ref}
      horizontal
      pagingEnabled
      disableIntervalMomentum
      bounces={false}
      showsHorizontalScrollIndicator={false}
      onScroll={pager.scrollHandler}
      scrollEventThrottle={16}
      onScrollBeginDrag={pager.onScrollBeginDrag}
      onMomentumScrollEnd={pager.onMomentumScrollEnd}
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1 }}
    >
      {children}
    </Animated.ScrollView>
  );
}

/** One page: exactly the window's width, stretched to the pager's height. */
export function PagerPage({ pager, children }: { pager: PagerController; children: ReactNode }) {
  return <View style={{ width: pager.width }}>{children}</View>;
}
