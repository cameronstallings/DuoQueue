import { Text, View } from "react-native";

import { Card } from "@/components/Card";
import { Name } from "@/components/Name";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { NAME_COPY } from "@/features/auth/frontDoorCopy";
import { useTheme } from "@/theme/useTheme";

interface CardPreviewProps {
  /** The name on the card. Empty shows the placeholder in textMuted. */
  name?: string;
  /** `cardPreviewLines(...).details`: "26 · NA East · en", drawn uppercase. AGES STAY. */
  details?: string;
  /** Up to 3 lines, "League of Legends · Gold II". */
  games?: readonly string[];
  /** Skeleton bars at the same sizes, for the commit's "Saving your card". */
  loading?: boolean;
  /** Defaults to "Your card". */
  label?: string;
  /** Defaults to "Your name". */
  placeholder?: string;
}

/**
 * The card being built, drawn the way the deck will show it (the name in the card face, the
 * details line in mono capitals with the age kept), so the player can see what Save will put in
 * front of other players. Used on Save (from `cardPreviewLines`), live on the name step, and as a
 * same-size skeleton while the commit runs. Pure layout: no data of its own.
 */
export function CardPreview({ name = "", details, games, loading, label, placeholder }: CardPreviewProps) {
  const { colors, spacing, type } = useTheme();
  const shownGames = (games ?? []).slice(0, 3);

  return (
    <Card style={{ gap: spacing.xs }}>
      <SectionLabel>{label ?? NAME_COPY.previewLabel}</SectionLabel>
      {loading ? (
        <View style={{ gap: spacing.sm }}>
          <Skeleton width="55%" height={type.cardName.lineHeight} />
          <Skeleton width="40%" height={type.cardMeta.lineHeight} />
          <Skeleton width="70%" height={type.body.lineHeight} />
          <Skeleton width="60%" height={type.body.lineHeight} />
        </View>
      ) : (
        <>
          {name.trim() ? (
            <Name variant="cardName" style={{ color: colors.text }} numberOfLines={1}>
              {name.trim()}
            </Name>
          ) : (
            <Text style={[type.cardName, { color: colors.textMuted }]} numberOfLines={1}>
              {placeholder ?? NAME_COPY.previewPlaceholder}
            </Text>
          )}
          {details ? (
            <Text style={[type.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {details}
            </Text>
          ) : null}
          {shownGames.map((line) => (
            <Text key={line} style={[type.body, { color: colors.text }]} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </>
      )}
    </Card>
  );
}
