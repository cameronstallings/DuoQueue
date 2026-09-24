import { type ReactNode, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";

import { PlayerMark } from "@/components/PlayerMark";
import { PLATFORM_LABELS, PLAYSTYLE_LABELS, SKILL_LABELS } from "@/features/onboarding/profile-labels";
import { useTheme } from "@/theme/useTheme";

import type { CardCell, CardPage, CellLabels } from "./cardChips";
import { CardPlate } from "./CardPlate";

export const CARD_CELL_LABELS: CellLabels = {
  skill: SKILL_LABELS,
  platform: PLATFORM_LABELS,
  playstyle: PLAYSTYLE_LABELS,
};

/** Space a prompt page keeps around its text: 20pt padding each side, a 14pt label, an 8pt gap. */
const PROMPT_CHROME = 62;
const PROMPT_LINE = 30;

function CardPageView({ page, name }: { page: CardPage; name: string }) {
  const { colors, spacing, type } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  function handleLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  if (page.kind === "picture") {
    return (
      <Image
        source={{ uri: page.url }}
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
  const answerLines = size.height > 0 ? Math.max(2, Math.min(6, Math.floor((size.height - PROMPT_CHROME) / PROMPT_LINE))) : 6;
  return (
    <View style={StyleSheet.absoluteFill} onLayout={handleLayout}>
      {markSize > 0 && (
        <View pointerEvents="none" style={{ position: "absolute", right: -markSize * 0.15, bottom: -markSize * 0.3 }}>
          <PlayerMark name={name} size={markSize} shape="none" color={colors.cardMark} glyphScale={0.9} />
        </View>
      )}
      <View style={{ padding: spacing.lg - spacing.xs, gap: spacing.sm }}>
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
  pictureOverlay?: ReactNode;
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
  pictureOverlay,
}: CardFaceProps) {
  const { colors, motion, radius, spacing, type } = useTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const lastIndex = Math.max(pages.length - 1, 0);
  const index = Math.min(pageIndex, lastIndex);
  const page: CardPage = pages[index] ?? { kind: "blank" };

  function goTo(next: number) {
    setPageIndex(Math.min(Math.max(next, 0), lastIndex));
  }

  return (
    <View
      style={[
        styles.card,
        { borderRadius: radius.card, borderColor: colors.cardEdge, backgroundColor: colors.cardHero, padding: spacing.xs },
      ]}
    >
      <View style={[styles.picture, { borderRadius: radius.picture, backgroundColor: colors.cardRecessed }]}>
        {/* Keyed by page, so a page turn is a 140ms cross-fade (a fade, so it stays on under
            Reduce Motion). */}
        <Animated.View
          key={`${index}-${page.kind}`}
          entering={FadeIn.duration(motion.quick).reduceMotion(ReduceMotion.Never)}
          exiting={FadeOut.duration(motion.quick).reduceMotion(ReduceMotion.Never)}
          style={StyleSheet.absoluteFill}
        >
          <CardPageView page={page} name={name} />
        </Animated.View>

        {interactive && pages.length > 1 && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              onPress={() => goTo(index - 1)}
              style={styles.tapZoneLeft}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next page"
              onPress={() => goTo(index + 1)}
              style={styles.tapZoneRight}
            />
          </>
        )}

        {statusTag ? (
          <View
            pointerEvents="none"
            style={[styles.statusTag, { borderRadius: radius.chip, borderColor: colors.cardEdge, backgroundColor: colors.cardHero }]}
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
    top: 10,
    left: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
