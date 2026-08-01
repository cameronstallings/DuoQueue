import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipSelectProps<T extends string> {
  options: ChipOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}

/**
 * Chips are stickers, not pills — a 4pt corner and a hard keyline. Selection is
 * carried by the fill AND by the keyline thickening, so it survives greyscale and
 * does not depend on colour alone.
 */
export function ChipSelect<T extends string>({ options, selected, onToggle }: ChipSelectProps<T>) {
  const { colors, radius, spacing, type, scheme } = useTheme();
  const baseWidth = scheme === "light" ? 1.5 : 1;

  return (
    <View style={[styles.wrap, { gap: spacing.sm }]}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onToggle(option.value)}
            style={({ pressed }) => [
              {
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.chip,
                borderWidth: isSelected ? baseWidth + 0.5 : baseWidth,
                borderColor: colors.ink,
                backgroundColor: isSelected ? colors.brand : colors.surface,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[type.caption, { color: isSelected ? colors.onFill : colors.text }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
