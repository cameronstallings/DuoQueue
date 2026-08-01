import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PROMPT_ANSWER_MAX_LENGTH, PROMPT_COUNT } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { TextField } from "@/components/TextField";
import { usePromptCatalog } from "@/features/onboarding/usePromptCatalog";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { type PromptSlot, useSavePrompts } from "@/features/profile/useSavePrompts";
import { useSessionStore } from "@/store/session-store";
import { useToastStore } from "@/store/toast-store";
import { useTheme } from "@/theme/useTheme";

export default function EditPromptsScreen() {
  const { colors, spacing, type, radius, hairline } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const { data: existing, isLoading: loadingExisting } = useOwnPrompts(profile?.id);
  const { data: catalog, isLoading: loadingCatalog } = usePromptCatalog();
  const save = useSavePrompts(profile?.id);

  const [slots, setSlots] = useState<(PromptSlot | null)[] | null>(null);
  const [pickerIndex, setPickerIndex] = useState<number | null>(null);

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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ ...type.screenTitle, color: colors.text }}>Edit Prompts</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            hitSlop={8}
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
              borderWidth: hairline,
              borderColor: colors.ink,
            }}
          >
            <Ionicons name="close" size={19} color={colors.text} />
          </Pressable>
        </View>
        {slots === null || loadingCatalog ? (
          Array.from({ length: PROMPT_COUNT }, (_, index) => (
            <Card key={index} style={{ gap: spacing.sm }}>
              <Skeleton width="60%" height={15} />
              <Skeleton width="100%" height={44} borderRadius={8} />
            </Card>
          ))
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

        <Button
          label={save.isPending ? "Saving..." : "Save"}
          onPress={() => void handleSave()}
          disabled={!allAnswered}
          loading={save.isPending}
        />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </ScrollView>

      {pickerIndex === null && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background }}
        />
      )}

      {pickerIndex !== null && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.background,
            paddingTop: insets.top + spacing.lg,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            <Text style={{ ...type.title, color: colors.text }}>Select a prompt</Text>
            <Pressable onPress={() => setPickerIndex(null)}>
              <Text style={{ color: colors.brand, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </View>

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
            <ScrollView showsVerticalScrollIndicator={false}>
              {(catalog ?? [])
                .filter((item) => !chosenIds.has(item.id))
                .map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setPromptAt(pickerIndex, { promptId: item.id, question: item.question });
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
                ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
