import { Image, Text, View } from "react-native";

import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useOwnPhotos } from "@/features/profile/useOwnPhotos";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

export default function ProfileScreen() {
  const { colors, radius, spacing, shadow } = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const { data: photos, isLoading } = useOwnPhotos(profile?.id);

  return (
    <ScreenContainer>
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
          <View
            style={{
              width: "100%",
              padding: spacing.lg,
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textMuted }}>No photos yet.</Text>
          </View>
        )}
      </View>

      <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text, marginTop: spacing.md }}>
        {profile?.display_name}
      </Text>
      <Text style={{ color: colors.textMuted }}>{profile?.bio}</Text>
      <Text style={{ color: colors.textMuted }}>
        Profile editing and premium (&quot;who swiped right on you&quot;) land in later phases.
      </Text>
    </ScreenContainer>
  );
}
