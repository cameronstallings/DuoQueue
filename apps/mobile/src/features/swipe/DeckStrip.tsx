import { useCallback, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated from "react-native-reanimated";

import { Name } from "@/components/Name";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { Sheet } from "@/components/Sheet";
import { Skeleton } from "@/components/Skeleton";
import { quickEntering } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

import { cardPicture } from "./cardChips";
// Not "./deckStrip": that differs from this file's name only in case, and on a case-insensitive
// disk (Windows, the Mac that builds the app) "@/features/swipe/DeckStrip" would resolve to it.
import {
  STRIP_FACE_OVERLAP as FACE_OVERLAP,
  STRIP_FACE_SIZE as FACE_SIZE,
  STRIP_MAX_FONT_SCALE,
  highlightsCountLabel,
  stripIsCompact,
  stripQuotaLabel,
  type StripQuota,
} from "./deckStripCopy";
import { StandoutCardModal } from "./StandoutCardModal";
import type { DeckCard } from "./types";
import { useStandouts } from "./useStandouts";

const STRIP_HEIGHT = 32;
const SHEET_FACE_SIZE = 64;

/**
 * The Deck's one-line chrome: three Highlights faces, "HIGHLIGHTS", "4 PICKED TODAY ›" and the
 * swipes left. It replaces the ~145pt Highlights row so the card gets the room. Tapping opens the
 * Highlights sheet; a face there opens that player's full profile with Pass and Duo, as before.
 */
export function DeckStrip({ quota }: { quota: StripQuota | undefined }) {
  const { colors, radius, spacing, type } = useTheme();
  const { width } = useWindowDimensions();
  const { cards, isLoading, removeCard } = useStandouts();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [openCard, setOpenCard] = useState<DeckCard | null>(null);
  const hasHighlights = cards.length > 0;
  // The short copy only when "4 PICKED TODAY ›" shares the row; alone, the full copy fits.
  const quotaText = stripQuotaLabel(quota, stripIsCompact(width, hasHighlights));
  // VoiceOver gets the full copy even where the strip shows "18 LEFT" or "UNLIMITED". A label
  // replaces the children's text, so with Highlights it carries the swipes left too.
  const quotaSpoken = stripQuotaLabel(quota, false);
  const spokenLabel = hasHighlights
    ? `Highlights, ${highlightsCountLabel(cards.length)}${quotaSpoken ? `. ${quotaSpoken}` : ""}`
    : quotaSpoken || undefined;
  // No Highlights and no swipes count (its query failed): no empty bordered bar.
  const showStrip = isLoading || hasHighlights || !!quotaText;

  // iOS drops a modal presented while another is still sliding out, so the picked card waits
  // for the sheet's onDismiss (iOS only). Android stacks its dialogs and has no onDismiss, so
  // there the card opens at once.
  const pendingCardRef = useRef<DeckCard | null>(null);

  // The sheet and the card are drawn over the whole window, not inside the Deck, so leaving the
  // Deck (a tapped message push switching to Matches, say) would leave them presented over
  // wherever the app went. Closed on blur rather than hidden, so coming back does not reopen
  // them; and a card still waiting on the sheet's dismissal is dropped, or that dismissal would
  // open it over the other screen.
  useFocusEffect(
    useCallback(
      () => () => {
        pendingCardRef.current = null;
        setSheetVisible(false);
        setOpenCard(null);
      },
      [],
    ),
  );

  function handlePick(card: DeckCard) {
    setSheetVisible(false);
    if (Platform.OS === "ios") {
      pendingCardRef.current = card;
    } else {
      setOpenCard(card);
    }
  }

  function handleSheetDismissed() {
    const card = pendingCardRef.current;
    pendingCardRef.current = null;
    if (card) setOpenCard(card);
  }

  return (
    <>
      {/* No `disabled` without Highlights: VoiceOver would call the swipes left "dimmed". With no
          onPress and no role it reads as plain text, and the pressed fade is skipped below. */}
      <Pressable
        onPress={hasHighlights ? () => setSheetVisible(true) : undefined}
        accessibilityRole={hasHighlights ? "button" : undefined}
        accessibilityLabel={spokenLabel}
        accessibilityHint={hasHighlights ? "Opens today's Highlights" : undefined}
        style={({ pressed }) => ({
          display: showStrip ? "flex" : "none",
          height: STRIP_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.picture,
          borderWidth: 1,
          borderColor: colors.cardEdge,
          backgroundColor: colors.cardPanel,
          opacity: pressed && hasHighlights ? 0.8 : 1,
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
          // The faces, the count and the swipes left fade in when they arrive instead of popping
          // into the strip a frame after it draws.
          <Animated.View entering={quickEntering()} style={{ flexDirection: "row" }}>
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
          </Animated.View>
        ) : null}
        {/* The three texts do not grow with Dynamic Type (STRIP_MAX_FONT_SCALE): the fit sums
            hold only at 1x and the strip is a fixed 32pt tall. */}
        {isLoading || hasHighlights ? (
          <Text style={[type.label, { color: colors.voltDim }]} maxFontSizeMultiplier={STRIP_MAX_FONT_SCALE}>
            Highlights
          </Text>
        ) : null}
        {hasHighlights ? (
          <Animated.Text
            entering={quickEntering()}
            style={[type.tick, { color: colors.textMuted, flexShrink: 1 }]}
            numberOfLines={1}
            maxFontSizeMultiplier={STRIP_MAX_FONT_SCALE}
          >
            {`${highlightsCountLabel(cards.length)} ›`}
          </Animated.Text>
        ) : null}
        {/* An auto margin, not a flex spacer: a spacer View would add a fourth 8pt gap. */}
        {quotaText ? (
          <Animated.Text
            entering={quickEntering()}
            style={[type.tick, { color: colors.textMuted, marginLeft: "auto" }]}
            numberOfLines={1}
            maxFontSizeMultiplier={STRIP_MAX_FONT_SCALE}
          >
            {quotaText}
          </Animated.Text>
        ) : null}
      </Pressable>

      <Sheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onDismiss={handleSheetDismissed}
        title="Highlights"
      >
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
