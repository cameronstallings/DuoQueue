import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { MAX_GALLERY_PHOTOS } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { useAddGalleryPhoto, useMakeGalleryPhotoFirst, useRemoveGalleryPhoto } from "@/features/profile/usePhotoUpload";
import { useOwnGalleryPhotos, type OwnGalleryPhoto } from "@/features/profile/useOwnGalleryPhotos";
import { useTheme } from "@/theme/useTheme";

const COLUMNS = 3;
const FALLBACK_TILE_SIZE = 100;

/** Own-profile gallery management: a 3-column grid of up to 6 gallery photos plus an
 * add tile, going through the exact same upload + moderation pipeline as the
 * profile/header photos (usePhotoUpload.ts). Long-pressing a tile — or its small edit
 * badge — opens a Sheet to move it to the front or remove it. A photo still pending
 * moderation gets an "In review" chip; that's owner-only by construction, since
 * public_profile_media (what everyone else reads through) only ever exposes approved
 * rows, and this whole panel only renders on the own-profile screen. */
export function GalleryPanel({ profileId }: { profileId: string }) {
  const { colors, radius, spacing, type, scrimRgb } = useTheme();
  const { data: photos, isLoading, isError } = useOwnGalleryPhotos(profileId);
  const addPhoto = useAddGalleryPhoto(profileId);
  const makeFirst = useMakeGalleryPhotoFirst(profileId);
  const removePhoto = useRemoveGalleryPhoto(profileId);
  const [selected, setSelected] = useState<OwnGalleryPhoto | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  // Until 0036_photo_gallery.sql is applied, "gallery" isn't a valid photo_role and
  // "position" isn't a real column, so this query always fails — hide the whole panel
  // rather than show a grid that can only ever error when the add tile is tapped.
  if (isError) return null;

  const gallery = photos ?? [];
  const canAddMore = gallery.length < MAX_GALLERY_PHOTOS;
  const tileSize = gridWidth > 0 ? (gridWidth - spacing.sm * (COLUMNS - 1)) / COLUMNS : FALLBACK_TILE_SIZE;

  async function handleAdd() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset) addPhoto.mutate({ uri: asset.uri, usedPositions: gallery.map((p) => p.position) });
  }

  function handleRemove() {
    if (!selected) return;
    removePhoto.mutate({ mediaId: selected.id, storagePath: selected.storagePath }, { onSuccess: () => setSelected(null) });
  }

  function handleMakeFirst() {
    if (!selected) return;
    makeFirst.mutate(selected.id, { onSuccess: () => setSelected(null) });
  }

  return (
    <Card>
      <SectionLabel>Photos</SectionLabel>

      <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        {isLoading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={tileSize} height={tileSize} borderRadius={radius.sm} />
            ))}
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {gallery.map((photo, index) => (
              <Pressable
                key={photo.id}
                accessibilityRole="button"
                accessibilityLabel={index === 0 ? "First gallery photo" : `Gallery photo ${index + 1}`}
                onLongPress={() => setSelected(photo)}
                style={{
                  width: tileSize,
                  height: tileSize,
                  borderRadius: radius.sm,
                  overflow: "hidden",
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />

                {photo.moderationStatus === "pending" && (
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: 0,
                      paddingVertical: 3,
                      alignItems: "center",
                      backgroundColor: `rgba(${scrimRgb},0.65)`,
                    }}
                  >
                    <Text style={[type.label, { color: colors.onFill }]}>In review</Text>
                  </View>
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit this photo"
                  hitSlop={8}
                  onPress={() => setSelected(photo)}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: `rgba(${scrimRgb},0.55)`,
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={12} color="#fff" />
                </Pressable>
              </Pressable>
            ))}

            {canAddMore && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add a gallery photo"
                onPress={() => void handleAdd()}
                disabled={addPhoto.isPending}
                style={{
                  width: tileSize,
                  height: tileSize,
                  borderRadius: radius.sm,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderStyle: "dashed",
                  opacity: addPhoto.isPending ? 0.5 : 1,
                }}
              >
                <Ionicons name="camera" size={22} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}
      </View>

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title="Gallery photo">
        <View style={{ gap: spacing.xs }}>
          {selected && selected.position !== 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Make this the first gallery photo"
              onPress={handleMakeFirst}
              disabled={makeFirst.isPending}
              style={{ paddingVertical: spacing.md }}
            >
              <Text style={[type.body, { color: colors.text }]}>Make first</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove this photo"
            onPress={handleRemove}
            disabled={removePhoto.isPending}
            style={{ paddingVertical: spacing.md }}
          >
            <Text style={[type.body, { color: colors.danger }]}>Remove</Text>
          </Pressable>
        </View>
      </Sheet>
    </Card>
  );
}
