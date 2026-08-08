import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

export interface CompletenessItem {
  label: string;
  done: boolean;
}

/**
 * A single thin progress bar plus one hint sentence — the completeness meter used
 * to spend a whole row on a "PROFILE STRENGTH" label and a separate percentage
 * before saying anything useful. Self-hides once nothing is missing.
 */
export function ProfileCompleteness({ items }: { items: CompletenessItem[] }) {
  const { colors, spacing, radius, type } = useTheme();
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const missing = items.filter((i) => !i.done).map((i) => i.label);

  if (doneCount === items.length) return null;

  return (
    <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
      <View style={{ height: 4, borderRadius: radius.round, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.volt, borderRadius: radius.round }}
        />
      </View>
      <Text style={[type.caption, { color: colors.textMuted }]}>
        {pct}% complete. Add {missing.join(", ")} to finish your profile.
      </Text>
    </View>
  );
}
