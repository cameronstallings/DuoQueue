import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import { router, Stack } from "expo-router";
import { PROMPT_ANSWER_MAX_LENGTH, PROMPT_COUNT } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { usePromptCatalog } from "@/features/onboarding/usePromptCatalog";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { type PromptSlot, useSavePrompts } from "@/features/profile/useSavePrompts";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function EditPromptsScreen() {
  const { colors, spacing } = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const { data: existing, isLoading: loadingExisting } = useOwnPrompts(profile?.id);
  const { data: catalog, isLoading: loadingCatalog } = usePromptCatalog();
  const save = useSavePrompts(profile?.id);

  const [slots, setSlots] = useState<(PromptSlot | null)[] | null>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

  // Seed local editable state once the saved prompts arrive — render-time sync, guarded
  // so it only fires once (same pattern as the onboarding preferences screens).
  if (slots === null && !loadingExisting) {
    const seeded: (PromptSlot | null)[] = Array.from({ length: PROMPT_COUNT }, () => null);
    for (const p of existing ?? []) {
      if (p.position < PROMPT_COUNT) seeded[p.position] = { promptId: p.promptId, question: p.question, answer: p.answer };
    }
    setSlots(seeded);
  }

  const chosenIds = new Set((slots ?? []).filter((s) => !!s).map((s) => s!.promptId));
  const allAnswered = (slots ?? []).every((s) => s && s.answer.trim().length > 0);

  function setPromptAt(index: number, prompt: { promptId: string; question: string }) {
    setSlots((prev) => (prev ?? []).map((s, i) => (i === index ? { ...prompt, answer: "" } : s)));
  }
  function setAnswerAt(index: number, answer: string) {
    setSlots((prev) => (prev ?? []).map((s, i) => (i === index && s ? { ...s, answer } : s)));
  }
  function clearAt(index: number) {
    setSlots((prev) => (prev ?? []).map((s, i) => (i === index ? null : s)));
  }

  async function handleSave() {
    if (!slots) return;
    try {
      await save.mutateAsync(slots);
      router.back();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: true, title: "Edit Prompts" }} />
      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.md }}>
        {slots === null || loadingCatalog ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          slots.map((slot, index) => (
            <Card key={index} style={{ gap: spacing.sm }}>
              {slot ? (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{slot.question}</Text>
                    <Pressable onPress={() => clearAt(index)}>
                      <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "600" }}>Change</Text>
                    </Pressable>
                  </View>
                  <TextField
                    label="Your answer"
                    value={slot.answer}
                    onChangeText={(text) => setAnswerAt(index, text)}
                    multiline
                    maxLength={PROMPT_ANSWER_MAX_LENGTH}
                    style={{ minHeight: 60, textAlignVertical: "top" }}
                  />
                  <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 12 }}>
                    {slot.answer.length}/{PROMPT_ANSWER_MAX_LENGTH}
                  </Text>
                </>
              ) : (
                <Pressable
                  onPress={() => setPickerIndex(index)}
                  style={{ alignItems: "center", paddingVertical: spacing.sm }}
                >
                  <Text style={{ color: colors.brand, fontWeight: "700" }}>+ Select a prompt</Text>
                </Pressable>
              )}
            </Card>
          ))
        )}

        <Button label={save.isPending ? "Saving..." : "Save"} onPress={() => void handleSave()} disabled={!allAnswered} loading={save.isPending} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>

      <Modal visible={pickerIndex !== null} animationType="slide" onRequestClose={() => setPickerIndex(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.lg }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>Select a prompt</Text>
            <Pressable onPress={() => setPickerIndex(null)}>
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </View>

          {loadingCatalog ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            (catalog ?? [])
              .filter((item) => !chosenIds.has(item.id))
              .map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (pickerIndex !== null) setPromptAt(pickerIndex, { promptId: item.id, question: item.question });
                    setPickerIndex(null);
                  }}
                  style={{
                    paddingVertical: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 15 }}>{item.question}</Text>
                </Pressable>
              ))
          )}
        </View>
      </Modal>
    </View>
  );
}
