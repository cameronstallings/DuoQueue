import { Text, View } from "react-native";

import { SectionLabel } from "@/components/SectionLabel";
import { TILT_HANDLING_LABELS } from "@/features/onboarding/profile-labels";
import type { DeckCard } from "@/features/swipe/types";
import { useTheme } from "@/theme/useTheme";

const AXES: { key: "intensity" | "commsStyle" | "coachingPref"; left: string; right: string }[] = [
  { key: "intensity", left: "Chill", right: "Sweaty ranked grind" },
  { key: "commsStyle", left: "Quiet", right: "Mic on constantly" },
  { key: "coachingPref", left: "Don't coach me", right: "Coach me" },
];

function VibeBar({ left, right, pct }: { left: string; right: string; pct: number }) {
  const { colors, radius, type } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={[type.caption, { color: colors.textMuted }]}>{left}</Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>{right}</Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: radius.round,
          backgroundColor: colors.surfaceAlt,
          overflow: "hidden",
        }}
      >
        <View style={{ height: 6, width: `${pct}%`, backgroundColor: colors.accent, borderRadius: radius.round }} />
      </View>
    </View>
  );
}

/**
 * Three read-only sliders (intensity, comms style, coaching preference) plus a
 * tilt-handling sentence underneath. Renders nothing when there's no vibe data —
 * both the own-profile and stranger-profile call sites can pass `null` straight
 * through without a conditional wrapper.
 */
export function VibeSection({
  vibe,
  /** Own-profile-only polish: a 1px hairline above the tilt sentence so it reads as a
   * footer under the bars rather than a fourth bar. Opt-in and off by default so the
   * stranger-profile call site (ProfileDetailContent) renders exactly as before. */
  footerDivider = false,
}: {
  vibe: DeckCard["vibe"];
  footerDivider?: boolean;
}) {
  const { colors, spacing, type } = useTheme();

  if (!vibe) return null;

  return (
    <View>
      <SectionLabel>Vibe</SectionLabel>
      <View style={{ gap: spacing.sm }}>
        {AXES.map((axis) => (
          <VibeBar key={axis.key} left={axis.left} right={axis.right} pct={vibe[axis.key]} />
        ))}
        <View
          style={
            footerDivider
              ? { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }
              : undefined
          }
        >
          <Text style={[type.body, { color: colors.text }]}>
            After a losing streak: {TILT_HANDLING_LABELS[vibe.tiltHandling]}
          </Text>
        </View>
      </View>
    </View>
  );
}
