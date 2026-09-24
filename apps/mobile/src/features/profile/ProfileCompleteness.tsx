import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";

import { useTheme } from "@/theme/useTheme";

import type { CompletenessItem } from "./completeness";

/**
 * A single thin progress bar plus one hint sentence. Self-hides once nothing is missing.
 * The items come from completenessItems() (completeness.ts). It sits on Edit, which has no
 * prompts editor, so a missing prompts item gets a link to the screen that has one.
 */
export function ProfileCompleteness({ items }: { items: CompletenessItem[] }) {
  const { colors, spacing, radius, type } = useTheme();
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / items.length) * 100);
  const missing = items.filter((i) => !i.done).map((i) => i.label);
  const promptsMissing = items.some((i) => !i.done && i.route === "/edit-prompts");

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
      {promptsMissing ? (
        <Pressable
          onPress={() => router.push("/edit-prompts")}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Edit your prompts"
          style={{ alignSelf: "flex-start", paddingVertical: spacing.xs }}
        >
          <Text style={[type.label, { color: colors.voltDim }]}>Edit your prompts ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
