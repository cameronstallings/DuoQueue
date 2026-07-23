import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { useTheme } from "@/theme/useTheme";

import { StandoutCardModal } from "./StandoutCardModal";
import type { DeckCard } from "./types";
import { useStandouts } from "./useStandouts";

export function StandoutsRow() {
  const { colors, radius, spacing, shadow } = useTheme();
  const { cards, isLoading, removeCard } = useStandouts();
  const [openCard, setOpenCard] = useState<DeckCard | null>(null);

  if (!isLoading && cards.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <SectionLabel>Standouts</SectionLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {isLoading
          ? [0, 1, 2].map((i) => <Skeleton key={i} width={92} height={92} borderRadius={radius.md} />)
          : cards.map((card) => (
              <Pressable
                key={card.profile_id}
                onPress={() => setOpenCard(card)}
                style={{ width: 92, alignItems: "center", gap: 4 }}
              >
                <View
                  style={{
                    width: 92,
                    height: 92,
                    borderRadius: radius.md,
                    overflow: "hidden",
                    backgroundColor: colors.surface,
                    ...shadow,
                  }}
                >
                  {card.photoUrls[0] ? (
                    <Image source={{ uri: card.photoUrls[0] }} style={{ width: "100%", height: "100%" }} />
                  ) : null}
                </View>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                  {card.display_name}
                </Text>
              </Pressable>
            ))}
      </ScrollView>

      <StandoutCardModal
        card={openCard}
        onClose={() => setOpenCard(null)}
        onResolved={(profileId) => {
          removeCard(profileId);
          setOpenCard(null);
        }}
      />
    </View>
  );
}
