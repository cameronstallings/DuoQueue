import { Pressable, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import type { PlanCopy } from "./pricing";

/**
 * One plan. The billed price is the largest price text (type.title, 17 ExtraBold); the per-week
 * price and the Save chip are smaller. The chosen row gets an amber edge and a filled amber radio;
 * it is a radio to VoiceOver with `checked` (build 17 fix: it used `selected`), and its label reads
 * price, period and saving. The Save chip is an outline, never an amberSoft fill (Paper contrast).
 */
export function PlanRow({ copy, selected, onSelect }: { copy: PlanCopy; selected: boolean; onSelect: () => void }) {
  const { colors, radius, spacing, type } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={copy.accessibilityLabel}
      onPress={onSelect}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.tight,
        paddingVertical: spacing.tight,
        paddingHorizontal: spacing.md,
        borderRadius: radius.card,
        borderWidth: 1.5,
        borderColor: selected ? colors.amber : colors.border,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: selected ? colors.amber : colors.textMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.amber }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.sm }}>
          <Text style={[type.bodyStrong, { color: colors.text }]}>{copy.title}</Text>
          {copy.saveChip ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.amber,
                borderRadius: radius.chip,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text style={[type.chipText, { color: colors.amber }]}>{copy.saveChip}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[type.caption, { color: colors.textMuted }]}>{copy.subLine}</Text>
      </View>
      <Text style={[type.title, { color: colors.text }]}>{copy.price}</Text>
    </Pressable>
  );
}
