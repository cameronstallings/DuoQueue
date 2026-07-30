import type { ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { PROMPT_COUNT, type PhotoRole } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { InfoChip } from "@/components/InfoChip";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import {
  PLATFORM_ICONS,
  PLATFORM_LABELS,
  PLAYSTYLE_LABELS,
  REGION_LABELS,
  SKILL_LABELS,
} from "@/features/onboarding/profile-labels";
import { ProfileCompleteness } from "@/features/profile/ProfileCompleteness";
import { useOwnProfileDetails } from "@/features/profile/useOwnProfileDetails";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { useUpdatePhoto } from "@/features/profile/usePhotoUpload";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

const BANNER_ASPECT = 3;
const AVATAR_SIZE = 88;

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function EditBadge({ uploading }: { uploading: boolean }) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 4,
        right: 4,
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.55)",
      }}
    >
      {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={13} color="#fff" />}
    </View>
  );
}

function DetailSection({
  label,
  icon,
  isLoading,
  isEmpty,
  emptyText,
  onEdit,
  children,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isLoading: boolean;
  isEmpty: boolean;
  emptyText: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Ionicons name={icon} size={14} color={colors.textMuted} />
          <SectionLabel>{label}</SectionLabel>
        </View>
        <Pressable onPress={onEdit}>
          <Text style={{ color: colors.brand, fontWeight: "600", fontSize: 13 }}>Edit</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <Skeleton height={36} borderRadius={radius.pill} />
      ) : isEmpty ? (
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>{emptyText}</Text>
      ) : (
        <Animated.View entering={FadeIn.duration(200)} style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {children}
        </Animated.View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, radius, spacing, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useSessionStore((s) => s.profile);
  const { data: photos, isLoading } = useOwnProfilePhotos(profile?.id);
  const { data: prompts, isLoading: promptsLoading } = useOwnPrompts(profile?.id);
  const { data: details, isLoading: detailsLoading } = useOwnProfileDetails(profile?.id);
  const updatePhoto = useUpdatePhoto(profile?.id);

  async function handlePick(role: PhotoRole) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: role === "profile" ? [1, 1] : [3, 4],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset) updatePhoto.mutate({ uri: asset.uri, role });
  }

  const detailsReady = !isLoading && !promptsLoading && !detailsLoading;
  const uploadingProfile = updatePhoto.isPending && updatePhoto.variables?.role === "profile";
  const uploadingHeader = updatePhoto.isPending && updatePhoto.variables?.role === "header";

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(scrollY.value / 80, 0), 1),
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
      >
        {isLoading ? (
          <Skeleton width="100%" height={150 + insets.top} borderRadius={0} />
        ) : (
          <Animated.View entering={FadeIn.duration(220)}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change header picture"
              onPress={() => void handlePick("header")}
              disabled={updatePhoto.isPending}
              style={{
                width: "100%",
                aspectRatio: BANNER_ASPECT,
                backgroundColor: colors.surface,
                paddingTop: insets.top,
                overflow: "hidden",
              }}
            >
              {photos?.headerUrl && (
                <>
                  <Image
                    source={{ uri: photos.headerUrl }}
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
                    pointerEvents="none"
                    style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 44 }}
                  />
                </>
              )}
              <EditBadge uploading={uploadingHeader} />
            </Pressable>
          </Animated.View>
        )}

        <View style={{ paddingHorizontal: spacing.lg }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
            onPress={() => void handlePick("profile")}
            disabled={updatePhoto.isPending}
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_SIZE / 2,
              marginTop: -AVATAR_SIZE / 2,
              borderWidth: 4,
              borderColor: colors.background,
              backgroundColor: colors.surface,
              overflow: "hidden",
              ...shadow,
            }}
          >
            {photos?.profileUrl && (
              <Image source={{ uri: photos.profileUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            )}
            <EditBadge uploading={uploadingProfile} />
          </Pressable>

          <View style={{ marginTop: spacing.sm }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>{profile?.display_name}</Text>
            {profile?.dob && (
              <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 2 }}>
                {calculateAge(profile.dob)} · {REGION_LABELS[profile.region] ?? profile.region}
              </Text>
            )}
          </View>

          {detailsReady && (
            <ProfileCompleteness
              items={[
                { label: "a profile picture", done: !!photos?.profileUrl },
                { label: "a header picture", done: !!photos?.headerUrl },
                { label: "a game", done: (details?.games.length ?? 0) > 0 },
                { label: "a show", done: (details?.shows.length ?? 0) > 0 },
                { label: "a platform", done: (details?.platforms.length ?? 0) > 0 },
                { label: "a playstyle", done: (details?.playstyles.length ?? 0) > 0 },
                { label: "your prompts", done: (prompts?.length ?? 0) >= PROMPT_COUNT },
              ]}
            />
          )}

          <View style={{ marginTop: spacing.md }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <SectionLabel>Prompts</SectionLabel>
              <Pressable onPress={() => router.push("/edit-prompts")}>
                <Text style={{ color: colors.brand, fontWeight: "600", fontSize: 13, marginBottom: spacing.xs }}>
                  Edit
                </Text>
              </Pressable>
            </View>
            {promptsLoading ? (
              <Skeleton height={80} borderRadius={radius.lg} />
            ) : (
              <Animated.View entering={FadeIn.duration(200)}>
                {(prompts ?? []).map((prompt) => (
                  <Card key={prompt.position} style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
                      {prompt.question}
                    </Text>
                    <Text style={{ color: colors.text }}>{prompt.answer}</Text>
                  </Card>
                ))}
              </Animated.View>
            )}
          </View>

          <DetailSection
            label="Games"
            icon="game-controller"
            isLoading={detailsLoading}
            isEmpty={!detailsLoading && (details?.games.length ?? 0) === 0}
            emptyText="No games added yet."
            onEdit={() => router.push("/edit-details")}
          >
            {(details?.games ?? []).map((game) => (
              <InfoChip
                key={game.name}
                label={game.name}
                sublabel={SKILL_LABELS[game.skillLevel]}
                icon="game-controller"
              />
            ))}
          </DetailSection>

          <DetailSection
            label="Shows & Movies"
            icon="tv"
            isLoading={detailsLoading}
            isEmpty={!detailsLoading && (details?.shows.length ?? 0) === 0}
            emptyText="No shows added yet."
            onEdit={() => router.push("/edit-details")}
          >
            {(details?.shows ?? []).map((show) => (
              <InfoChip key={show} label={show} icon="tv" />
            ))}
          </DetailSection>

          <DetailSection
            label="Platforms"
            icon="hardware-chip"
            isLoading={detailsLoading}
            isEmpty={!detailsLoading && (details?.platforms.length ?? 0) === 0}
            emptyText="No platforms added yet."
            onEdit={() => router.push("/edit-details")}
          >
            {(details?.platforms ?? []).map((platform) => (
              <InfoChip
                key={platform}
                label={PLATFORM_LABELS[platform]}
                icon={PLATFORM_ICONS[platform]}
                iconFamily="material-community"
              />
            ))}
          </DetailSection>

          <DetailSection
            label="Playstyle"
            icon="people"
            isLoading={detailsLoading}
            isEmpty={!detailsLoading && (details?.playstyles.length ?? 0) === 0}
            emptyText="No playstyle tags added yet."
            onEdit={() => router.push("/edit-details")}
          >
            {(details?.playstyles ?? []).map((tag) => (
              <InfoChip key={tag} label={PLAYSTYLE_LABELS[tag]} icon="people" />
            ))}
          </DetailSection>
        </View>
      </Animated.ScrollView>

      {/* Fixed, non-scrolling backdrop that fades in as the banner scrolls out of view, so
          the status bar sits on the photo at the top but on a solid backing everywhere else. */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.background },
          backdropStyle,
        ]}
      />
    </View>
  );
}
