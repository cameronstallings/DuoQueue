import { useState } from "react";
import type { TextInputProps } from "react-native";
import { Text, TextInput, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

/**
 * The label is set in the uppercase-tracked `label` face rather than sentence-case
 * body text — it is a field name, not prose, and the distinction is what stops a
 * form reading as an undifferentiated column of grey.
 *
 * Focus is signalled by the glass border going accent-coloured, not by a glow —
 * glow is reserved for a short list of emphasis moments elsewhere in the system.
 */
export function TextField({ label, error, style, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const { colors, radius, spacing, type } = useTheme();
  const [focused, setFocused] = useState(false);

  const strokeColor = error ? colors.danger : focused ? colors.accent : colors.border;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[type.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          type.body,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: strokeColor,
            color: colors.text,
            borderRadius: radius.input,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
          },
          style,
        ]}
        {...inputProps}
      />
      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}
