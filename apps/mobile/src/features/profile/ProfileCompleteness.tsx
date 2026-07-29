import { Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

export interface CompletenessItem {
  label: string;
  done: boolean;
}

export function ProfileCompleteness({ items }: { items: CompletenessItem[] }) {
  const { colors, spacing, radius } = useTheme();
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const missing = items.filter((i) => !i.done).map((i) => i.label);

  if (doneCount === items.length) return null;

  return (
    <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700" }}>PROFILE STRENGTH</Text>
        <Text style={{ color: colors.brand, fontSize: 12, fontWeight: "700" }}>{pct}%</Text>
      </View>
      <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: colors.surface, overflow: "hidden" }}>
        <Animated.View
          entering={FadeIn.duration(300)}
          style={{ width: `${pct}%`, height: "100%", backgroundColor: colors.brand, borderRadius: radius.pill }}
        />
      </View>
      {missing.length > 0 && (
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>Add {missing.join(", ")} to finish your profile.</Text>
      )}
    </View>
  );
}
