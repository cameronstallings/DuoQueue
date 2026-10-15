import { useEffect, useRef, type PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SPRINGS } from "@/theme/motion";
import { motion } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

import {
  DRAG_ACTIVATION,
  DRAG_SIDEWAYS_FAIL,
  RUBBER_LIMIT,
  closeDuration,
  scrimOpacity,
  sheetDragOffset,
  shouldDismiss,
} from "./sheetDrag";

interface SheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Forms that carry user input should pass `dismissable={false}` so a mis-tap on the scrim
   *  can't destroy it. The deliberate ways out still close it either way: hardware back, its own
   *  Cancel, and a drag down, as a native modal screen with a form (Edit details) swipes away. */
  dismissable?: boolean;
  /** iOS only (React Native's Modal fires it nowhere else): runs once the fade-out has
   *  finished. iOS drops a second modal presented while this one is still dismissing, so a
   *  sheet that hands off to another modal opens it from here. */
  onDismiss?: () => void;
}

/** The overshoot is clamped so the panel never lifts off the bottom edge: at the sheet spring's
 *  damping ratio (0.904) the bounce past rest is about a tenth of a percent of the panel's height,
 *  under a point, but it would show as a sliver of scrim below the panel. The same holds for the
 *  spring back after a drag, which starts at the release speed. */
const PANEL_SPRING = { ...SPRINGS.sheet, overshootClamping: true };

/** How long a drag close waits for the caller to hide the sheet before deciding it never will (an
 *  onClose that refuses, say while something is saving) and bringing the panel back up, so a
 *  refused close can never leave an invisible modal over the screen. Every caller today closes. */
const REFUSED_CLOSE_MS = 400;

interface SheetSurfaceProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  onScrimPress: (() => void) | undefined;
  scrimColor: string;
  panelStyle: ViewStyle;
}

/**
 * The scrim and the panel. React Native's Modal renders nothing while it is hidden (on iOS it keeps
 * its children only until the fade-out has finished), so this mounts once per presentation and
 * every open starts from fresh values.
 *
 * THE RISE. The panel is invisible until its first layout reports its own height, then rises from
 * exactly that far below its resting place on the sheet spring, so the top edge comes up from the
 * bottom of the screen whatever the content's height, and no frame draws it at rest first. Under
 * Reduce Motion the spring cuts (Reanimated's default, ReduceMotion.System) and the Modal's fade
 * stays. A later change of height is deliberately not chased: the Discord editor's keyboard spacer
 * grows the panel in step with the keyboard, and a spring lagging behind it would let the keyboard
 * cover the field.
 *
 * THE DRAG (build 21). The whole panel is the handle: a pan that starts once the finger has gone
 * 10pt down moves it with the finger on the UI thread, rubber-banding upward (sheetDrag.ts), and
 * the scrim lightens as it goes. Letting go past a quarter of its height, or on a downward flick,
 * slides it the rest of the way out at the speed it was let go at, then calls `onClose`: the same
 * close a scrim tap makes, so the Modal fades the (by then empty) scrim, iOS reports the dismissal
 * through onDismiss exactly as before, and every useSheetHandoff hand-off keeps opening its second
 * modal from there. Anything else springs back on the sheet spring. Under Reduce Motion the panel
 * still follows the finger (the user's own gesture always works), the close is a quick fade
 * instead of a slide, and the spring back cuts.
 *
 * SCROLLING INSIDE A SHEET. The drag never fights content that scrolls, because the first gesture
 * to claim a touch keeps it: iOS fails the pan when a scroll view's own pan begins first, Android
 * cancels it when a scroll view takes the touch. So a sideways row (the Highlights faces) scrolls
 * sideways and the pan gives up after 20pt sideways anyway; a vertical list (the prompt picker)
 * scrolls and bounces as before, and that sheet drags from its grab handle and title, which no
 * list ever covers. Everything else in a panel (rows, chips, buttons, fields) drags it from
 * anywhere, and a drag that starts on a row never presses it: Gesture Handler cancels the row's
 * touch the moment the pan takes over.
 */
function SheetSurface({ visible, onClose, onScrimPress, scrimColor, panelStyle, children }: SheetSurfaceProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const height = useSharedValue(0);
  const progress = useSharedValue(0);
  /** Where the finger has put the panel, in points below its resting place. */
  const drag = useSharedValue(0);
  /** The Reduce Motion close: a fade of the panel and scrim together. */
  const fade = useSharedValue(1);
  /** A drag close is under way: the finger can no longer move the panel. */
  const closing = useSharedValue(false);
  const risen = useRef(false);
  const visibleRef = useRef(visible);
  const refusedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    height.value = e.nativeEvent.layout.height;
    if (risen.current) return;
    risen.current = true;
    progress.value = withSpring(1, PANEL_SPRING);
  }

  /** Brings a drag-closed panel back to rest. */
  function restore() {
    if (!closing.value) return;
    closing.value = false;
    fade.value = withTiming(1, { duration: motion.quick, reduceMotion: ReduceMotion.Never });
    drag.value = withSpring(0, PANEL_SPRING);
  }

  function closeFromDrag() {
    onClose();
    if (refusedTimer.current) clearTimeout(refusedTimer.current);
    refusedTimer.current = setTimeout(() => {
      refusedTimer.current = null;
      if (visibleRef.current) restore();
    }, REFUSED_CLOSE_MS);
  }

  useEffect(() => {
    visibleRef.current = visible;
    // Shown again before iOS had finished fading out a drag close (it keeps this mounted until
    // then): the panel comes back up from wherever the drag left it.
    if (visible) restore();
    // restore reads only shared values and refs; it is re-created every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(
    () => () => {
      if (refusedTimer.current) clearTimeout(refusedTimer.current);
    },
    [],
  );

  const pan = Gesture.Pan()
    .activeOffsetY(DRAG_ACTIVATION)
    .failOffsetX([-DRAG_SIDEWAYS_FAIL, DRAG_SIDEWAYS_FAIL])
    .onUpdate((event) => {
      if (closing.value) return;
      drag.value = sheetDragOffset(event.translationY);
    })
    .onEnd((event, success) => {
      if (closing.value) return;
      // A cancelled pan (a scroll view took the touch, the system interrupted it) is not a
      // release: the panel springs home from wherever it is.
      if (success && shouldDismiss(event.translationY, event.velocityY, height.value)) {
        closing.value = true;
        if (reduced) {
          fade.value = withTiming(0, { duration: motion.quick, reduceMotion: ReduceMotion.Never }, (finished) => {
            if (finished) runOnJS(closeFromDrag)();
          });
          return;
        }
        const ms = closeDuration(height.value - drag.value, event.velocityY);
        drag.value = withTiming(height.value, { duration: ms, easing: Easing.out(Easing.quad) }, (finished) => {
          if (finished) runOnJS(closeFromDrag)();
        });
        return;
      }
      drag.value = withSpring(0, { ...PANEL_SPRING, velocity: event.velocityY });
    });

  const panelMotion = useAnimatedStyle(() => ({
    opacity: height.value > 0 ? fade.value : 0,
    transform: [{ translateY: (1 - progress.value) * height.value + drag.value }],
  }));

  const scrimMotion = useAnimatedStyle(() => ({
    opacity: fade.value * scrimOpacity(drag.value, height.value),
  }));

  return (
    <Pressable style={styles.scrim} onPress={onScrimPress}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }, scrimMotion]} />
      <GestureDetector gesture={pan}>
        <Animated.View onStartShouldSetResponder={() => true} onLayout={onLayout} style={[panelStyle, panelMotion]}>
          {/* The skirt: the panel's own surface below its bottom edge, so pulling it up (at most
              RUBBER_LIMIT) shows more panel, never a strip of scrim. Off screen at rest. */}
          <View
            pointerEvents="none"
            style={[styles.skirt, { height: RUBBER_LIMIT * 2, backgroundColor: colors.surfaceSolid }]}
          />
          {children}
        </Animated.View>
      </GestureDetector>
    </Pressable>
  );
}

/** The one shared bottom-sheet chrome: a scrim that fades, a panel that springs up and drags
 *  down to close, a grab handle and an optional title. */
export function Sheet({ visible, onClose, title, children, dismissable = true, onDismiss }: SheetProps) {
  const { colors, radius, spacing, type, scrimRgb } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      {/* A Modal renders outside the app's root view, so the pan needs a gesture root of its own
          (on Android nothing in here would receive a gesture without it). */}
      <GestureHandlerRootView style={styles.root}>
        <SheetSurface
          visible={visible}
          onClose={onClose}
          onScrimPress={dismissable ? onClose : undefined}
          scrimColor={`rgba(${scrimRgb},0.6)`}
          panelStyle={{
            backgroundColor: colors.surfaceSolid,
            borderTopWidth: 1,
            borderColor: colors.border,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            paddingTop: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
          }}
        >
          {/* The grab handle: the drag's affordance. */}
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: radius.round,
              backgroundColor: colors.border,
              marginBottom: spacing.md,
            }}
          />
          {title !== undefined && (
            <Text style={{ ...type.title, color: colors.text, marginBottom: spacing.md }}>{title}</Text>
          )}
          {children}
        </SheetSurface>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrim: { flex: 1, justifyContent: "flex-end" },
  skirt: { position: "absolute", left: 0, right: 0, top: "100%" },
});
