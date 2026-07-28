import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import type { PhotoRole } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { useOwnPrompts } from "@/features/profile/useOwnPrompts";
import { useUpdatePhoto } from "@/features/profile/usePhotoUpload";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

function PhotoTile({
  label,
  uri,
  width,
  aspect,
  uploading,
  onPick,
}: {
  label: string;
  uri: string | null | undefined;
  width: number | "100%";
  aspect: [number, number];
  uploading: boolean;
  onPick: () => void;
}) {
  const { colors, radius, spacing, shadow } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
        {label}
      </Text>
      <Pressable
        onPress={onPick}
        disabled={uploading}
        style={{
          width,
          aspectRatio: aspect[0] / aspect[1],
          borderRadius: radius.md,
          overflow: "hidden",
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          ...shadow,
        }}
      >
        {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" /> : null}
        <View
          style={{
            position: "absolute",
            bottom: 6,
            right: 6,
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="pencil" size={13} color="#fff" />
          )}
        </View>
        {!uri && !uploading && <Text style={{ color: colors.textMuted, fontSize: 24 }}>+</Text>}
      </Pressable>
    </View>
  );
}

export default function ProfileScreen() {
  const { colors, radius, spacing } = useTheme();
  const profile = useSessionStore((s) => s.profile);
  const { data: photos, isLoading } = useOwnProfilePhotos(profile?.id);
  const { data: prompts, isLoading: promptsLoading } = useOwnPrompts(profile?.id);
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

  return (
    <ScreenContainer>
      <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>{profile?.display_name}</Text>

      <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
        <SectionLabel>Photos</SectionLabel>
        {isLoading ? (
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <Skeleton width={110} height={110} borderRadius={radius.md} />
            <Skeleton width={140} height={140} borderRadius={radius.md} style={{ flex: 1 }} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
            <PhotoTile
              label="Profile picture"
              uri={photos?.profileUrl}
              width={110}
              aspect={[1, 1]}
              uploading={updatePhoto.isPending && updatePhoto.variables?.role === "profile"}
              onPick={() => void handlePick("profile")}
            />
            <View style={{ flex: 1 }}>
              <PhotoTile
                label="Header picture"
                uri={photos?.headerUrl}
                width="100%"
                aspect={[3, 4]}
                uploading={updatePhoto.isPending && updatePhoto.variables?.role === "header"}
                onPick={() => void handlePick("header")}
              />
            </View>
          </View>
        )}
      </View>

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
    </ScreenContainer>
  );
}
