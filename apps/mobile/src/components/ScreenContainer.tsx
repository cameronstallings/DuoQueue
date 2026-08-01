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
  /**
   * Adds an X to the title row. Use on screens presented as a modal — pull-to-refresh
   * eats the swipe-down gesture iOS uses for dismissal, so without this there is no
   * way out. Also tells the container it is inside a modal, which changes the top
   * inset (see `topInset` below).
   */
  showClose?: boolean;
  /**
   * Adds a back chevron. Use on pushed screens that hide the native header — without
   * it the only way back is the OS swipe gesture, which does not exist on Android.
   */
  showBack?: boolean;
}

export function ScreenContainer({
  children,
  refreshControl,
  title,
  showClose,
  showBack,
}: ScreenContainerProps) {
  const { colors, spacing, type, radius, hairline } = useTheme();
  const insets = useSafeAreaInsets();

  /**
   * A modal sheet is already inset below the status bar by the presentation itself,
   * but useSafeAreaInsets still reports the device's full top inset — so adding it
   * pushed a second status-bar's worth of empty space above the title. That gap was
   * the "cheap" look: every modal opened with ~75pt of nothing at the top.
   */
  const topInset = showClose ? 0 : insets.top;
  const hasNavButton = showClose || showBack;

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
            gap: spacing.md,
            paddingTop: topInset + spacing.md,
            paddingBottom: spacing.sm,
            paddingHorizontal: spacing.lg,
            backgroundColor: colors.background,
          }}
        >
          {showBack && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.sm,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
                borderWidth: hairline,
                borderColor: colors.ink,
              }}
            >
              <Ionicons name="chevron-back" size={19} color={colors.text} />
            </Pressable>
          )}

          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={{ ...type.screenTitle, color: colors.text }} numberOfLines={1}>
              {title}
            </Text>
            {/* The rule under a screen title is the app's most repeated mark — it is
                what makes an otherwise plain list screen still feel authored. */}
            <View style={{ width: 32, height: 3, backgroundColor: colors.p1Line }} />
          </View>

          {showClose && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => router.back()}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.sm,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
                borderWidth: hairline,
                borderColor: colors.ink,
              }}
            >
              <Ionicons name="close" size={19} color={colors.text} />
            </Pressable>
          )}
        </View>
      )}

      {/* A titleless screen still needs a way out if it hides the native header. */}
      {title === undefined && hasNavButton && (
        <View style={{ paddingTop: topInset + spacing.md, paddingHorizontal: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showClose ? "Close" : "Go back"}
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
              borderWidth: hairline,
              borderColor: colors.ink,
            }}
          >
            <Ionicons name={showClose ? "close" : "chevron-back"} size={19} color={colors.text} />
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: title !== undefined || hasNavButton ? spacing.sm : topInset + spacing.lg,
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
      {title === undefined && !hasNavButton && topInset > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: topInset,
            backgroundColor: colors.background,
          }}
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
