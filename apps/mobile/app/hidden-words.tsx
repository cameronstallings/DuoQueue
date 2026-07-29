import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/components/Button";
import { ScreenContainer } from "@/components/ScreenContainer";
import { TextField } from "@/components/TextField";
import {
  useAddHiddenWord,
  useHiddenWords,
  useRemoveHiddenWord,
} from "@/features/settings/useHiddenWords";
import { useTheme } from "@/theme/useTheme";

export default function HiddenWordsScreen() {
  const { colors, radius, spacing, type } = useTheme();
  const { data: words, isLoading } = useHiddenWords();
  const addWord = useAddHiddenWord();
  const removeWord = useRemoveHiddenWord();
  const [input, setInput] = useState("");

  function handleAdd() {
    if (!input.trim()) return;
    addWord.mutate(input, { onSuccess: () => setInput("") });
  }

  return (
    <ScreenContainer>
      <Text style={{ ...type.screenTitle, color: colors.text }}>Hidden Words</Text>
      <Text style={{ color: colors.textMuted, marginBottom: spacing.sm }}>
        Messages containing any of these words are hidden until you tap to reveal them.
      </Text>

      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Add a word or phrase"
            value={input}
            onChangeText={setInput}
            autoCapitalize="none"
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
        </View>
        <Button label="Add" onPress={handleAdd} loading={addWord.isPending} disabled={!input.trim()} />
      </View>

      {!isLoading && (words ?? []).length === 0 ? (
        <Text style={{ color: colors.textMuted, marginTop: spacing.sm }}>No hidden words yet.</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
          {(words ?? []).map((word) => (
            <View
              key={word}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: radius.pill,
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.text }}>{word}</Text>
              <Pressable onPress={() => removeWord.mutate(word)} hitSlop={8}>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
}
