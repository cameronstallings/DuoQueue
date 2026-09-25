import type { ComponentProps } from "react";
import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PLATFORM_LABELS, PLAYSTYLE_LABELS, SKILL_LABELS } from "@/features/onboarding/profile-labels";
import { useEditableProfileDetails } from "@/features/profile/useEditableProfileDetails";
import { FREE_DAILY_SWIPES } from "@/features/swipe/deckStripCopy";
import { useSwipeQuota } from "@/features/swipe/useSwipeQuota";
import { useSessionStore } from "@/store/session-store";
import { useTheme } from "@/theme/useTheme";

import { PageHeading } from "./PageHeading";
import {
  DECK_COPY,
  FILTER_ANY,
  deckIllustrationLabel,
  deckPageHeading,
  filterPreviewRows,
  type FilterPreviewRow,
  type PaywallFrom,
} from "./paywallCopy";

const FILTER_ICONS: Record<FilterPreviewRow["key"], ComponentProps<typeof Ionicons>["name"]> = {
  game: "game-controller-outline",
  platform: "desktop-outline",
  skill: "trophy-outline",
  playstyle: "mic-outline",
  active: "time-outline",
};

/** How far this picture's 9pt ticks follow a larger text size. Unlike the Deck's own strip
 * (fixed at 32pt, its fit sums hold only at 1x), this one has nothing beside the two ticks, so it
 * grows with them (minHeight) and nothing is cut. */
const STRIP_TEXT_SCALE_MAX = 1.3;

/** A strip in the Deck's own panel style, drawn as a picture: no chevron, no press. */
function SwipesStrip({ tick, value, lit }: { tick: string; value: string; lit: boolean }) {
  const { colors, radius, spacing, type } = useTheme();
  return (
    <View
      style={{
        minHeight: 32,
        paddingVertical: spacing.xs,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.sm,
        borderRadius: radius.picture,
        borderWidth: 1,
        borderColor: lit ? colors.voltDim : colors.cardEdge,
        backgroundColor: colors.cardPanel,
      }}
    >
      <Text style={[type.tick, { color: colors.textMuted }]} maxFontSizeMultiplier={STRIP_TEXT_SCALE_MAX}>
        {tick}
      </Text>
      <Text style={[type.tick, { color: lit ? colors.voltDim : colors.textMuted }]} maxFontSizeMultiplier={STRIP_TEXT_SCALE_MAX}>
        {value}
      </Text>
    </View>
  );
}

/** A filter as a preview: muted value and a lock, never a chevron, so it cannot look tappable
 * or read like a current setting (check.md #7). */
function FilterPreview({ row, first }: { row: FilterPreviewRow; first: boolean }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.tight,
        paddingHorizontal: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.cardEdge,
      }}
    >
      <Ionicons name={FILTER_ICONS[row.key]} size={19} color={colors.textMuted} />
      <Text style={[type.body, { color: colors.text, flex: 1 }]}>{row.label}</Text>
      {/* Two lines, so "League of Legends" is never cut at a larger text size. */}
      <Text style={[type.caption, { color: colors.textMuted, flexShrink: 1, textAlign: "right" }]} numberOfLines={2}>
        {row.value ?? FILTER_ANY}
      </Text>
      <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
    </View>
  );
}

/** Page 1 for most entries: the day's swipes (the player's real quota) and the DuoQueue+ filters
 * prefilled from their profile. No price, no buy button. */
export function DeckPage({ from, bottomInset }: { from: PaywallFrom; bottomInset: number }) {
  const { colors, radius, spacing, type } = useTheme();
  const userId = useSessionStore((s) => s.session?.user.id);
  const { data: quota } = useSwipeQuota();
  const { data: details } = useEditableProfileDetails(userId);
  const limit = quota?.swipes_limit ?? FREE_DAILY_SWIPES;
  // From the limit the server has just refused a swipe, so the free strip reads 0 whatever the
  // cache holds: the refetch after the 25th swipe can still be in flight when the 26th fails,
  // and "1 LEFT" under "25 OF 25 SWIPES USED" would contradict itself.
  const left = from === "limit" ? 0 : quota ? Math.max(limit - quota.swipes_used, 0) : limit;
  const rows = filterPreviewRows(details, { skill: SKILL_LABELS, platform: PLATFORM_LABELS, playstyle: PLAYSTYLE_LABELS });

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: bottomInset, gap: spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeading copy={deckPageHeading(from, limit)} />
      {/* A picture of the product, not controls: VoiceOver gets one summary instead. */}
      <View accessible accessibilityLabel={deckIllustrationLabel(left, limit)} style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={[type.label, { color: colors.textMuted }]}>{DECK_COPY.swipesToday}</Text>
          <SwipesStrip tick={DECK_COPY.free} value={DECK_COPY.left(left)} lit={false} />
          <SwipesStrip tick={DECK_COPY.withPlus} value={DECK_COPY.unlimited} lit />
        </View>
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}>
            <Text style={[type.label, { color: colors.textMuted }]}>{DECK_COPY.filters}</Text>
            {/* Shrinks and wraps on the right, so a larger text size never runs it off the page. */}
            <Text style={[type.tick, { color: colors.textMuted, flexShrink: 1, textAlign: "right" }]}>{DECK_COPY.preview}</Text>
          </View>
          <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: colors.cardEdge, backgroundColor: colors.cardPanel }}>
            {rows.map((row, i) => (
              <FilterPreview key={row.key} row={row} first={i === 0} />
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
