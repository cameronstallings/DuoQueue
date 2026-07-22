import { Text } from "react-native";

import { useTheme } from "@/theme/useTheme";

/** Small uppercase, letter-spaced label for the heading above a grouped Card section —
 * reads as more deliberate/structured than a plain bold heading of the same size as body text. */
export function SectionLabel({ children }: { children: string }) {
  const { colors, spacing } = useTheme();
  return (
    <Text
      style={{
        color: colors.textMuted,
        fontSize: 12,
        fontWeight: "700",
        letterSpacing: 0.6,
        textTransform: "uppercase",
        marginBottom: spacing.xs,
        marginLeft: spacing.xs,
      }}
    >
      {children}
    </Text>
  );
}
