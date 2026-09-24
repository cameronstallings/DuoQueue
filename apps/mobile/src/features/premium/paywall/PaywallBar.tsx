import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { goBack } from "@/components/ScreenContainer";
import { useTheme } from "@/theme/useTheme";

const BUTTON = 34;

/**
 * The one bar over the pager. The X closes the paywall on every page from the first frame (Apple
 * rejects a delayed or hidden close); goBack also works on a cold `duoqueue://paywall` start. The
 * chevron on pages 2 and 3 turns the PAGER back, not the screen: it is the way back a VoiceOver
 * user and a hesitant thumb can see.
 */
export function PaywallBar({ page, onBack }: { page: number; onBack: () => void }) {
  const { colors, radius, spacing } = useTheme();
  const round = {
    width: BUTTON,
    height: BUTTON,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.round,
  } as const;

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
      }}
    >
      {page > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Previous page" onPress={onBack} hitSlop={8} style={round}>
          <Ionicons name="chevron-back" size={19} color={colors.text} />
        </Pressable>
      ) : (
        <View style={{ width: BUTTON, height: BUTTON }} />
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={goBack} hitSlop={8} style={round}>
        <Ionicons name="close" size={19} color={colors.text} />
      </Pressable>
    </View>
  );
}
