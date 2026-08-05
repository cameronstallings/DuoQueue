import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PROMPT_ANSWER_MAX_LENGTH, PROMPT_COUNT } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ModalHeader } from "@/components/ModalHeader";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { TextField } from "@/components/TextField";
import { usePromptCatalog } from "@/features/onboarding/usePromptCatalog";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { type PromptSlot, useSavePrompts } from "@/features/profile/useSavePrompts";
import { useRequireSession } from "@/hooks/useRequireSession";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

export default function EditPromptsScreen() {
  useRequireSession();
  const { colors, spacing, type, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const profile = useSessionStore((s) => s.profile);
  const { data: existing, isLoading: loadingExisting } = useOwnPrompts(profile?.id);
  const { data: catalog, isLoading: loadingCatalog } = usePromptCatalog();
  const save = useSavePrompts(profile?.id);

  const [slots, setSlots] = useState<(PromptSlot | null)[] | null>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  // See the onboarding prompts screen: the answer field mounts when a prompt is picked,
  // so autoFocus lands the caret there and pulls the scroll view to it.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  // Seed local editable state once the saved prompts arrive.
  useEffect(() => {
    if (slots !== null || loadingExisting) return;
    const seeded: (PromptSlot | null)[] = Array.from({ length: PROMPT_COUNT }, () => null);
    for (const p of existing ?? []) {
      if (p.position < PROMPT_COUNT) seeded[p.position] = { promptId: p.promptId, question: p.question, answer: p.answer };
    }
    setSlots(seeded);
  }, [slots, loadingExisting, existing]);

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
      useToastStore.getState().showToast("Prompts saved");
      router.back();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* No insets.top — presented as a modal, which is already inset below the status bar. */}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <ModalHeader title="Edit Prompts" />
        {slots === null || loadingCatalog ? (
          Array.from({ length: PROMPT_COUNT }, (_, index) => (
            <Card key={index} style={{ gap: spacing.sm }}>
              <Skeleton width="60%" height={15} />
              <Skeleton width="100%" height={44} borderRadius={radius.input} />
            </Card>
          ))
        ) : (
          slots.map((slot, index) => (
            <Card key={index} style={{ gap: spacing.sm }}>
              {slot ? (
                <>
                  {/* Matches the onboarding prompts row — gap keeps a long question
                      from running straight into "Change". */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: spacing.md,
                    }}
                  >
                    <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{slot.question}</Text>
                    <Pressable onPress={() => clearAt(index)} hitSlop={8}>
                      <Text style={[type.caption, { color: colors.voltDim }]}>Change</Text>
                    </Pressable>
                  </View>
                  <TextField
                    label="Your answer"
                    value={slot.answer}
                    onChangeText={(text) => setAnswerAt(index, text)}
                    autoFocus={focusIndex === index}
                    onFocus={() => setFocusIndex(null)}
                    multiline
                    maxLength={PROMPT_ANSWER_MAX_LENGTH}
                    style={{ minHeight: 60, textAlignVertical: "top" }}
                  />
                  <Text style={[type.caption, { color: colors.textMuted, textAlign: "right" }]}>
                    {slot.answer.length}/{PROMPT_ANSWER_MAX_LENGTH}
                  </Text>
                </>
              ) : (
                <Pressable
                  onPress={() => setPickerIndex(index)}
                  style={{ alignItems: "center", paddingVertical: spacing.sm }}
                >
                  <Text style={[type.bodyStrong, { color: colors.voltDim }]}>+ Select a prompt</Text>
                </Pressable>
              )}
            </Card>
          ))
        )}

        <Button
          label={save.isPending ? "Saving..." : "Save"}
          onPress={() => void handleSave()}
          disabled={!allAnswered}
          loading={save.isPending}
        />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </ScrollView>

      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background }}
      />

      <Sheet visible={pickerIndex !== null} onClose={() => setPickerIndex(null)} title="Select a prompt">
        {loadingCatalog ? (
          <View>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  paddingVertical: spacing.md,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Skeleton width={`${70 - i * 8}%`} height={15} />
              </View>
            ))}
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: windowHeight * 0.6 }}>
            {(catalog ?? [])
              .filter((item) => !chosenIds.has(item.id))
              .map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (pickerIndex !== null) {
                      setPromptAt(pickerIndex, { promptId: item.id, question: item.question });
                      setFocusIndex(pickerIndex);
                    }
                    setPickerIndex(null);
                  }}
                  style={({ pressed }) => [
                    {
                      paddingVertical: spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.surfaceAlt : "transparent",
                    },
                  ]}
                >
                  <Text style={[type.body, { color: colors.text }]}>{item.question}</Text>
                </Pressable>
              ))}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}
