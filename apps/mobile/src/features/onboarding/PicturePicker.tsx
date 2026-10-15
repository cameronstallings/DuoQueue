import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { ensurePhotoLibraryAccess } from "@/lib/photo-access";
import { useTheme } from "@/theme/useTheme";

const SLOT_SIZE = 160;

interface PicturePickerProps {
  uri: string | null;
  onPick: (uri: string) => void;
  onRemove: () => void;
  /**
   * Continues without a picture, as a "Skip for now" link under the empty slot. Optional since
   * 1.0.2: the name step no longer passes it, because its Continue already moves on without a
   * picture and a second, differently worded way forward read as a different action.
   */
  onSkip?: () => void;
}

/**
 * The one optional picture: square, any image. It goes in the `profile` slot, which every card
 * and avatar reads. Library access goes through ensurePhotoLibraryAccess so a denied permission
 * explains itself and offers Settings instead of a button that does nothing.
 *
 * expo-image with a short transition (1.0.2), so a picked picture fades into the slot instead of
 * popping in a frame after the tap.
 */
export function PicturePicker({ uri, onPick, onRemove, onSkip }: PicturePickerProps) {
  const { colors, motion, radius, spacing, type } = useTheme();

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
    if (asset) onPick(asset.uri);
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[type.bodyStrong, { color: colors.text }]}>Your picture</Text>
      <Text style={[type.caption, { color: colors.textMuted }]}>
        Optional. It shows on your card and next to your name in matches. You, your setup, your cat: anything that
        feels like you.
      </Text>
      <Pressable
        onPress={() => void handlePick()}
        accessibilityRole="button"
        accessibilityLabel={uri ? "Change your picture" : "Add a picture"}
        style={({ pressed }) => ({
          width: SLOT_SIZE,
          height: SLOT_SIZE,
          marginTop: spacing.xs,
          borderRadius: radius.md,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderWidth: uri ? 0 : 1,
          borderStyle: "dashed",
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={motion.base}
            cachePolicy="memory-disk"
          />
        ) : (
          <Ionicons name="add" size={28} color={colors.textMuted} />
        )}
      </Pressable>
      {uri ? (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" style={{ alignSelf: "flex-start", marginTop: spacing.xs }}>
          <Text style={[type.caption, { color: colors.textMuted }]}>Remove picture</Text>
        </Pressable>
      ) : onSkip ? (
        <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" style={{ alignSelf: "flex-start", marginTop: spacing.xs }}>
          <Text style={[type.caption, { color: colors.voltDim }]}>Skip for now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
