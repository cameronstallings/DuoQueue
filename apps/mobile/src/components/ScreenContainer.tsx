import type { PropsWithChildren, ReactElement } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RefreshControlProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/useTheme";

interface ScreenContainerProps extends PropsWithChildren {
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Renders a fixed (non-scrolling) title row above the content. */
  title?: string;
  /** Adds an X button to the title row that pops the screen — needed on modal screens,
   * where pull-to-refresh captures the swipe-down gesture iOS uses for dismissal. */
  showClose?: boolean;
}

export function ScreenContainer({ children, refreshControl, title, showClose }: ScreenContainerProps) {
  const { colors, spacing, type } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {title !== undefined && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: insets.top + spacing.md,
            paddingBottom: spacing.sm,
            paddingHorizontal: spacing.lg,
            backgroundColor: colors.background,
          }}
        >
          <Text style={{ ...type.screenTitle, color: colors.text, flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
          {showClose && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => router.back()}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surfaceAlt,
              }}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          )}
        </View>
      )}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: title !== undefined ? spacing.sm : insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.lg,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        <View style={{ gap: spacing.md }}>{children}</View>
      </ScrollView>
      {/* Fixed, non-scrolling backdrop so content never passes directly behind the status
          bar icons with nothing behind it once the user scrolls past the initial padding. */}
      {title === undefined && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
});
