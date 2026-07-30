import type { PropsWithChildren, ReactElement } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import type { RefreshControlProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/useTheme";

interface ScreenContainerProps extends PropsWithChildren {
  refreshControl?: ReactElement<RefreshControlProps>;
}

export function ScreenContainer({ children, refreshControl }: ScreenContainerProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg, paddingHorizontal: spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        <View style={{ gap: spacing.md }}>{children}</View>
      </ScrollView>
      {/* Fixed, non-scrolling backdrop so content never passes directly behind the status
          bar icons with nothing behind it once the user scrolls past the initial padding. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
