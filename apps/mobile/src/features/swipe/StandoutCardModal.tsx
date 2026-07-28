import { Alert, Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/theme/useTheme";

import { LikePassButtons } from "./LikePassButtons";
import { SkillBadge } from "./SkillBadge";
import type { DeckCard } from "./types";
import { SwipeLimitReachedError, useSwipeAction } from "./useSwipeAction";

interface StandoutCardModalProps {
  card: DeckCard | null;
  onClose: () => void;
  onResolved: (profileId: string) => void;
}

export function StandoutCardModal({ card, onClose, onResolved }: StandoutCardModalProps) {
  const { colors, spacing, radius } = useTheme();
  const swipeAction = useSwipeAction();

  if (!card) return null;

  async function handleSwipe(direction: "like" | "pass") {
    const target = card as DeckCard;
    try {
      const result = await swipeAction.mutateAsync({ targetId: target.profile_id, direction });
      onResolved(target.profile_id);
      if (result.matched && result.match_id) {
        router.push({
          pathname: "/match/[matchId]",
          params: {
            matchId: result.match_id,
            name: target.display_name,
            photo: target.profilePhotoUrl ?? "",
          },
        });
      }
    } catch (err) {
      if (err instanceof SwipeLimitReachedError) {
        Alert.alert("Daily limit reached", "You've used all your free swipes for today.");
      } else {
        Alert.alert("Something went wrong", err instanceof Error ? err.message : "Please try again.");
      }
    }
  }

  return (
    <Modal visible={!!card} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
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
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }}
                />
                <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "600" }}>Active recently</Text>
              </View>
            )}

            {card.topGames.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                {card.topGames.map((g) => (
                  <SkillBadge key={g.name} gameName={g.name} skillLevel={g.skillLevel} />
                ))}
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

        <LikePassButtons
          disabled={swipeAction.isPending}
          onPass={() => void handleSwipe("pass")}
          onLike={() => void handleSwipe("like")}
        />
      </View>
    </Modal>
  );
}
