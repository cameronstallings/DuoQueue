import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/theme/useTheme";

interface PhotoSlotProps {
  label: string;
  sublabel: string;
  uri: string | null;
  aspect: [number, number];
  width: number | "100%";
  onChange: (uri: string) => void;
}

function PhotoSlot({ label, sublabel, uri, aspect, width, onChange }: PhotoSlotProps) {
  const { colors, radius, spacing } = useTheme();

  async function handlePick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

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
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{sublabel}</Text>
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
          <Text style={{ color: colors.textMuted, fontSize: 28 }}>+</Text>
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
        sublabel="Your avatar — shown in matches, chats, and Standouts"
        uri={profilePhotoUri}
        aspect={[1, 1]}
        width={110}
        onChange={onChangeProfilePhoto}
      />
      <PhotoSlot
        label="Header picture"
        sublabel="The big image on your card while people swipe"
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
