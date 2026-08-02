import type { PropsWithChildren } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/useTheme";

interface SheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Forms that carry user input should pass `dismissable={false}` so a mis-tap
   *  on the scrim can't destroy it — hardware back still closes it either way. */
  dismissable?: boolean;
}

/** The one shared bottom-sheet chrome — scrim, grab handle, optional title. */
export function Sheet({ visible, onClose, title, children, dismissable = true }: SheetProps) {
  const { colors, radius, spacing, type, scrimRgb } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: `rgba(${scrimRgb},0.6)` }}
        onPress={dismissable ? onClose : undefined}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: colors.surfaceSolid,
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
              backgroundColor: colors.surfaceAlt,
              marginBottom: spacing.md,
            }}
          />
          {title !== undefined && (
            <Text style={{ ...type.title, color: colors.text, marginBottom: spacing.md }}>{title}</Text>
          )}
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}
