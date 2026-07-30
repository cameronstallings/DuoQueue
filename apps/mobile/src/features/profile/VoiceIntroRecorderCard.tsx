import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";

import { Card } from "@/components/Card";
import { useTheme } from "@/theme/useTheme";

import { useDeleteVoiceIntro, useOwnVoiceIntro, useUploadVoiceIntro } from "./useVoiceIntro";
import { VOICE_INTRO_MAX_SECONDS, useVoiceIntroRecorder } from "./useVoiceIntroRecorder";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review — only you can see this until it's reviewed.",
  approved: "Live on your profile.",
  rejected: "Not approved — record a new one.",
};

function LocalPreviewPlayer({ uri }: { uri: string }) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  return (
    <Pressable
      onPress={() => {
        if (status.playing) player.pause();
        else {
          if (status.currentTime >= status.duration && status.duration > 0) void player.seekTo(0);
          player.play();
        }
      }}
      hitSlop={8}
    >
      <Ionicons name={status.playing ? "pause-circle" : "play-circle"} size={32} color={colors.brand} />
    </Pressable>
  );
}

export function VoiceIntroRecorderCard({ profileId }: { profileId: string }) {
  const { colors, spacing } = useTheme();
  const { data: existing } = useOwnVoiceIntro(profileId);
  const upload = useUploadVoiceIntro(profileId);
  const deleteIntro = useDeleteVoiceIntro(profileId);
  const recorder = useVoiceIntroRecorder();

  async function handleToggleRecord() {
    if (recorder.isRecording) {
      await recorder.stopRecording();
    } else {
      await recorder.startRecording();
    }
  }

  async function handleSave() {
    if (!recorder.recordedUri) return;
    try {
      await upload.mutateAsync({ uri: recorder.recordedUri, durationSeconds: recorder.recordedDuration });
      recorder.reset();
    } catch (err) {
      Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>
        A {VOICE_INTRO_MAX_SECONDS}-second voice clip tells people more than a bio — gaming is a voice activity.
      </Text>
      <Card style={{ gap: spacing.sm }}>
        {recorder.error && <Text style={{ color: colors.danger, fontSize: 13 }}>{recorder.error}</Text>}

        {recorder.recordedUri ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <LocalPreviewPlayer uri={recorder.recordedUri} />
            <Text style={{ color: colors.text, flex: 1 }}>{recorder.recordedDuration}s recorded</Text>
            <Pressable onPress={recorder.reset}>
              <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Discard</Text>
            </Pressable>
            <Pressable onPress={() => void handleSave()} disabled={upload.isPending}>
              <Text style={{ color: colors.brand, fontWeight: "700" }}>{upload.isPending ? "Saving…" : "Save"}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <Pressable
              onPress={() => void handleToggleRecord()}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: recorder.isRecording ? colors.danger : colors.brand,
              }}
            >
              <Ionicons name={recorder.isRecording ? "stop" : "mic"} size={22} color="#fff" />
            </Pressable>
            <Text style={{ color: colors.textMuted }}>
              {recorder.isRecording
                ? `Recording… ${Math.ceil(recorder.currentSeconds)}s / ${VOICE_INTRO_MAX_SECONDS}s`
                : existing
                  ? "Tap to record a new intro"
                  : "Tap to record"}
            </Text>
          </View>
        )}

        {existing && !recorder.recordedUri && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>
              {STATUS_LABEL[existing.moderation_status] ?? existing.moderation_status}
            </Text>
            <Pressable onPress={() => deleteIntro.mutate()}>
              <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "600" }}>Remove</Text>
            </Pressable>
          </View>
        )}
      </Card>
    </View>
  );
}
