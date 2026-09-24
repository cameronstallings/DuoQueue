import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

import type { CompletenessItem } from "./completeness";

/**
 * A single thin progress bar plus one hint sentence. Self-hides once nothing is missing.
 * The items come from completenessItems() (completeness.ts).
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
        {pct}% complete. Add {missing.join(", ")} to finish your card.
      </Text>
    </View>
  );
}
