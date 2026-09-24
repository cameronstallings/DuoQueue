import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

import { POWER_UP_COPY, powerUpButtonLabel, powerUpTitle } from "./paywallCopy";

/** The Power-Up: a separate one-time purchase, said so in words, with its own busy state. */
export function PowerUpRow({ left, price, busy, onBuy }: { left: number; price: string | null; busy: boolean; onBuy: () => void }) {
  const { colors, radius, spacing, type } = useTheme();
  const disabled = !price || busy;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Ionicons name="rocket" size={24} color={colors.volt} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>{powerUpTitle(left)}</Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>{POWER_UP_COPY.description}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={powerUpButtonLabel(price)}
        accessibilityState={{ disabled, busy }}
        disabled={disabled}
        onPress={onBuy}
        hitSlop={8}
        style={({ pressed }) => ({
          borderWidth: 1.5,
          borderColor: colors.amber,
          borderRadius: radius.button,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        <Text style={[type.bodyStrong, { color: colors.amber }]}>{busy ? "Confirming" : (price ?? "Not available")}</Text>
      </Pressable>
    </View>
  );
}
