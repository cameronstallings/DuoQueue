import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PresenceAvatar } from "@/components/PresenceAvatar";
import { VoiceIntroPlayer } from "@/components/VoiceIntroPlayer";
import { MATCH_FEEDBACK_LABELS, REGION_LABELS, TILT_HANDLING_LABELS } from "@/features/onboarding/profile-labels";
import { usePublicLinkedAccounts } from "@/features/profile/useLinkedAccounts";
import { usePublicVoiceIntro } from "@/features/profile/useVoiceIntro";
import { usePublicReputation } from "@/features/reputation/useReputation";
import { useTheme } from "@/theme/useTheme";

import { SkillBadge } from "./SkillBadge";
import type { DeckCard } from "./types";

const PROVIDER_LABELS = { steam: "Steam", riot: "Riot Games", xbox: "Xbox" } as const;

function VibeBar({ label, pct }: { label: string; pct: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${pct}%`, backgroundColor: colors.brand, borderRadius: 3 }} />
      </View>
    </View>
  );
}

interface ProfileDetailContentProps {
  card: DeckCard;
  onClose: () => void;
}

/** The full, spacious "everything about this person" view — header photo, avatar,
 * every game/show/playstyle, and every prompt. Used both by the Standouts detail modal
 * and the main deck's "See full profile" flow, since a swipe card only has room to show
 * the highlights at a glance. */
export function ProfileDetailContent({ card, onClose }: ProfileDetailContentProps) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: reputation } = usePublicReputation(card.profile_id);
  const { data: voiceIntro } = usePublicVoiceIntro(card.profile_id);
  const { data: linkedAccounts } = usePublicLinkedAccounts(card.profile_id);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={{ width: "100%", aspectRatio: 0.85, backgroundColor: colors.surface }}>
        {card.headerPhotoUrl ? (
          <Image
            source={{ uri: card.headerPhotoUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : null}
        <LinearGradient
          colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"]}
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 44 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{
            position: "absolute",
            top: insets.top + spacing.sm,
            right: spacing.md,
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <PresenceAvatar
            uri={card.profilePhotoUrl}
            size={48}
            isActive={card.isRecentlyActive}
            backdropColor={colors.background}
            borderColor={colors.background}
            borderWidth={2}
          />
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>
            {card.display_name}, {card.age}
          </Text>
          {linkedAccounts && linkedAccounts.length > 0 && (
            <Ionicons name="shield-checkmark" size={20} color={colors.brand} />
          )}
        </View>

        {linkedAccounts && linkedAccounts.length > 0 && (
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            Verified: {linkedAccounts.map((a) => PROVIDER_LABELS[a.provider]).join(", ")}
          </Text>
        )}

        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          {REGION_LABELS[card.region] ?? card.region}
          {card.languages.length > 0 ? ` · ${card.languages.join(", ").toUpperCase()}` : ""}
        </Text>

        {card.playWindowLabel && <Text style={{ color: colors.textMuted, fontSize: 14 }}>{card.playWindowLabel}</Text>}

        {voiceIntro && <VoiceIntroPlayer url={voiceIntro.url} durationSeconds={voiceIntro.durationSeconds} />}

        {reputation && reputation.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            {reputation.map((r) => (
              <View
                key={r.tag}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: colors.brandSoft,
                  borderRadius: radius.pill,
                  paddingVertical: 4,
                  paddingHorizontal: spacing.sm,
                }}
              >
                <Ionicons name="checkmark-circle" size={13} color={colors.brand} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                  {MATCH_FEEDBACK_LABELS[r.tag]} · {r.tag_count}
                </Text>
              </View>
            ))}
          </View>
        )}

        {card.topGames.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>
            {card.topGames.map((g) => (
              <SkillBadge key={g.name} gameName={g.name} skillLevel={g.skillLevel} />
            ))}
          </View>
        )}

        {card.topShows.length > 0 && (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Watching: {card.topShows.join(", ")}</Text>
        )}

        {card.playstyles.length > 0 && (
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{card.playstyles.join(" · ")}</Text>
        )}

        {card.vibe && (
          <View
            style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }}
          >
            <Text
              style={{ color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 }}
            >
              Vibe
            </Text>
            <VibeBar label="Chill ↔ Sweaty ranked grind" pct={card.vibe.intensity} />
            <VibeBar label="Quiet ↔ Mic on constantly" pct={card.vibe.commsStyle} />
            <VibeBar label="Don't coach me ↔ Coach me" pct={card.vibe.coachingPref} />
            <Text style={{ color: colors.text, fontSize: 13 }}>
              After a losing streak: {TILT_HANDLING_LABELS[card.vibe.tiltHandling]}
            </Text>
          </View>
        )}

        {card.prompts.map((prompt) => (
          <View
            key={prompt.question}
            style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: 4 }}
          >
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 11,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.4,
              }}
            >
              {prompt.question}
            </Text>
            <Text style={{ color: colors.text, fontSize: 15 }}>{prompt.answer}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
