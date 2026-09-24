import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { PlayerMark } from "@/components/PlayerMark";
import { SectionLabel } from "@/components/SectionLabel";
import { ensurePhotoLibraryAccess } from "@/lib/photo-access";
import { useTheme } from "@/theme/useTheme";

import { PICTURE_TAG, ownPictureState } from "./pictureStatus";
import { useOwnProfilePhotos } from "./useOwnProfilePhotos";
import { useUpdatePhoto } from "./usePhotoUpload";

const SLOT_SIZE = 112;

/**
 * Edit's one square picture slot. The picture uploads the moment it is picked, separately from
 * Save, so Cancel does not undo it; the caption says so.
 */
export function YourPictureSlot({ profileId, name }: { profileId: string; name: string }) {
  const { colors, radius, spacing, type } = useTheme();
  const { data: photos } = useOwnProfilePhotos(profileId);
  const updatePhoto = useUpdatePhoto(profileId);
  const picture = photos ? ownPictureState(photos) : null;
  // "ADD A PICTURE" would repeat the button; only review states get a tag here.
  const tag = picture?.tag && picture.tag !== PICTURE_TAG.add ? picture.tag : null;

  async function handlePick() {
    if (!(await ensurePhotoLibraryAccess())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset) updatePhoto.mutate({ uri: asset.uri });
  }

  const actionLabel = updatePhoto.isPending ? "Uploading..." : picture?.url ? "Change picture" : "Choose a picture";

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>Your picture</SectionLabel>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable
          onPress={() => void handlePick()}
          disabled={updatePhoto.isPending}
          accessibilityRole="button"
          accessibilityLabel={picture?.url ? "Change your picture" : "Add a picture"}
          style={{
            width: SLOT_SIZE,
            height: SLOT_SIZE,
            borderRadius: radius.picture,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.cardEdge,
            backgroundColor: colors.cardRecessed,
            opacity: updatePhoto.isPending ? 0.6 : 1,
          }}
        >
          {picture?.url ? (
            <Image
              source={{ uri: picture.url }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          ) : (
            <PlayerMark name={name} size={SLOT_SIZE} shape="none" color={colors.cardMark} glyphScale={0.6} />
          )}
        </Pressable>
        <View style={{ flex: 1, gap: spacing.xs }}>
          {tag ? <Text style={[type.tick, { color: colors.textMuted }]}>{tag}</Text> : null}
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {picture?.note ?? "Optional. It shows on your card and next to your name in matches."}
          </Text>
          <Pressable
            onPress={() => void handlePick()}
            disabled={updatePhoto.isPending}
            hitSlop={8}
            accessibilityRole="button"
            style={{ alignSelf: "flex-start" }}
          >
            <Text style={[type.label, { color: colors.voltDim }]}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={[type.caption, { color: colors.textMuted }]}>Saved as soon as you pick it.</Text>
    </View>
  );
}
