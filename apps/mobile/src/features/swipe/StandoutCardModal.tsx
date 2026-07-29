import { Alert, Modal, View } from "react-native";
import { router } from "expo-router";

import { hapticSuccess } from "@/lib/haptics";
import { useTheme } from "@/theme/useTheme";

import { LikePassButtons } from "./LikePassButtons";
import { ProfileDetailContent } from "./ProfileDetailContent";
import type { DeckCard } from "./types";
import { SwipeLimitReachedError, useSwipeAction } from "./useSwipeAction";

interface StandoutCardModalProps {
  card: DeckCard | null;
  onClose: () => void;
  onResolved: (profileId: string) => void;
}

export function StandoutCardModal({ card, onClose, onResolved }: StandoutCardModalProps) {
  const { colors } = useTheme();
  const swipeAction = useSwipeAction();

  if (!card) return null;

  async function handleSwipe(direction: "like" | "pass") {
    const target = card as DeckCard;
    try {
      const result = await swipeAction.mutateAsync({ targetId: target.profile_id, direction });
      onResolved(target.profile_id);
      if (result.matched && result.match_id) {
        hapticSuccess();
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
        <ProfileDetailContent card={card} onClose={onClose} />

        <LikePassButtons
          disabled={swipeAction.isPending}
          onPass={() => void handleSwipe("pass")}
          onLike={() => void handleSwipe("like")}
        />
      </View>
    </Modal>
  );
}
