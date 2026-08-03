import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { useTheme } from "@/theme/useTheme";

interface VoiceIntroPlayerProps {
  url: string;
  durationSeconds: number;
}

/** A tap-to-play bubble for someone else's voice intro clip — three seconds tells you
 * more than a bio, per the brief, so this stays a single glanceable control. */
export function VoiceIntroPlayer({ url, durationSeconds }: VoiceIntroPlayerProps) {
  const { colors, radius, spacing, type } = useTheme();
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);

  function handlePress() {
    if (status.playing) {
      player.pause();
    } else {
      if (status.currentTime >= status.duration && status.duration > 0) {
        void player.seekTo(0);
      }
      player.play();
    }
  }

  const remaining = Math.max(0, Math.ceil((status.duration || durationSeconds) - status.currentTime));

  return (
    <Pressable
      onPress={handlePress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        backgroundColor: colors.voltSoft,
        borderRadius: radius.chip,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        alignSelf: "flex-start",
      }}
    >
      <Ionicons name={status.playing ? "pause-circle" : "play-circle"} size={28} color={colors.volt} />
      <Text style={[type.caption, { color: colors.text }]}>
        {status.playing ? `${remaining}s` : "Voice intro"}
      </Text>
    </Pressable>
  );
}
