import { useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { Name } from "@/components/Name";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { useTheme } from "@/theme/useTheme";

import { cardPicture } from "./cardChips";
// Not "./deckStrip": that differs from this file's name only in case, and on a case-insensitive
// disk (Windows, the Mac that builds the app) "@/features/swipe/DeckStrip" would resolve to it.
import { highlightsCountLabel, stripQuotaLabel, type StripQuota } from "./deckStripCopy";
import { StandoutCardModal } from "./StandoutCardModal";
import type { DeckCard } from "./types";
import { useStandouts } from "./useStandouts";

const STRIP_HEIGHT = 32;
const FACE_SIZE = 19;
const FACE_OVERLAP = 6;
const SHEET_FACE_SIZE = 64;
const COMPACT_WIDTH = 380;

/**
 * The Deck's one-line chrome: three Highlights faces, "HIGHLIGHTS", "4 PICKED TODAY ›" and the
 * swipes left. It replaces the ~145pt Highlights row so the card gets the room. Tapping opens the
 * Highlights sheet; a face there opens that player's full profile with Pass and Duo, as before.
 */
export function DeckStrip({ quota }: { quota: StripQuota | undefined }) {
  const { colors, radius, spacing, type } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < COMPACT_WIDTH;
  const { cards, isLoading, removeCard } = useStandouts();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [openCard, setOpenCard] = useState<DeckCard | null>(null);
  const hasHighlights = cards.length > 0;
  const quotaText = stripQuotaLabel(quota, compact);

  // Same hand-off as the chat screen's menu: close the sheet and open the modal in one handler.
  function handlePick(card: DeckCard) {
    setSheetVisible(false);
    setOpenCard(card);
  }

  return (
    <>
      <Pressable
        disabled={!hasHighlights}
        onPress={() => setSheetVisible(true)}
        accessibilityRole={hasHighlights ? "button" : undefined}
        accessibilityLabel={hasHighlights ? `Highlights, ${highlightsCountLabel(cards.length)}` : undefined}
        style={({ pressed }) => ({
          height: STRIP_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.picture,
          borderWidth: 1,
          borderColor: colors.cardEdge,
          backgroundColor: colors.cardPanel,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {isLoading ? (
          <View style={{ flexDirection: "row" }}>
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                width={FACE_SIZE}
                height={FACE_SIZE}
                borderRadius={radius.round}
                style={{ marginLeft: i === 0 ? 0 : -FACE_OVERLAP }}
              />
            ))}
          </View>
        ) : hasHighlights ? (
          <View style={{ flexDirection: "row" }}>
            {cards.slice(0, 3).map((card, i) => (
              <View
                key={card.profile_id}
                style={{
                  marginLeft: i === 0 ? 0 : -FACE_OVERLAP,
                  borderRadius: radius.round,
                  borderWidth: 1,
                  borderColor: colors.cardPanel,
                }}
              >
                <PresenceAvatar uri={cardPicture(card)} name={card.display_name} size={FACE_SIZE} />
              </View>
            ))}
          </View>
        ) : null}
        {isLoading || hasHighlights ? <Text style={[type.label, { color: colors.voltDim }]}>Highlights</Text> : null}
        {hasHighlights ? (
          <Text style={[type.tick, { color: colors.textMuted, flexShrink: 1 }]} numberOfLines={1}>
            {`${highlightsCountLabel(cards.length)} ›`}
          </Text>
        ) : null}
        <View style={{ flex: 1 }} />
        {quotaText ? (
          <Text style={[type.tick, { color: colors.textMuted }]} numberOfLines={1}>
            {quotaText}
          </Text>
        ) : null}
      </Pressable>

      <Sheet visible={sheetVisible} onClose={() => setSheetVisible(false)} title="Highlights">
        <Text style={[type.caption, { color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.md }]}>
          Picked for you today.
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -spacing.lg }}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        >
          {cards.map((card) => (
            <Pressable
              key={card.profile_id}
              onPress={() => handlePick(card)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${card.display_name}`}
              style={{ width: SHEET_FACE_SIZE + spacing.sm, alignItems: "center", gap: spacing.xs }}
            >
              <PresenceAvatar
                uri={cardPicture(card)}
                name={card.display_name}
                size={SHEET_FACE_SIZE}
                isActive={card.isRecentlyActive}
              />
              <Name variant="body" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18, color: colors.text }}>
                {card.display_name}
              </Name>
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>

      <StandoutCardModal
        card={openCard}
        onClose={() => setOpenCard(null)}
        onResolved={(profileId) => {
          removeCard(profileId);
          setOpenCard(null);
        }}
      />
    </>
  );
}
