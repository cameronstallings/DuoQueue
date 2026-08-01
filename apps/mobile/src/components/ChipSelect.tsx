import { StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import { Chip } from "./Chip";

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipSelectProps<T extends string> {
  options: ChipOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
}

/** A wrapped row of selectable Chips — one selection state per option, toggled
 * independently. */
export function ChipSelect<T extends string>({ options, selected, onToggle }: ChipSelectProps<T>) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.wrap, { gap: spacing.sm }]}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={selected.includes(option.value)}
          onPress={() => onToggle(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
