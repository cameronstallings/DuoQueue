import { useMemo } from "react";
import Animated, { type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { type BracketGlyph, bracketLayout } from "@/features/launch/launchBrackets";

interface LockBracketsProps {
  /** The rings' width, in points. The brackets are sized and placed to it: at DUO LOCKED's 168
   * (MATCH_MARK_W) they are BRACKET_SIZE, BRACKET_SIDE and BRACKET_TRAVEL exactly, and the launch
   * intro's mark scales all three. */
  markWidth: number;
  /** 0 = each bracket all the way out (BRACKET_TRAVEL, scaled), 1 = home. */
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  /** The ink: the theme's volt on the match screen, the dark splash palette's in the launch intro. */
  color: string;
}

/**
 * DUO LOCKED's "[" and "]", on the match screen and in the launch intro alike: IBM Plex Mono
 * SemiBold's own bracket outlines (launchBrackets.ts), drawn as paths rather than set as Text. A
 * Text at 96/96 left the ink to the line box, which is 1.3 em in this face, so iOS dropped the
 * glyph to the box's floor and cut the top of its arms off; a path has no line box, needs no font
 * loaded, and every point of it is inside its own Svg, so nothing can be clipped.
 *
 * Render it inside the mark's own box (the rings' width and height). Each bracket's Svg is the
 * lock box, centred on the mark (bracketLayout explains why), with the "[" at its left edge and
 * the "]" at its right, as the Texts were, and the ink centred on the rings.
 */
export function LockBrackets({ markWidth, progress, opacity, color }: LockBracketsProps) {
  return (
    <>
      <LockBracket glyph="[" markWidth={markWidth} progress={progress} opacity={opacity} color={color} />
      <LockBracket glyph="]" markWidth={markWidth} progress={progress} opacity={opacity} color={color} />
    </>
  );
}

function LockBracket({
  glyph,
  markWidth,
  progress,
  opacity,
  color,
}: {
  glyph: BracketGlyph;
  markWidth: number;
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
}) {
  const { left, width, height, viewBox, path, outX } = useMemo(() => bracketLayout(glyph, markWidth), [glyph, markWidth]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: (1 - progress.value) * outX }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ position: "absolute", top: 0, left, width, height }, style]}
    >
      <Svg width={width} height={height} viewBox={viewBox}>
        <Path d={path} fill={color} />
      </Svg>
    </Animated.View>
  );
}
