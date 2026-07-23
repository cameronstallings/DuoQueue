import { Image, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { useOwnPhotos } from "@/features/profile/useOwnPhotos";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function ProfileScreen() {
  const { colors, radius, spacing, shadow } = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const { data: photos, isLoading, isError } = useOwnPhotos(profile?.id);
  const { data: prompts, isLoading: promptsLoading } = useOwnPrompts(profile?.id);

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>{profile?.display_name}</Text>

      <View style={{ marginTop: spacing.sm }}>
        <SectionLabel>Photos</SectionLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {isLoading
            ? [0, 1, 2].map((i) => <Skeleton key={i} width="31%" height={120} borderRadius={radius.md} />)
            : (photos ?? []).map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  style={{
                    width: "31%",
                    aspectRatio: 1,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    ...shadow,
                  }}
                  resizeMode="cover"
                />
              ))}
          {!isLoading && (photos ?? []).length === 0 && (
            <Card style={{ width: "100%", alignItems: "center" }}>
              <Text style={{ color: colors.textMuted }}>
                {isError ? "Couldn't load your photos." : "No photos yet."}
              </Text>
            </Card>
          )}
        </View>
      </View>

      <View style={{ marginTop: spacing.md }}>
        <SectionLabel>Prompts</SectionLabel>
        {promptsLoading ? (
          <Skeleton height={80} borderRadius={radius.lg} />
        ) : (
          (prompts ?? []).map((prompt) => (
            <Card key={prompt.position} style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
              <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                {prompt.question}
              </Text>
              <Text style={{ color: colors.text }}>{prompt.answer}</Text>
            </Card>
          ))
        )}
      </View>

      <View style={{ marginTop: spacing.sm }}>
        <Card>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Prompt editing and premium (&quot;who swiped right on you&quot;) land in later phases.
          </Text>
        </Card>
      </View>
    </ScreenContainer>
  );
}
