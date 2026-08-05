import { createContext, forwardRef, useCallback, useContext, useRef } from "react";
import type { PropsWithChildren, RefObject } from "react";
import { ScrollView, type ScrollViewProps, type View } from "react-native";

/**
 * A ScrollView that actually brings the focused field into view.
 *
 * `automaticallyAdjustKeyboardInsets` only insets the content so the field is
 * *reachable* behind the keyboard — it never scrolls to it, so a field near the bottom
 * takes focus, the keyboard covers it, and the user is left typing blind into a box
 * they have to go find. That is the whole bug; the inset alone does not fix it.
 *
 * So the scroll is explicit: the container publishes its own ref, and any TextField
 * rendered inside it asks to be scrolled into view when it takes focus. Pure JS — no
 * native module, so it works in Expo Go, which matters because that is where this app
 * is being reviewed today.
 */
const ScrollRefContext = createContext<RefObject<ScrollView | null> | null>(null);

/** Distance kept above the focused field, so it never sits flush against the top edge. */
const FOCUS_MARGIN = 28;

/**
 * Returns a function a focused input calls with its own native node. No-op outside a
 * KeyboardAwareScrollView, so TextField stays usable anywhere.
 */
export function useScrollIntoView() {
  const scrollRef = useContext(ScrollRefContext);

  return useCallback(
    (node: View | null) => {
      const scroll = scrollRef?.current;
      if (!scroll || !node) return;
      // measureLayout resolves against the scroll view's INNER content view, so `y` is
      // already a content offset — no need to compensate for the current scroll position.
      const inner = scroll.getInnerViewNode?.();
      if (!inner) return;
      node.measureLayout(
        inner,
        (_x, y) => scroll.scrollTo({ y: Math.max(y - FOCUS_MARGIN, 0), animated: true }),
        () => {
          // Measurement can fail if the view unmounted mid-focus. Nothing to do.
        },
      );
    },
    [scrollRef],
  );
}

export const KeyboardAwareScrollView = forwardRef<ScrollView, PropsWithChildren<ScrollViewProps>>(
  function KeyboardAwareScrollView({ children, ...props }, _forwardedRef) {
    const scrollRef = useRef<ScrollView | null>(null);

    return (
      <ScrollRefContext.Provider value={scrollRef}>
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          // Still worth setting: it stops the content ENDING behind the keyboard, so the
          // last field can be scrolled to at all. The explicit scroll above does the rest.
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="interactive"
          {...props}
        >
          {children}
        </ScrollView>
      </ScrollRefContext.Provider>
    );
  },
);
