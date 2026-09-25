import { type ReactNode, useState } from "react";
import {
  AccessibilityInfo,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";

import { PlayerMark } from "@/components/PlayerMark";
import { PLATFORM_LABELS, PLAYSTYLE_LABELS, SKILL_LABELS } from "@/features/onboarding/profile-labels";
import { useTheme } from "@/theme/useTheme";

import { type CardCell, type CardPage, type CellLabels, cardPagePosition, cardPageSpoken } from "./cardChips";
import { CARD_DIM_OPACITY, CardPlate } from "./CardPlate";

export const CARD_CELL_LABELS: CellLabels = {
  skill: SKILL_LABELS,
  platform: PLATFORM_LABELS,
  playstyle: PLAYSTYLE_LABELS,
};

/** Space a prompt page keeps around its text: 20pt padding each side and an 8pt gap (fixed),
 * plus the 14pt label line and the 30pt answer lines, which both grow with the text size. */
const PROMPT_FIXED_CHROME = 48;
const PROMPT_LABEL_LINE = 14;
const PROMPT_LINE = 30;

/** The own-card status tag sits this far in from the picture's top-left corner. */
const STATUS_TAG_INSET = 10;
/** The tag's height before it is measured: a 12pt tick line, 5pt padding and a 1pt border each side. */
const STATUS_TAG_HEIGHT = 24;
/** 24pt tag + 10pt each side = a 44pt target when the tag is a button. */
const STATUS_TAG_HIT_SLOP = 10;

/**
 * `clearTop` is how far down a prompt page's text must start so the status tag (drawn over
 * every page) never covers the question. 0 when there is no tag. The picture and blank pages
 * ignore it.
 */
function CardPageView({ page, name, clearTop }: { page: CardPage; name: string; clearTop: number }) {
  const { colors, spacing, type } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [size, setSize] = useState({ width: 0, height: 0 });

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  if (page.kind === "picture") {
    return (
      <Image
        source={typeof page.url === "number" ? page.url : { uri: page.url }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${name}'s picture`}
      />
    );
  }

  if (page.kind === "blank") {
    const markSize = Math.min(size.width, size.height);
    return (
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} onLayout={handleLayout}>
        {markSize > 0 && <PlayerMark name={name} size={markSize} shape="none" color={colors.cardMark} glyphScale={0.8} />}
      </View>
    );
  }

  const markSize = size.height;
  const pagePadding = spacing.lg - spacing.xs;
  const paddingTop = Math.max(pagePadding, clearTop);
  // Line heights scale with Dynamic Type, so the count does too; at 1x this is the old 62 / 30.
  const chrome = PROMPT_FIXED_CHROME + PROMPT_LABEL_LINE * fontScale + (paddingTop - pagePadding);
  const lineHeight = PROMPT_LINE * fontScale;
  const answerLines = size.height > 0 ? Math.max(2, Math.min(6, Math.floor((size.height - chrome) / lineHeight))) : 6;
  return (
    <View style={StyleSheet.absoluteFill} onLayout={handleLayout}>
      {markSize > 0 && (
        <View pointerEvents="none" style={{ position: "absolute", right: -markSize * 0.15, bottom: -markSize * 0.3 }}>
          <PlayerMark name={name} size={markSize} shape="none" color={colors.cardMark} glyphScale={0.9} />
        </View>
      )}
      <View style={{ padding: pagePadding, paddingTop, gap: spacing.sm }}>
        {page.question ? (
          <Text style={[type.label, { color: colors.cardRecessedMuted }]} numberOfLines={2}>
            {page.question}
          </Text>
        ) : null}
        <Text style={[type.promptHero, { color: colors.text }]} numberOfLines={answerLines}>
          {page.answer}
        </Text>
      </View>
    </View>
  );
}

export interface CardFaceProps {
  name: string;
  details: string;
  isActive: boolean;
  pages: CardPage[];
  cells: CardCell[];
  interactive: boolean;
  profileRow: boolean;
  onOpenProfile?: () => void;
  onMenu?: () => void;
  statusTag?: string | null;
  /** Makes the status tag a button (your own card's "ADD A PICTURE" goes to Edit). */
  statusTagAction?: { accessibilityLabel: string; onPress: () => void } | null;
  pictureOverlay?: ReactNode;
  /** After a tap turns the page (the tour fades its hint on the first one). */
  onPageChange?: (index: number) => void;
  /** Only these cells at full strength; the picture and the rest dim (the tour's Can duo page). */
  focusCells?: readonly CardCell["key"][];
}

/**
 * The card: a clean picture area over a solid plate. Nothing is drawn on the picture except the
 * drag stamps (passed in as `pictureOverlay`) and, on your own card only, the status tag. Pages
 * are [picture?, prompt 1, prompt 2, prompt 3]: tap the right third to go forward, the left third
 * to go back; the middle third is inert. Used by the Deck, the party deck and the Profile tab.
 */
export function CardFace({
  name,
  details,
  isActive,
  pages,
  cells,
  interactive,
  profileRow,
  onOpenProfile,
  onMenu,
  statusTag,
  statusTagAction,
  pictureOverlay,
  onPageChange,
  focusCells,
}: CardFaceProps) {
  const { colors, motion, radius, spacing, type } = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  // Measured so a larger text size still clears the tag; starts at the default-size height.
  const [tagHeight, setTagHeight] = useState(STATUS_TAG_HEIGHT);
  const lastIndex = Math.max(pages.length - 1, 0);
  const index = Math.min(pageIndex, lastIndex);
  const page: CardPage = pages[index] ?? { kind: "blank" };
  const clearTop = statusTag ? STATUS_TAG_INSET + tagHeight + spacing.sm : 0;

  function goTo(next: number) {
    const target = Math.min(Math.max(next, 0), lastIndex);
    if (target === index) return;
    setPageIndex(target);
    onPageChange?.(target);
    // VoiceOver keeps focus on the tap zone while the page under it changes, so say the new
    // page. Queued (iOS) so the button's own feedback does not cut it off; Android ignores the
    // option. No-op without a screen reader.
    const spoken = cardPageSpoken(pages[target] ?? { kind: "blank" }, name, target, pages.length);
    AccessibilityInfo.announceForAccessibilityWithOptions(spoken, { queue: true });
  }

  const position = cardPagePosition(index, pages.length);
  const tagSurface = { borderRadius: radius.chip, borderColor: colors.cardEdge, backgroundColor: colors.cardHero };

  return (
    <View
      style={[
        styles.card,
        { borderRadius: radius.card, borderColor: colors.cardEdge, backgroundColor: colors.cardHero, padding: spacing.xs },
      ]}
    >
      <View
        style={[
          styles.picture,
          { borderRadius: radius.picture, backgroundColor: colors.cardRecessed, opacity: focusCells ? CARD_DIM_OPACITY : 1 },
        ]}
      >
        {/* Keyed by page, so a page turn is a 140ms cross-fade (a fade, so it stays on under
            Reduce Motion). */}
        <Animated.View
          key={`${index}-${page.kind}`}
          entering={FadeIn.duration(motion.quick).reduceMotion(ReduceMotion.Never)}
          exiting={FadeOut.duration(motion.quick).reduceMotion(ReduceMotion.Never)}
          style={StyleSheet.absoluteFill}
        >
          <CardPageView page={page} name={name} clearTop={clearTop} />
        </Animated.View>

        {interactive && pages.length > 1 && (
          <>
            {/* The page track is hidden from VoiceOver, so the zones carry the position. At the
                ends only accessibilityState says disabled ("dimmed"); the touch handling for
                sighted players stays as it was, and goTo ignores a turn past either end. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              accessibilityValue={{ text: position }}
              accessibilityState={{ disabled: index === 0 }}
              onPress={() => goTo(index - 1)}
              style={styles.tapZoneLeft}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next page"
              accessibilityValue={{ text: position }}
              accessibilityState={{ disabled: index === lastIndex }}
              onPress={() => goTo(index + 1)}
              style={styles.tapZoneRight}
            />
          </>
        )}

        {/* A button only when it has somewhere to go; otherwise a plain View, so VoiceOver
            does not call it "dimmed" and taps pass through to the page zones. */}
        {statusTag && statusTagAction ? (
          <Pressable
            onPress={statusTagAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={statusTagAction.accessibilityLabel}
            hitSlop={STATUS_TAG_HIT_SLOP}
            onLayout={(e) => setTagHeight(e.nativeEvent.layout.height)}
            style={({ pressed }) => [styles.statusTag, tagSurface, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[type.tick, { color: colors.textMuted }]}>{statusTag}</Text>
          </Pressable>
        ) : statusTag ? (
          <View
            pointerEvents="none"
            onLayout={(e) => setTagHeight(e.nativeEvent.layout.height)}
            style={[styles.statusTag, tagSurface]}
          >
            <Text style={[type.tick, { color: colors.textMuted }]}>{statusTag}</Text>
          </View>
        ) : null}

        {pictureOverlay}
      </View>

      <CardPlate
        name={name}
        details={details}
        isActive={isActive}
        cells={cells}
        pageCount={pages.length}
        pageIndex={index}
        showCells={interactive}
        profileRow={profileRow}
        onOpenProfile={interactive ? onOpenProfile : undefined}
        onMenu={interactive ? onMenu : undefined}
        focusCells={focusCells}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
  },
  picture: {
    flex: 1,
    overflow: "hidden",
  },
  tapZoneLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "34%",
  },
  tapZoneRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: "34%",
  },
  statusTag: {
    position: "absolute",
    top: STATUS_TAG_INSET,
    left: STATUS_TAG_INSET,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
