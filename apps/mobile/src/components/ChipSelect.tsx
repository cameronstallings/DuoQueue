import { StyleSheet, View } from "react-native";

import { hapticSelection } from "@/lib/haptics";
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
 * independently. Every toggle is a selection haptic (the haptic map in lib/haptics.ts), here
 * rather than in Chip, because Chip's onPress also REMOVES chips (edit-details.tsx), and that is
 * not a selection. Every chip row in the app goes through here. */
export function ChipSelect<T extends string>({ options, selected, onToggle }: ChipSelectProps<T>) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.wrap, { gap: spacing.sm }]}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={selected.includes(option.value)}
          onPress={() => {
            hapticSelection();
            onToggle(option.value);
          }}
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
