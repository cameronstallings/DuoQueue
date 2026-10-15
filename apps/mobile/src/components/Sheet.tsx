import { useRef, type PropsWithChildren } from "react";
import { Modal, Pressable, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SPRINGS } from "@/theme/motion";
import { useTheme } from "@/theme/useTheme";

interface SheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Forms that carry user input should pass `dismissable={false}` so a mis-tap
   *  on the scrim can't destroy it — hardware back still closes it either way. */
  dismissable?: boolean;
  /** iOS only (React Native's Modal fires it nowhere else): runs once the fade-out has
   *  finished. iOS drops a second modal presented while this one is still dismissing, so a
   *  sheet that hands off to another modal opens it from here. */
  onDismiss?: () => void;
}

/** The overshoot is clamped so the rising panel never lifts off the bottom edge: at the sheet
 *  spring's damping ratio (0.904) the bounce past rest is about a tenth of a percent of the
 *  panel's height, under a point, but it would show as a sliver of scrim below the panel. */
const PANEL_SPRING = { ...SPRINGS.sheet, overshootClamping: true };

/**
 * The panel. React Native's Modal renders nothing while it is hidden (on iOS it keeps its
 * children only until the fade-out has finished), so this mounts once per presentation and every
 * open starts from fresh values.
 *
 * It is invisible until its first layout reports its own height, then rises from exactly that
 * far below its resting place on the sheet spring, so the top edge comes up from the bottom of
 * the screen whatever the content's height, and no frame draws it at rest first. Under Reduce
 * Motion the spring cuts (Reanimated's default, ReduceMotion.System) and the Modal's fade stays.
 *
 * Only the opening moves. Closing is the Modal's native fade, which takes the panel with the
 * scrim, so iOS reports the dismissal through onDismiss exactly as before and every
 * useSheetHandoff hand-off (the chat menu to Schedule and Report, the party sheets) still opens
 * its second modal from there. A later change of height is deliberately not chased: the Discord
 * editor's keyboard spacer grows the panel in step with the keyboard, and a spring lagging behind
 * it would let the keyboard cover the field.
 */
function SheetPanel({ style, children }: PropsWithChildren<{ style: ViewStyle }>) {
  const height = useSharedValue(0);
  const progress = useSharedValue(0);
  const risen = useRef(false);

  function onLayout(e: LayoutChangeEvent) {
    height.value = e.nativeEvent.layout.height;
    if (risen.current) return;
    risen.current = true;
    progress.value = withSpring(1, PANEL_SPRING);
  }

  const rise = useAnimatedStyle(() => ({
    opacity: height.value > 0 ? 1 : 0,
    transform: [{ translateY: (1 - progress.value) * height.value }],
  }));

  return (
    <Animated.View onStartShouldSetResponder={() => true} onLayout={onLayout} style={[style, rise]}>
      {children}
    </Animated.View>
  );
}

/** The one shared bottom-sheet chrome: a scrim that fades, a panel that springs up, a grab
 *  handle and an optional title. */
export function Sheet({ visible, onClose, title, children, dismissable = true, onDismiss }: SheetProps) {
  const { colors, radius, spacing, type, scrimRgb } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={onDismiss}>
      <Pressable
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: `rgba(${scrimRgb},0.6)` }}
        onPress={dismissable ? onClose : undefined}
      >
        <SheetPanel
          style={{
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
        </SheetPanel>
      </Pressable>
    </Modal>
  );
}
