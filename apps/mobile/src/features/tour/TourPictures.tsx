import { useState } from "react";
import { Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { LockBrackets } from "@/features/match/LockBrackets";
import { BRACKET_SIDE, MATCH_MARK_W } from "@/features/match/matchMoment";
import { RingsLock } from "@/features/match/RingsLock";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { OwnCard } from "@/features/profile/OwnCardSection";
import { CARD_CELL_LABELS, CardFace } from "@/features/swipe/CardFace";
import { cardCells, cardDetailsLine, cardPages, type CardPage } from "@/features/swipe/cardChips";
import { LOGO_MARK_ASPECT } from "@/theme/logo-geometry";
import { useTheme } from "@/theme/useTheme";

import { TapHint } from "./TapHint";
import {
  CAN_DUO_CAVEAT,
  EXAMPLE_TAG,
  KAI_PROMPTS,
  LOCKED_COPY,
  TOUR_FULL_CHAT_HEIGHT,
  exampleCard,
  tourChat,
  type TourCopy,
  type TourRankLine,
} from "./tourPages";

/** Kai's picture: abstract art bundled with the app (from assets/demo's triangle mesh), never a
 * person. */
const KAI_PICTURE: number = require("../../../assets/tour/kai.jpg");

const MARK_H = MATCH_MARK_W * LOGO_MARK_ASPECT;
const LOCK_BOX_W = MATCH_MARK_W + BRACKET_SIDE * 2;
/** The lock mark's width on a short phone's page 3. */
const SHORT_MARK_W = 128;

function kaiPages(): CardPage[] {
  return [{ kind: "picture", url: KAI_PICTURE }, ...cardPages(null, KAI_PROMPTS)];
}

/** The text block under every picture, top-aligned so the heading never jumps between pages. */
export function TourHeading({ copy }: { copy: TourCopy }) {
  const { colors, spacing, type } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.label, { color: colors.textMuted }]}>{copy.heading}</Text>
      <Text accessibilityRole="header" style={[type.screenTitle, { color: colors.text }]}>
        {copy.title}
      </Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{copy.body}</Text>
    </View>
  );
}

/** Page 1: Kai's real card, which really turns when tapped, with the hint until the first tap. */
export function CardTourPage({ height, rankLabel }: { height: number; rankLabel: string | null }) {
  const [tapped, setTapped] = useState(false);
  const card = exampleCard(rankLabel);
  return (
    <View style={{ height }}>
      <CardFace
        name={card.display_name}
        details={cardDetailsLine(card, REGION_LABELS, { withAge: false })}
        isActive={false}
        pages={kaiPages()}
        cells={cardCells(card, { kind: "deck", sharedGames: card.shared_games_count }, CARD_CELL_LABELS)}
        interactive
        profileRow={false}
        statusTag={EXAMPLE_TAG}
        onPageChange={() => setTapped(true)}
        pictureOverlay={<TapHint visible={!tapped} />}
      />
    </View>
  );
}

/** Page 2 (ranked League players in NA only): Kai dimmed but for the rank and the lit cell, then
 * the player's own rank line and the required caveat. */
export function CanDuoTourPage({ height, rankLabel, line }: { height: number; rankLabel: string; line: TourRankLine }) {
  const { colors, radius, spacing, type } = useTheme();
  const card = exampleCard(rankLabel);
  return (
    <View style={{ height, gap: spacing.md }}>
      <View style={{ flex: 1 }}>
        <CardFace
          name={card.display_name}
          details={cardDetailsLine(card, REGION_LABELS, { withAge: false })}
          isActive={false}
          pages={kaiPages()}
          cells={cardCells(card, { kind: "deck", sharedGames: card.shared_games_count }, CARD_CELL_LABELS)}
          interactive
          profileRow={false}
          statusTag={EXAMPLE_TAG}
          focusCells={["game", "duo"]}
        />
      </View>
      <View
        style={{
          padding: spacing.md,
          gap: spacing.xs,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.cardEdge,
          backgroundColor: colors.cardPanel,
        }}
      >
        <Text style={[type.label, { color: colors.textMuted }]}>{line.label}</Text>
        <Text style={[type.bodyStrong, { color: colors.text }]}>{line.rule}</Text>
        <Text style={[type.caption, { color: colors.textMuted }]}>{CAN_DUO_CAVEAT}</Text>
      </View>
    </View>
  );
}

function Bubble({ mine, text }: { mine: boolean; text: string }) {
  const { colors, radius, spacing, type } = useTheme();
  // The chat screen's own bubble shape (app/chat/[matchId].tsx): the tail corner tightens to 3.
  const shape = mine
    ? { borderBottomRightRadius: 3, backgroundColor: colors.bubbleOwn }
    : { borderBottomLeftRadius: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "78%",
        borderRadius: radius.md,
        paddingVertical: spacing.sm + 1,
        paddingHorizontal: spacing.md - 2,
        ...shape,
      }}
    >
      <Text style={[type.body, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

/** Page 3: the real DUO LOCKED mark at its end state, then a short neutral chat. */
export function LockedTourPage({ height }: { height: number }) {
  const { colors, radius, spacing, type } = useTheme();
  // RingsLock and LockBrackets with every value at 1: the locked mark, standing still, so there is
  // no motion to reduce.
  const locked = useSharedValue(1);
  // A short phone (an iPhone SE) draws the mark smaller so two whole bubbles still fit under it;
  // LockBrackets scales its brackets to the mark, as the launch intro's smaller mark does.
  const short = height < TOUR_FULL_CHAT_HEIGHT;
  const markW = short ? SHORT_MARK_W : MATCH_MARK_W;
  const markH = short ? SHORT_MARK_W * LOGO_MARK_ASPECT : MARK_H;
  const boxW = short ? SHORT_MARK_W + (BRACKET_SIDE * 2 * SHORT_MARK_W) / MATCH_MARK_W : LOCK_BOX_W;
  return (
    <View style={{ height, gap: spacing.md }}>
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: boxW, height: markH, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: markW, height: markH }}>
            <RingsLock width={markW} progress={locked} woven={locked} />
            <LockBrackets markWidth={markW} progress={locked} opacity={locked} color={colors.volt} />
          </View>
        </View>
        <Text style={{ ...type.label, fontSize: 14, lineHeight: 20, letterSpacing: 3, color: colors.volt }}>{LOCKED_COPY.stamp}</Text>
        <Text style={[type.body, { color: colors.text }]}>{LOCKED_COPY.line}</Text>
      </View>
      <View
        style={{
          flex: 1,
          overflow: "hidden",
          padding: spacing.md,
          gap: spacing.sm,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.cardEdge,
        }}
      >
        <Text style={[type.label, { color: colors.textMuted }]}>{LOCKED_COPY.chatLabel}</Text>
        {tourChat(height).map((line) => (
          <Bubble key={line.text} mine={line.from === "you"} text={line.text} />
        ))}
      </View>
    </View>
  );
}

/** Page 4: the player's own card through the Profile tab's code, tappable, with no age. */
export function YourCardTourPage({ height, profile }: { height: number; profile: { id: string; is_active: boolean } }) {
  return <OwnCard profile={profile} height={height} mode="tour" />;
}
