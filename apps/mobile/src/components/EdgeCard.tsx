import { Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/theme/useTheme";

interface EdgeCardProps {
  title: string;
  body?: string;
  primaryLabel: string;
  onPrimary: () => void;
  /** Pulses the primary label while its action is in flight (Button's busy state). */
  primaryLoading?: boolean;
  /** "Not now" on every ask that interrupts. Settings' standing banner has none. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * THE callout for an ask: the notification pre-ask on the deck and on DUO LOCKED, the banner in
 * Settings > Notifications, and the Duo Pops opt-in card. One idiom, so an ask always looks like
 * an ask and never like content.
 *
 * Emphasis is the 2px volt edge-bar down the left (the chat's session banner idiom), never a glow,
 * a blur or a coloured shadow: the card itself is the ordinary solid surface with its 1px seam.
 * Then a bold title, an optional muted line, and a primary sm button with an optional ghost one
 * beside it.
 *
 * Static on purpose: each caller decides how it arrives (a spring up over the deck, a fade on
 * DUO LOCKED, a reveal in Settings), so the motion lives with the moment, not in here.
 */
export function EdgeCard({
  title,
  body,
  primaryLabel,
  onPrimary,
  primaryLoading,
  secondaryLabel,
  onSecondary,
}: EdgeCardProps) {
  const { colors, spacing, type } = useTheme();

  return (
    <Card style={{ flexDirection: "row", padding: 0, overflow: "hidden" }}>
      <View style={{ width: 2, backgroundColor: colors.volt }} />
      <View style={{ flex: 1, padding: spacing.md, gap: spacing.sm }}>
        <Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
        {body ? <Text style={[type.caption, { color: colors.textMuted }]}>{body}</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Button size="sm" variant="primary" label={primaryLabel} onPress={onPrimary} loading={primaryLoading} />
          {secondaryLabel && onSecondary ? (
            <Button size="sm" variant="ghost" label={secondaryLabel} onPress={onSecondary} />
          ) : null}
        </View>
      </View>
    </Card>
  );
}
