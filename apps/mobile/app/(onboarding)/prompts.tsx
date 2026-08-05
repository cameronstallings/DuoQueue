import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { PROMPT_ANSWER_MAX_LENGTH } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { TextField } from "@/components/TextField";
import { usePromptCatalog } from "@/features/onboarding/usePromptCatalog";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useTheme } from "@/theme/useTheme";

export default function PromptsStep() {
  const { colors, spacing, type } = useTheme();
  const { prompts, setPromptAt, setPromptAnswerAt } = useOnboardingStore();
  const { data: catalog, isLoading } = usePromptCatalog();
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);
  // The slot whose answer field should take focus. Picking a prompt swaps that card's
  // body from a button to a text field, so the field MOUNTS at that moment — autoFocus
  // catches it, and focusing an input inside a ScrollView scrolls it into view. Without
  // this the modal closed onto an unchanged-looking screen and the field you were sent
  // to type in could be below the fold entirely.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const allAnswered = prompts.every((p) => p && p.answer.trim().length > 0);
  const chosenIds = new Set(prompts.filter((p) => !!p).map((p) => p!.promptId));

  function handleContinue() {
    router.push(nextStepPath("prompts"));
  }

  return (
    <WizardStep
      step="prompts"
      title="Answer 3 prompts"
      subtitle="These show up on your card instead of a plain bio — pick ones that actually sound like you."
      onContinue={handleContinue}
      continueDisabled={!allAnswered}
    >
      {prompts.map((prompt, index) => (
        <Card key={index} style={{ gap: spacing.sm }}>
          {prompt ? (
            <>
              {/* gap, not just space-between: the question is flex:1, so a long one
                  grows until it touches "Change" and the two read as one run of text. */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: spacing.md,
                }}
              >
                <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{prompt.question}</Text>
                {/* Reopens the picker for this slot. It used to clear the slot instead,
                    which threw the answer away and dumped you back on "+ Select a
                    prompt" — and cost you the prompt even if you then cancelled. */}
                <Pressable onPress={() => setPickerIndex(index)} hitSlop={8}>
                  <Text style={[type.caption, { color: colors.voltDim }]}>Change</Text>
                </Pressable>
              </View>
              <TextField
                label="Your answer"
                value={prompt.answer}
                onChangeText={(text) => setPromptAnswerAt(index, text)}
                autoFocus={focusIndex === index}
                onFocus={() => setFocusIndex(null)}
                multiline
                maxLength={PROMPT_ANSWER_MAX_LENGTH}
                style={{ minHeight: 60, textAlignVertical: "top" }}
              />
              <Text style={[type.caption, { color: colors.textMuted, textAlign: "right" }]}>
                {prompt.answer.length}/{PROMPT_ANSWER_MAX_LENGTH}
              </Text>
            </>
          ) : (
            <Pressable onPress={() => setPickerIndex(index)} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.voltDim }]}>+ Select a prompt</Text>
            </Pressable>
          )}
        </Card>
      ))}

      <Modal visible={pickerIndex !== null} animationType="slide" onRequestClose={() => setPickerIndex(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <Text style={{ ...type.title, color: colors.text }}>Select a prompt</Text>
            <Pressable onPress={() => setPickerIndex(null)}>
              <Text style={[type.caption, { color: colors.voltDim }]}>Cancel</Text>
            </Pressable>
          </View>

          {isLoading ? (
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
            <ScrollView showsVerticalScrollIndicator={false}>
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
                    style={{
                      paddingVertical: spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <Text style={[type.body, { color: colors.text }]}>{item.question}</Text>
                  </Pressable>
                ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </WizardStep>
  );
}
