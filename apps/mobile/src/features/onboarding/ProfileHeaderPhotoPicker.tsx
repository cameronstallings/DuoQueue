import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/theme/useTheme";
import { ensurePhotoLibraryAccess } from "@/lib/photo-access";

interface PhotoSlotProps {
  label: string;
  sublabel: string;
  uri: string | null;
  aspect: [number, number];
  width: number | "100%";
  onChange: (uri: string) => void;
}

function PhotoSlot({ label, sublabel, uri, aspect, width, onChange }: PhotoSlotProps) {
  const { colors, radius, spacing, type } = useTheme();

  async function handlePick() {
    if (!(await ensurePhotoLibraryAccess())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset) onChange(asset.uri);
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text>
      <Text style={[type.caption, { color: colors.textMuted }]}>{sublabel}</Text>
      <Pressable
        onPress={() => void handlePick()}
        style={[
          styles.slot,
          { width, aspectRatio: aspect[0] / aspect[1], borderRadius: radius.md },
          uri
            ? undefined
            : {
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: colors.border,
                backgroundColor: colors.surface,
                alignItems: "center",
                justifyContent: "center",
              },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={[styles.image, { borderRadius: radius.md }]} resizeMode="cover" />
        ) : (
          <Ionicons name="add" size={28} color={colors.textMuted} />
        )}
      </Pressable>
    </View>
  );
}

interface ProfileHeaderPhotoPickerProps {
  profilePhotoUri: string | null;
  headerPhotoUri: string | null;
  onChangeProfilePhoto: (uri: string) => void;
  onChangeHeaderPhoto: (uri: string) => void;
}

export function ProfileHeaderPhotoPicker({
  profilePhotoUri,
  headerPhotoUri,
  onChangeProfilePhoto,
  onChangeHeaderPhoto,
}: ProfileHeaderPhotoPickerProps) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <PhotoSlot
        label="Profile picture"
        sublabel="Your avatar: shown in matches, chats, and highlights"
        uri={profilePhotoUri}
        aspect={[1, 1]}
        width={110}
        onChange={onChangeProfilePhoto}
      />
      <PhotoSlot
        label="Cover photo"
        sublabel="Your main photo: shown on your card and as your profile cover"
        uri={headerPhotoUri}
        aspect={[3, 4]}
        width="100%"
        onChange={onChangeHeaderPhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: "100%",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
