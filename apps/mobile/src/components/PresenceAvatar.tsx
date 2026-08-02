import { View } from "react-native";
import { Image } from "expo-image";

import { useTheme } from "@/theme/useTheme";

interface PresenceAvatarProps {
  uri: string | null | undefined;
  size: number;
  isActive?: boolean;
  /** Color the notch is "cut" from — should match whatever the avatar sits on top of. */
  backdropColor: string;
  borderColor?: string;
  borderWidth?: number;
}

/** An avatar with a Discord-style presence dot notched into its bottom-right edge,
 * replacing a separate "Active recently" text badge — the dot alone carries the signal. */
export function PresenceAvatar({
  uri,
  size,
  isActive,
  backdropColor,
  borderColor,
  borderWidth = 0,
}: PresenceAvatarProps) {
  const { colors, glow } = useTheme();
  const notchSize = Math.round(size * 0.36);
  const dotSize = Math.round(size * 0.26);

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
            bottom: -borderWidth,
            right: -borderWidth,
            width: notchSize,
            height: notchSize,
            borderRadius: notchSize / 2,
            backgroundColor: backdropColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={[
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: colors.success,
              },
              glow(colors.glowSuccess, 8),
            ]}
          />
        </View>
      )}
    </View>
  );
}
