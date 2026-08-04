import { View } from "react-native";
import { Image } from "expo-image";

import { useTheme } from "@/theme/useTheme";

interface PresenceAvatarProps {
  uri: string | null | undefined;
  size: number;
  isActive?: boolean;
  borderColor?: string;
  borderWidth?: number;
}

/** An avatar with a fixed 8px volt presence dot pinned to its bottom-right edge,
 * replacing a separate "Active recently" text badge — the dot alone carries the signal. */
export function PresenceAvatar({
  uri,
  size,
  isActive,
  borderColor,
  borderWidth = 0,
}: PresenceAvatarProps) {
  const { colors } = useTheme();

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            borderColor,
          }}
          cachePolicy="memory-disk"
          transition={150}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.surfaceAlt,
            borderWidth,
            borderColor,
          }}
        />
      )}
      {isActive && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.volt,
            borderWidth: 2,
            borderColor: colors.background,
          }}
        />
      )}
    </View>
  );
}
