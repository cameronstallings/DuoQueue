import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  Keyframe,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Name } from "@/components/Name";
import { useTheme } from "@/theme/useTheme";

import type { CardCell } from "./cardChips";

/** Cell widths from the design (124 / 98 / 85 at 345pt), as flex ratios so an SE still fits. */
const CELL_FLEX = [124, 98, 85] as const;
const CELL_STAGGER_MS = 40;
const CELLS_HEIGHT = 40;
const PLATE_INSET = 14;
const TRACK_GAP = 4;
/** Full spring config on purpose: Reanimated 4 merges a partial config over mass 4 /
 * stiffness 900, which wobbles for seconds. Damping ratio ~0.67. */
const PRESS_SPRING = { mass: 1, stiffness: 380, damping: 26 } as const;

/** Each cell prints in: fade plus a 4pt lift, 140ms, 40ms apart. Reduce Motion: a plain fade. */
function cellEntering(index: number, reduced: boolean, duration: number) {
  const delay = index * CELL_STAGGER_MS;
  if (reduced) return FadeIn.duration(duration).delay(delay).reduceMotion(ReduceMotion.Never);
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 4 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }] },
  })
    .duration(duration)
    .delay(delay);
}

/** 2pt segments under the picture; the current one in text ink (not volt) slides over 200ms. */
function PageTrack({ count, index }: { count: number; index: number }) {
  const { colors, motion } = useTheme();
  const [width, setWidth] = useState(0);
  const position = useSharedValue(index);

  useEffect(() => {
    position.value = withTiming(index, { duration: motion.base });
  }, [index, position, motion.base]);

  const segment = count > 0 ? (width - TRACK_GAP * (count - 1)) / count : 0;
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * (segment + TRACK_GAP) }],
  }));

  if (count <= 1) return <View style={{ height: 2 }} />;

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 2, flexDirection: "row", gap: TRACK_GAP }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: colors.cardEdge }} />
      ))}
      {width > 0 && (
        <Animated.View
          style={[{ position: "absolute", left: 0, top: 0, height: 2, width: segment, backgroundColor: colors.text }, indicatorStyle]}
        />
      )}
    </View>
  );
}

interface CardPlateProps {
  name: string;
  details: string;
  isActive: boolean;
  cells: CardCell[];
  pageCount: number;
  pageIndex: number;
  /** Cells mount (and print in) only on the interactive card; others keep an empty row. */
  showCells: boolean;
  profileRow: boolean;
  onOpenProfile?: () => void;
  onMenu?: () => void;
}

/**
 * The solid plate under the picture. Every line of text on a card lives here or on a recessed
 * prompt page, so none of it depends on the image. The whole plate opens the full profile and
 * dips to 98% while pressed; "•••" (Report, Block) keeps a 44pt target inside it.
 */
export function CardPlate({
  name,
  details,
  isActive,
  cells,
  pageCount,
  pageIndex,
  showCells,
  profileRow,
  onOpenProfile,
  onMenu,
}: CardPlateProps) {
  const { colors, motion, radius, spacing, type } = useTheme();
  const reduced = useReducedMotion();
  const dip = useSharedValue(1);
  const dipStyle = useAnimatedStyle(() => ({ transform: [{ scale: dip.value }] }));
  const flexes: readonly number[] = cells.length === 3 ? CELL_FLEX : cells.map(() => 1);

  return (
    <Pressable
      // Not an accessibility element itself, so VoiceOver still reaches "•••" and the
      // labelled SEE FULL PROFILE row inside it.
      accessible={false}
      disabled={!onOpenProfile}
      onPress={onOpenProfile}
      onPressIn={() => {
        if (!reduced) dip.value = withSpring(0.98, PRESS_SPRING);
      }}
      onPressOut={() => {
        dip.value = withSpring(1, PRESS_SPRING);
      }}
    >
      <Animated.View style={[{ paddingHorizontal: PLATE_INSET, paddingTop: spacing.sm, paddingBottom: spacing.tight }, dipStyle]}>
        <PageTrack count={pageCount} index={pageIndex} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.tight }}>
          <Name variant="screenTitle" numberOfLines={1} style={{ color: colors.text, flexShrink: 1 }}>
            {name}
          </Name>
          {isActive ? (
            <View
              accessible
              accessibilityLabel="Active recently"
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }}
            />
          ) : null}
          <View style={{ flex: 1 }} />
          {onMenu ? (
            <Pressable
              onPress={onMenu}
              accessibilityRole="button"
              accessibilityLabel="Report or block"
              hitSlop={8}
              style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Text style={[type.cardMeta, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {details}
        </Text>

        <View style={{ flexDirection: "row", height: CELLS_HEIGHT, marginTop: spacing.tight }}>
          {showCells
            ? cells.map((cell, i) => {
                const edgeWidth = cell.lit ? 2 : i === 0 ? 0 : 1;
                return (
                  <Animated.View
                    key={cell.key}
                    entering={cellEntering(i, reduced, motion.quick)}
                    accessible
                    accessibilityLabel={cell.accessibilityLabel}
                    style={{
                      flex: flexes[i] ?? 1,
                      justifyContent: "center",
                      borderLeftWidth: edgeWidth,
                      borderLeftColor: cell.lit ? colors.volt : colors.cardEdge,
                      paddingLeft: edgeWidth === 0 ? 0 : spacing.tight - (edgeWidth - 1),
                      paddingRight: spacing.xs,
                    }}
                  >
                    <Text style={[type.tick, { color: colors.textMuted }]} numberOfLines={1}>
                      {cell.label}
                    </Text>
                    {cell.lit ? (
                      <View
                        style={{
                          alignSelf: "flex-start",
                          marginTop: spacing.xs,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: radius.chip,
                          backgroundColor: colors.cardLitFill,
                        }}
                      >
                        <Text style={[type.label, { color: colors.cardLitInk }]}>{cell.value}</Text>
                      </View>
                    ) : (
                      <Text style={[type.bodyStrong, { color: colors.text, marginTop: 2 }]} numberOfLines={1}>
                        {cell.value}
                      </Text>
                    )}
                  </Animated.View>
                );
              })
            : null}
        </View>

        {profileRow ? (
          <Pressable
            disabled={!onOpenProfile}
            onPress={onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel="See full profile"
            hitSlop={8}
            style={{ marginTop: spacing.sm, alignSelf: "center", paddingVertical: 2 }}
          >
            <Text style={[type.label, { color: colors.textMuted }]}>See full profile ›</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}
