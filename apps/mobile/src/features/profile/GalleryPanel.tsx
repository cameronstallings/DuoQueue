import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { MAX_GALLERY_PHOTOS } from "@duoqueue/shared-types";

import { Card } from "@/components/Card";
import { SectionLabel } from "@/components/SectionLabel";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { hapticLight } from "@/lib/haptics";
import {
  useAddGalleryPhoto,
  useMakeGalleryPhotoFirst,
  useRemoveGalleryPhoto,
  useReorderGalleryPhoto,
} from "@/features/profile/usePhotoUpload";
import { useOwnGalleryPhotos, type OwnGalleryPhoto } from "@/features/profile/useOwnGalleryPhotos";
import { useTheme } from "@/theme/useTheme";

const COLUMNS = 3;
const FALLBACK_TILE_SIZE = 100;
const LONG_PRESS_DURATION = 250;

/** Pixel offset of a grid slot, slot 0 being top-left. Slot numbering here always
 * includes the Cover tile at slot 0 — gallery photo `i` lives at slot `1 + i` when at
 * rest, so this same helper places the Cover tile, every gallery tile, and the Add tile
 * without three separate layout systems. */
function slotOffset(slot: number, tileSize: number, gap: number) {
  "worklet";
  const col = slot % COLUMNS;
  const row = Math.floor(slot / COLUMNS);
  return { x: col * (tileSize + gap), y: row * (tileSize + gap) };
}

/** slotByIndex is always exactly `count` long and initialized as an identity map, so
 * `arr[i]` is only ever undefined here because of noUncheckedIndexedAccess, never in
 * practice — the fallback is `i` itself, the identity-map value. */
function slotAt(arr: number[], i: number): number {
  "worklet";
  const v = arr[i];
  return v === undefined ? i : v;
}

/** Own-profile gallery management: a 3-column grid of up to 6 gallery photos plus an
 * add tile, going through the exact same upload + moderation pipeline as the
 * profile/header photos (usePhotoUpload.ts). Tapping a tile opens a Sheet (Make first /
 * Move left / Move right / Remove); holding one down and dragging reorders it among the
 * other gallery photos directly. A photo still pending moderation gets an "In review"
 * chip; that's owner-only by construction, since public_profile_media (what everyone
 * else reads through) only ever exposes approved rows, and this whole panel only
 * renders on the own-profile screen.
 *
 * The grid's first tile is the header/cover photo rather than a gallery photo — this
 * is now the only way to manage the card cover, since the bento profile has no banner.
 * Its data and upload handler live in the parent (useOwnProfilePhotos / useUpdatePhoto),
 * not here, so it renders in its ready state from the moment this panel mounts. The
 * Cover tile and the Add tile are fixed points in the grid — never drag targets, never
 * displaced by a gallery photo's drag — only the gallery subset (indices 0..N-1)
 * reorders among itself. */
export function GalleryPanel({
  profileId,
  headerUrl,
  onPressCover,
  coverUploading,
  coverDisabled,
}: {
  profileId: string;
  headerUrl: string | null;
  onPressCover: () => void;
  coverUploading: boolean;
  coverDisabled: boolean;
}) {
  const { colors, radius, spacing, type, scrimRgb } = useTheme();
  const { data: photos, isLoading, isError } = useOwnGalleryPhotos(profileId);
  const addPhoto = useAddGalleryPhoto(profileId);
  const makeFirst = useMakeGalleryPhotoFirst(profileId);
  const removePhoto = useRemoveGalleryPhoto(profileId);
  const reorderPhoto = useReorderGalleryPhoto(profileId);
  const [selected, setSelected] = useState<OwnGalleryPhoto | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  // Which gallery index (if any) is currently lifted by a drag — drives the JS-side
  // glow (reanimated's boxShadow doesn't interpolate the way transforms/opacity do, so
  // this stays a plain state toggle, same idiom Chip.tsx uses for its selected glow)
  // and gates the slot-reset effect below so a mid-drag refetch can't yank tiles out
  // from under a finger that's still down.
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // `photos` (not yet known to be defined if the query errored) has to feed the two
  // hooks below unconditionally — Rules of Hooks means these can't move after the
  // isError early return, so `gallery` is computed here too rather than after it.
  const gallery = photos ?? [];

  // slotByIndex[i] is where gallery photo `i` (its rest/server-order index) is
  // currently drawn, 0..gallery.length-1 — identity at rest, permuted live while a
  // drag is in progress. activeIndex is the rest-index of whichever tile (if any) is
  // being dragged, -1 when none is.
  const slotByIndex = useSharedValue<number[]>(gallery.map((_, i) => i));
  const activeIndex = useSharedValue(-1);
  const galleryKey = gallery.map((p) => p.id).join(",");

  useEffect(() => {
    if (draggingIndex !== null) return;
    slotByIndex.value = gallery.map((_, i) => i);
    // gallery itself is intentionally not a dep — galleryKey is its stable identity,
    // and re-running on every new `gallery` array reference (a new one lands on every
    // query refetch) would fight the drag gesture over what slotByIndex.value is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryKey, draggingIndex]);

  // Until 0036_photo_gallery.sql is applied, "gallery" isn't a valid photo_role and
  // "position" isn't a real column, so this query always fails — hide the whole panel
  // rather than show a grid that can only ever error when the add tile is tapped.
  if (isError) return null;

  const canAddMore = gallery.length < MAX_GALLERY_PHOTOS;
  const tileSize = gridWidth > 0 ? (gridWidth - spacing.sm * (COLUMNS - 1)) / COLUMNS : FALLBACK_TILE_SIZE;
  const selectedIndex = selected ? gallery.findIndex((p) => p.id === selected.id) : -1;

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

  function handleMoveTo(newPosition: number) {
    if (!selected) return;
    reorderPhoto.mutate({ mediaId: selected.id, newPosition }, { onSuccess: () => setSelected(null) });
  }

  // Called from the UI thread (via runOnJS) once a drag gesture ends. `toIndex` is
  // wherever slotByIndex settled the dragged tile — a no-op drop (picked up and put
  // back) skips the mutation entirely.
  function handleTileDropped(mediaId: string, fromIndex: number, toIndex: number) {
    setDraggingIndex(null);
    if (fromIndex === toIndex) return;
    reorderPhoto.mutate({ mediaId, newPosition: toIndex });
  }

  const totalSlots = 1 + gallery.length + (canAddMore ? 1 : 0);
  const gridRows = Math.max(1, Math.ceil(totalSlots / COLUMNS));
  const gridHeight = gridRows * tileSize + Math.max(0, gridRows - 1) * spacing.sm;
  const addTileOffset = slotOffset(1 + gallery.length, tileSize, spacing.sm);

  function renderCoverTile(extraStyle: object) {
    return (
      <Pressable
        key="cover"
        accessibilityRole="button"
        accessibilityLabel="Change header picture"
        onPress={onPressCover}
        disabled={coverDisabled}
        style={[
          {
            width: tileSize,
            height: tileSize,
            borderRadius: radius.sm,
            overflow: "hidden",
            backgroundColor: colors.surfaceAlt,
            opacity: coverUploading ? 0.5 : 1,
          },
          extraStyle,
        ]}
      >
        {headerUrl ? (
          <Image
            source={{ uri: headerUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="camera" size={22} color={colors.textMuted} />
          </View>
        )}
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
          <Text style={[type.label, { color: colors.onFill }]}>Cover</Text>
        </View>
      </Pressable>
    );
  }

  function renderAddTile(extraStyle: object) {
    return (
      <Pressable
        key="add"
        accessibilityRole="button"
        accessibilityLabel="Add a gallery photo"
        onPress={() => void handleAdd()}
        disabled={addPhoto.isPending}
        style={[
          {
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
          },
          extraStyle,
        ]}
      >
        <Ionicons name="camera" size={22} color={colors.textMuted} />
      </Pressable>
    );
  }

  return (
    <Card style={{ width: "100%", padding: spacing.tight }}>
      <SectionLabel>Photos</SectionLabel>

      <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        {isLoading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {renderCoverTile({})}
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} width={tileSize} height={tileSize} borderRadius={radius.sm} />
            ))}
          </View>
        ) : (
          <View style={{ width: "100%", height: gridHeight, position: "relative" }}>
            {renderCoverTile({ position: "absolute", top: 0, left: 0 })}

            {gallery.map((photo, index) => (
              <GalleryTile
                key={photo.id}
                photo={photo}
                index={index}
                count={gallery.length}
                tileSize={tileSize}
                gap={spacing.sm}
                slotByIndex={slotByIndex}
                activeIndex={activeIndex}
                onLift={() => setDraggingIndex(index)}
                onOpenSheet={setSelected}
                onDrop={handleTileDropped}
              />
            ))}

            {canAddMore &&
              renderAddTile({
                position: "absolute",
                top: addTileOffset.y,
                left: addTileOffset.x,
              })}
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
          {selectedIndex > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Move this photo left"
              onPress={() => handleMoveTo(selectedIndex - 1)}
              disabled={reorderPhoto.isPending}
              style={{ paddingVertical: spacing.md }}
            >
              <Text style={[type.body, { color: colors.text }]}>Move left</Text>
            </Pressable>
          )}
          {selectedIndex !== -1 && selectedIndex < gallery.length - 1 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Move this photo right"
              onPress={() => handleMoveTo(selectedIndex + 1)}
              disabled={reorderPhoto.isPending}
              style={{ paddingVertical: spacing.md }}
            >
              <Text style={[type.body, { color: colors.text }]}>Move right</Text>
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

/** One draggable gallery tile. Tap opens the Sheet; holding for ~250ms lifts it (scale
 * + haptic) and a Pan gesture takes over, following the finger while the other
 * tiles animate out of the way. `Gesture.Race` plus Pan's own `activateAfterLongPress`
 * is what makes a quick tap and a hold-then-drag mutually exclusive without any manual
 * timer bookkeeping: if the finger moves before the long-press duration elapses, Pan
 * fails to activate and the Tap gesture wins the race instead. */
function GalleryTile({
  photo,
  index,
  count,
  tileSize,
  gap,
  slotByIndex,
  activeIndex,
  onLift,
  onOpenSheet,
  onDrop,
}: {
  photo: OwnGalleryPhoto;
  index: number;
  count: number;
  tileSize: number;
  gap: number;
  slotByIndex: SharedValue<number[]>;
  activeIndex: SharedValue<number>;
  onLift: () => void;
  onOpenSheet: (photo: OwnGalleryPhoto) => void;
  onDrop: (mediaId: string, fromIndex: number, toIndex: number) => void;
}) {
  const { colors, radius, type, scrimRgb, motion } = useTheme();
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const tap = Gesture.Tap().onEnd((_event, success) => {
    // onEnd fires whether or not the tap actually completed — e.g. it also fires when
    // Pan wins the Race below and this Tap gets cancelled mid-hold. Only success===true
    // is an actual tap.
    if (success) runOnJS(onOpenSheet)(photo);
  });

  const pan = Gesture.Pan()
    .enabled(count > 1)
    .activateAfterLongPress(LONG_PRESS_DURATION)
    .onStart(() => {
      activeIndex.value = index;
      runOnJS(hapticLight)();
      runOnJS(onLift)();
    })
    .onUpdate((event) => {
      dragX.value = event.translationX;
      dragY.value = event.translationY;

      const start = slotOffset(1 + index, tileSize, gap);
      const centerX = start.x + dragX.value + tileSize / 2;
      const centerY = start.y + dragY.value + tileSize / 2;
      const col = Math.min(Math.max(Math.floor(centerX / (tileSize + gap)), 0), COLUMNS - 1);
      const row = Math.max(Math.floor(centerY / (tileSize + gap)), 0);
      const globalSlot = row * COLUMNS + col;
      const hovered = Math.min(Math.max(globalSlot - 1, 0), count - 1);

      const current = slotAt(slotByIndex.value, index);
      if (hovered !== current) {
        // Same shift-the-rows-in-between move the reorder_gallery_photo RPC does
        // server-side, applied here to slot indices instead of "position" values.
        const next = slotByIndex.value.slice();
        if (hovered < current) {
          for (let j = 0; j < count; j++) {
            if (j !== index && slotAt(next, j) >= hovered && slotAt(next, j) < current) next[j] = slotAt(next, j) + 1;
          }
        } else {
          for (let j = 0; j < count; j++) {
            if (j !== index && slotAt(next, j) <= hovered && slotAt(next, j) > current) next[j] = slotAt(next, j) - 1;
          }
        }
        next[index] = hovered;
        slotByIndex.value = next;
      }
    })
    .onFinalize((_event, success) => {
      // onFinalize (not onEnd) so a gesture the OS interrupts mid-drag — an incoming
      // call, a system-gesture takeover — still resets the tile instead of leaving it
      // stuck lifted forever; onEnd alone only fires on a clean release. `success`
      // false (interrupted, or this Pan lost the Race to the Tap gesture above) snaps
      // straight back to the tile's own rest slot, which onDrop's fromIndex===toIndex
      // check below turns into a no-op.
      const finalSlot = success ? slotAt(slotByIndex.value, index) : index;
      const start = slotOffset(1 + index, tileSize, gap);
      const end = slotOffset(1 + finalSlot, tileSize, gap);

      dragY.value = withTiming(end.y - start.y, { duration: motion.base });
      dragX.value = withTiming(end.x - start.x, { duration: motion.base }, (finished) => {
        if (finished) {
          activeIndex.value = -1;
          dragX.value = 0;
          dragY.value = 0;
        }
      });

      runOnJS(onDrop)(photo.id, index, finalSlot);
    });

  const gesture = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeIndex.value === index;
    const target = isActive
      ? (() => {
          const start = slotOffset(1 + index, tileSize, gap);
          return { x: start.x + dragX.value, y: start.y + dragY.value };
        })()
      : slotOffset(1 + slotAt(slotByIndex.value, index), tileSize, gap);

    return {
      transform: [
        { translateX: isActive ? target.x : withTiming(target.x, { duration: motion.base }) },
        { translateY: isActive ? target.y : withTiming(target.y, { duration: motion.base }) },
        { scale: withTiming(isActive ? 1.06 : 1, { duration: motion.quick }) },
      ],
      opacity: withTiming(isActive ? 0.92 : 1, { duration: motion.quick }),
      zIndex: isActive ? 10 : 0,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          { position: "absolute", top: 0, left: 0, width: tileSize, height: tileSize, borderRadius: radius.sm },
          animatedStyle,
        ]}
      >
        <View
          accessibilityRole="button"
          accessibilityLabel={index === 0 ? "First gallery photo" : `Gallery photo ${index + 1}`}
          style={{
            flex: 1,
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

          <View
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
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
