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

export function ChipSelect<T extends string>({ options, selected, onToggle }: ChipSelectProps<T>) {
  const { colors, radius, spacing } = useTheme();

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
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: isSelected ? colors.brand : colors.border,
              backgroundColor: isSelected ? colors.brand : colors.surface,
            }}
          >
            <Text style={{ color: isSelected ? "#FFFFFF" : colors.text, fontWeight: "600" }}>
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
