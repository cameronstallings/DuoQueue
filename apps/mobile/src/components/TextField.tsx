import { useRef, useState } from "react";
import type { TextInputProps, View as ViewType } from "react-native";
import { Text, TextInput, View } from "react-native";

import { useTheme } from "@/theme/useTheme";

import { useScrollIntoView } from "./KeyboardAwareScrollView";

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

/**
 * The label is set in the uppercase-tracked `label` face rather than sentence-case
 * body text — it is a field name, not prose, and the distinction is what stops a
 * form reading as an undifferentiated column of grey.
 *
 * Focus is signalled by the border going volt-coloured, not by a glow — glow is
 * dead; emphasis elsewhere in the system comes from edge-bars and solid fills.
 */
export function TextField({ label, error, style, onFocus, onBlur, ...inputProps }: TextFieldProps) {
  const { colors, radius, spacing, type } = useTheme();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput | null>(null);
  const scrollIntoView = useScrollIntoView();

  const strokeColor = error ? colors.danger : focused ? colors.volt : colors.border;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[type.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        ref={inputRef}
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          // Ask the enclosing scroll container to bring this field above the keyboard.
          // No-op outside one, so this stays safe for fields rendered anywhere else.
          scrollIntoView(inputRef.current as unknown as ViewType | null);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          type.body,
          {
            backgroundColor: colors.surfaceAlt,
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
