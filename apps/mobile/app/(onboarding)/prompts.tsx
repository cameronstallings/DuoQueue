import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { PROMPT_ANSWER_MAX_LENGTH } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { TextField } from "@/components/TextField";
import { usePromptCatalog } from "@/features/onboarding/usePromptCatalog";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useTheme } from "@/theme/useTheme";

export default function PromptsStep() {
  const { colors, spacing } = useTheme();
  const { prompts, setPromptAt, setPromptAnswerAt, clearPromptAt } = useOnboardingStore();
  const { data: catalog, isLoading } = usePromptCatalog();
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

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
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>{prompt.question}</Text>
                <Pressable onPress={() => clearPromptAt(index)}>
                  <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "600" }}>Change</Text>
                </Pressable>
              </View>
              <TextField
                label="Your answer"
                value={prompt.answer}
                onChangeText={(text) => setPromptAnswerAt(index, text)}
                multiline
                maxLength={PROMPT_ANSWER_MAX_LENGTH}
                style={{ minHeight: 60, textAlignVertical: "top" }}
              />
              <Text style={{ color: colors.textMuted, textAlign: "right", fontSize: 12 }}>
                {prompt.answer.length}/{PROMPT_ANSWER_MAX_LENGTH}
              </Text>
            </>
          ) : (
            <Pressable onPress={() => setPickerIndex(index)} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <Text style={{ color: colors.brand, fontWeight: "700" }}>+ Select a prompt</Text>
            </Pressable>
          )}
        </Card>
      ))}

      <Modal visible={pickerIndex !== null} animationType="slide" onRequestClose={() => setPickerIndex(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>Select a prompt</Text>
            <Pressable onPress={() => setPickerIndex(null)}>
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </View>

          {isLoading ? (
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
    </WizardStep>
  );
}
