import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { AuroraBackground } from "@/components/AuroraBackground";
import { EmptyState } from "@/components/EmptyState";
import { GrainOverlay } from "@/components/GrainOverlay";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useProfileCard } from "@/features/profile/useProfileCard";
import { ProfileDetailContent } from "@/features/swipe/ProfileDetailContent";
import { useTheme } from "@/theme/useTheme";

/** Read-only profile view reached from Matches/Chat (a modal, not a deck swipe) —
 * renders the exact same `ProfileDetailContent` the deck uses, just without the
 * like/pass buttons and fed by `useProfileCard` instead of a deck query. */
export default function ProfileScreen() {
  const { colors, radius, spacing } = useTheme();
  const { profileId } = useLocalSearchParams<{ profileId: string }>();
  const { data, isPending, isError } = useProfileCard(profileId);

  if (!isPending && !isError && data) {
    // ProfileDetailContent is already full-bleed with its own ScrollView, padding,
    // and floating close button — wrapping it in ScreenContainer would double all
    // of that (nested scroll views, doubled padding, two close buttons). Render it
    // bare instead, supplying just the backdrop ScreenContainer would have added.
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AuroraBackground />
        <GrainOverlay />
        <ProfileDetailContent card={data} onClose={() => router.back()} readOnly />
      </View>
    );
  }

  return (
    <ScreenContainer showClose>
      {isPending ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={320} borderRadius={radius.card} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Skeleton width={48} height={48} borderRadius={radius.round} />
            <Skeleton width={140} height={20} />
          </View>
          <Skeleton width="60%" height={14} />
          <Skeleton height={80} borderRadius={radius.card} />
          <Skeleton height={80} borderRadius={radius.card} />
        </View>
      ) : (
        <EmptyState
          icon="cloud-offline"
          title="Couldn't load this profile"
          subtitle="It may have been removed, or something went wrong."
        />
      )}
    </ScreenContainer>
  );
}
