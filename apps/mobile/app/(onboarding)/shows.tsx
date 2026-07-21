import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { CatalogPicker } from "@/features/onboarding/CatalogPicker";
import { nextStepPath } from "@/features/onboarding/steps";
import { WizardStep } from "@/features/onboarding/WizardStep";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function ShowsStep() {
  const { colors, radius, spacing } = useTheme();
  const session = useSessionStore((s) => s.session);
  const { shows, addShow, removeShow } = useOnboardingStore();
  const [error, setError] = useState<string | null>(null);

  function handleContinue() {
    setError(null);
    router.push(nextStepPath("shows"));
  }

  if (!session) return null;

  return (
    <WizardStep
      step="shows"
      title="Favorite shows, movies, or anime?"
      subtitle="Optional, but it's a great icebreaker."
      onContinue={handleContinue}
      error={error}
      continueLabel={shows.length === 0 ? "Skip" : "Continue"}
    >
      <CatalogPicker
        table="shows"
        placeholder="Search shows, movies, anime"
        profileId={session.user.id}
        selectedIds={shows.map((s) => s.showId)}
        onSelect={(item) => addShow({ showId: item.id, name: item.name })}
      />

      <View style={[{ flexDirection: "row", flexWrap: "wrap" }, { gap: spacing.sm }]}>
        {shows.map((show) => (
          <Pressable
            key={show.showId}
            onPress={() => removeShow(show.showId)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: colors.brand,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>{show.name}</Text>
            <Text style={{ color: "#fff", fontWeight: "700" }}>×</Text>
          </Pressable>
        ))}
      </View>
    </WizardStep>
  );
}
