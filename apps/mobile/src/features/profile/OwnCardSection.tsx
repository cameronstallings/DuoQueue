import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import { Button } from "@/components/Button";
import { SectionLabel } from "@/components/SectionLabel";
import { Skeleton } from "@/components/Skeleton";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { CARD_CELL_LABELS, CardFace } from "@/features/swipe/CardFace";
import { cardCells, cardDetailsLine, cardPages, cardPicture } from "@/features/swipe/cardChips";
import { useTheme } from "@/theme/useTheme";

import { cardNudge, completenessItems, nudgeText } from "./completeness";
import { PICTURE_TAG, ownPictureState } from "./pictureStatus";
import { OWN_CARD_CAPTION, OWN_CARD_HEIGHT, PAUSED_CARD_LINE, leagueRuleLine } from "./profileTab";
import { useEditableProfileDetails } from "./useEditableProfileDetails";
import { useOwnProfilePhotos } from "./useOwnProfilePhotos";
import { useOwnPrompts } from "./useOwnPrompts";
import { useProfileCard } from "./useProfileCard";

interface OwnCardSectionProps {
  profile: { id: string; is_active: boolean };
}

/** "ADD A PICTURE" and "PICTURE NOT APPROVED" open Edit, where the picture slot is. The nudge row
 * below leaves the picture out on purpose, so the tag is the way there. */
function pictureTagAction(tag: string | null) {
  if (tag === PICTURE_TAG.add) return { accessibilityLabel: "Add a picture", onPress: () => router.push("/edit-details") };
  if (tag === PICTURE_TAG.rejected) {
    return { accessibilityLabel: "Picture not approved. Pick another one", onPress: () => router.push("/edit-details") };
  }
  return null;
}

/**
 * HOW OTHERS SEE YOU: your card, built by the same pipeline strangers get (get_profile_card, then
 * enrichCandidates), so the rank, languages and prompts are what they read. Two things differ on
 * purpose: the picture is yours as uploaded (a pending one shows with its tag; a rejected one
 * never shows), and the card never lights, because "Can duo" is a fact about a pair.
 */
export function OwnCardSection({ profile }: OwnCardSectionProps) {
  const { colors, radius, spacing, type } = useTheme();
  const { data: card, isPending, isError, refetch } = useProfileCard(profile.id, { enabled: profile.is_active });
  const { data: photos } = useOwnProfilePhotos(profile.id);
  const { data: editable } = useEditableProfileDetails(profile.id);
  const { data: prompts } = useOwnPrompts(profile.id);

  const picture = photos ? ownPictureState(photos) : null;
  const games = editable?.games ?? [];
  const rule = leagueRuleLine(games);
  const nudge =
    editable && prompts
      ? cardNudge(
          completenessItems({
            hasPicture: picture?.hasPicture ?? false,
            games: games.length,
            shows: editable.shows.length,
            platforms: editable.platforms.length,
            playstyles: editable.playstyles.length,
            prompts: prompts.length,
          }),
        )
      : null;

  const panel = {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.cardEdge,
    backgroundColor: colors.cardPanel,
  } as const;

  function renderCard() {
    if (!profile.is_active) {
      return (
        <View style={panel}>
          <Text style={[type.body, { color: colors.text }]}>{PAUSED_CARD_LINE}</Text>
          <Pressable
            onPress={() => router.push("/settings/privacy")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Privacy settings"
          >
            <Text style={[type.label, { color: colors.voltDim }]}>Privacy settings ›</Text>
          </Pressable>
        </View>
      );
    }
    if (isPending) return <Skeleton height={OWN_CARD_HEIGHT} borderRadius={radius.card} />;
    if (isError || !card) {
      return (
        <View style={panel}>
          <Text style={[type.body, { color: colors.text }]}>Couldn&apos;t load your card.</Text>
          <View style={{ alignSelf: "flex-start" }}>
            <Button size="sm" variant="secondary" label="Try again" onPress={() => void refetch()} />
          </View>
        </View>
      );
    }
    const url = picture ? picture.url : cardPicture(card);
    return (
      <View style={{ height: OWN_CARD_HEIGHT }}>
        <CardFace
          name={card.display_name}
          details={cardDetailsLine(card, REGION_LABELS)}
          isActive={false}
          pages={cardPages(url, card.prompts)}
          cells={cardCells(card, { kind: "own", totalGames: games.length }, CARD_CELL_LABELS)}
          interactive
          profileRow={false}
          statusTag={picture?.tag ?? null}
          statusTagAction={pictureTagAction(picture?.tag ?? null)}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionLabel>How others see you</SectionLabel>
      {renderCard()}
      {picture?.note ? <Text style={[type.caption, { color: colors.textMuted }]}>{picture.note}</Text> : null}
      <Text style={[type.caption, { color: colors.textMuted }]}>{OWN_CARD_CAPTION}</Text>
      {rule ? <Text style={[type.caption, { color: colors.textMuted }]}>{rule}</Text> : null}
      {nudge ? (
        <Pressable
          onPress={() => router.push(nudge.route)}
          accessibilityRole="button"
          accessibilityLabel={nudgeText(nudge)}
          style={({ pressed }) => ({
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            borderRadius: radius.picture,
            borderWidth: 1,
            borderColor: colors.cardEdge,
            backgroundColor: colors.cardPanel,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={[type.caption, { color: colors.text, flex: 1 }]}>{nudgeText(nudge)}</Text>
          <Text style={[type.bodyStrong, { color: colors.textMuted }]}>›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
