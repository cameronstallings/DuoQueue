import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { hapticSelection } from "@/lib/haptics";
import { type ThemePreference, useThemeStore } from "@/store/theme-store";
import { useTheme } from "@/theme/useTheme";

/**
 * Each option carries a line explaining it, which is the whole reason this moved
 * out of a row of chips: a chip has room for a word, not an answer. Dark is listed
 * first — it's the default now, not a fallback to System.
 */
const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: "dark", label: "Dark", hint: "Always dark, whatever your phone is set to." },
  { value: "light", label: "Light", hint: "Always light, whatever your phone is set to." },
  {
    value: "system",
    label: "System",
    hint: "Follows your phone's light/dark setting, including any schedule you've set.",
  },
];

export default function AppearanceSettings() {
  const { colors, spacing, type, radius, hairline } = useTheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <ScreenContainer title="Appearance" showBack>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {OPTIONS.map((option, i) => {
          const selected = preference === option.value;
          return (
            <View key={option.value}>
              {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginLeft: spacing.md }} />}
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  hapticSelection();
                  setPreference(option.value);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing.md,
                  padding: spacing.md,
                  backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                })}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: radius.chip,
                    borderWidth: hairline,
                    borderColor: selected ? colors.voltDim : colors.border,
                    backgroundColor: selected ? colors.volt : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                  }}
                >
                  {selected && <Ionicons name="checkmark" size={14} color={colors.onFill} />}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.bodyStrong, { color: colors.text }]}>{option.label}</Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>{option.hint}</Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </Card>
    </ScreenContainer>
  );
}
