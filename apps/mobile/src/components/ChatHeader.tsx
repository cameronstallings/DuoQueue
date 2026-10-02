import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/useTheme";

import { goBack } from "./ScreenContainer";

/**
 * The chat screens' top bar, drawn here like every other screen's (ScreenContainer) instead of
 * by the native header.
 *
 * The two chats were the only screens on the native header, and on iOS 26 it broke under
 * react-native-screens 4.16.0 (Expo SDK 54's pin). The back button drew as an empty glass
 * circle and stopped responding after the second push above a `headerShown: false` screen
 * (software-mansion/react-native-screens#3294), which is exactly where a chat sits. The options
 * button also stretched into a wide glass pill. A tester on iOS 26 could not leave a chat except
 * by swiping. Owning the bar takes the native header out of it on every iOS version.
 */
export function ChatHeader({
  title,
  onOptions,
  optionsLabel,
}: {
  /** The middle of the bar. It is given the remaining width, so keep it to one line. */
  title: ReactNode;
  onOptions: () => void;
  optionsLabel: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const roundButton = {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.round,
  } as const;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.surfaceSolid,
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} hitSlop={8} style={roundButton}>
        <Ionicons name="chevron-back" size={19} color={colors.text} />
      </Pressable>

      <View style={{ flex: 1 }}>{title}</View>

      <Pressable accessibilityRole="button" accessibilityLabel={optionsLabel} onPress={onOptions} hitSlop={8} style={roundButton}>
        {/* includeFontPadding/lineHeight neutralize the icon font's own vertical padding:
            ellipsis-horizontal's glyph box isn't symmetric, so flex centering alone leaves it
            visibly off-centre in a tight circle. */}
        <Ionicons
          name="ellipsis-horizontal"
          size={18}
          color={colors.voltDim}
          style={{ textAlign: "center", lineHeight: 18, includeFontPadding: false }}
        />
      </Pressable>
    </View>
  );
}
