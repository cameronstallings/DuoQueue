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
                <Text style={[type.bodyStrong, { color: colors.text, flex: 1 }]}>{prompt.question}</Text>
                <Pressable onPress={() => clearPromptAt(index)}>
                  <Text style={[type.caption, { color: colors.brandInk }]}>Change</Text>
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
              <Text style={[type.caption, { color: colors.textMuted, textAlign: "right" }]}>
                {prompt.answer.length}/{PROMPT_ANSWER_MAX_LENGTH}
              </Text>
            </>
          ) : (
            <Pressable onPress={() => setPickerIndex(index)} style={{ alignItems: "center", paddingVertical: spacing.sm }}>
              <Text style={[type.bodyStrong, { color: colors.brandInk }]}>+ Select a prompt</Text>
            </Pressable>
          )}
        </Card>
      ))}

      <Modal visible={pickerIndex !== null} animationType="slide" onRequestClose={() => setPickerIndex(null)}>
        <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: spacing.lg }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <Text style={{ ...type.title, color: colors.text }}>Select a prompt</Text>
            <Pressable onPress={() => setPickerIndex(null)}>
              <Text style={[type.caption, { color: colors.brandInk }]}>Cancel</Text>
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
                      if (pickerIndex !== null)
                        setPromptAt(pickerIndex, { promptId: item.id, question: item.question });
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
