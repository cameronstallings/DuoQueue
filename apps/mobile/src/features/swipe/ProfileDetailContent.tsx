import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { useTheme } from "@/theme/useTheme";

import { SkillBadge } from "./SkillBadge";
import type { DeckCard } from "./types";

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

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <View style={{ width: "100%", aspectRatio: 0.85, backgroundColor: colors.surface }}>
        {card.headerPhotoUrl ? (
          <Image source={{ uri: card.headerPhotoUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={{
            position: "absolute",
            top: 50,
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
          {card.profilePhotoUrl ? (
            <Image
              source={{ uri: card.profilePhotoUrl }}
              style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: colors.background }}
            />
          ) : null}
          <Text style={{ fontSize: 24, fontWeight: "700", color: colors.text }}>
            {card.display_name}, {card.age}
          </Text>
        </View>

        {card.isRecentlyActive && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>Active recently</Text>
          </View>
        )}

        <Text style={{ color: colors.textMuted, fontSize: 14 }}>
          {REGION_LABELS[card.region] ?? card.region}
          {card.languages.length > 0 ? ` · ${card.languages.join(", ").toUpperCase()}` : ""}
        </Text>

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
