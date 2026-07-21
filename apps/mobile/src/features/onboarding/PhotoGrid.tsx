import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MAX_PROFILE_PHOTOS } from "@duoqueue/shared-types";

import { useTheme } from "@/theme/useTheme";

interface PhotoGridProps {
  uris: string[];
  onChange: (uris: string[]) => void;
}

export function PhotoGrid({ uris, onChange }: PhotoGridProps) {
  const { colors, radius, spacing } = useTheme();

  async function handleAddPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;

    onChange([...uris, asset.uri]);
  }

  function handleRemove(index: number) {
    onChange(uris.filter((_, i) => i !== index));
  }

  const slots = Array.from({ length: MAX_PROFILE_PHOTOS }, (_, i) => uris[i] ?? null);

  return (
    <View style={[styles.grid, { gap: spacing.sm }]}>
      {slots.map((uri, index) =>
        uri ? (
          <Pressable key={index} onPress={() => handleRemove(index)} style={styles.slot}>
            <Image source={{ uri }} style={[styles.image, { borderRadius: radius.md }]} />
            <View style={[styles.removeBadge, { backgroundColor: colors.danger }]}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>×</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable
            key={index}
            onPress={() => void handleAddPhoto()}
            style={[
              styles.slot,
              styles.emptySlot,
              { borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface },
            ]}
          >
            <Text style={{ color: colors.textMuted, fontSize: 24 }}>+</Text>
          </Pressable>
        ),
      )}
    </View>
  );
}

const SLOT_SIZE = 96;

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE * 1.3,
  },
  emptySlot: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  removeBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
