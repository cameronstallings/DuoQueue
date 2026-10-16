import { useState } from "react";
import { Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { Logo } from "@/components/Logo";
import { LockBrackets } from "@/features/match/LockBrackets";
import { BRACKET_SIDE, MATCH_MARK_W } from "@/features/match/matchMoment";
import { RingsLock } from "@/features/match/RingsLock";
import { REGION_LABELS } from "@/features/onboarding/profile-labels";
import { usePagerHeadingRef } from "@/features/pager/Pager";
import { OwnCard } from "@/features/profile/OwnCardSection";
import { DuoPopsOptInCard } from "@/features/queue/DuoPopsOptInCard";
import { QueueUpFace } from "@/features/queue/QueueUpButton";
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
  TOUR_CAN_DUO_PICTURE_MIN,
  TOUR_CARD_NAME,
  TOUR_CARD_PICTURE_MIN,
  TOUR_POP,
  TOUR_QUEUED_MINUTES,
  exampleCard,
  tourChat,
  tourChatSpoken,
  tourLockedFit,
  tourPopPush,
  tourPopSpoken,
  tourQueueFit,
  type QueueTourKind,
  type TourCopy,
  type TourPopPush,
  type TourRankLine,
} from "./tourPages";

/** Kai's picture: abstract art bundled with the app (from assets/demo's triangle mesh), never a
 * person. */
const KAI_PICTURE: number = require("../../../assets/tour/kai.jpg");

const MARK_H = MATCH_MARK_W * LOGO_MARK_ASPECT;
const LOCK_BOX_W = MATCH_MARK_W + BRACKET_SIDE * 2;
/** The lock mark's width on a short page 3. */
const SHORT_MARK_W = 128;
/** A measured page 3 taller than its picture area by more than this is short (layout rounding). */
const OVERFLOW_SLOP = 0.5;
/** The Queue up page's seam, from the control down to the notice it sends. */
const QUEUE_SEAM_H = 20;
/** The mark on the example notice, at an app icon's size in a list row. */
const NOTICE_MARK_W = 20;

function kaiPages(): CardPage[] {
  return [{ kind: "picture", url: KAI_PICTURE }, ...cardPages(null, KAI_PROMPTS)];
}

/**
 * The text block under every picture, top-aligned so the heading never jumps between pages. It
 * reports its height (`onHeight`), so the picture leaves the tallest heading room at any text
 * size (tourPictureHeight). Its title registers with the tour's pager page (PagerPage), as the
 * paywall's titles do.
 */
export function TourHeading({ copy, onHeight }: { copy: TourCopy; onHeight?: (height: number) => void }) {
  const { colors, spacing, type } = useTheme();
  const titleRef = usePagerHeadingRef();
  return (
    <View style={{ gap: spacing.sm }} onLayout={onHeight ? (e) => onHeight(e.nativeEvent.layout.height) : undefined}>
      <Text style={[type.label, { color: colors.textMuted }]}>{copy.heading}</Text>
      {/* push-out: iOS moves a word down rather than leave one alone on a title's last line. */}
      <Text ref={titleRef} accessibilityRole="header" lineBreakStrategyIOS="push-out" style={[type.screenTitle, { color: colors.text }]}>
        {copy.title}
      </Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{copy.body}</Text>
    </View>
  );
}

/**
 * Page 1: Kai's real card, which really turns when tapped, with the hint until the first tap. At
 * least `height` tall; a larger text size grows the plate, and past TOUR_CARD_PICTURE_MIN of
 * picture the card grows instead and the page scrolls.
 */
export function CardTourPage({ height, rankLabel }: { height: number; rankLabel: string | null }) {
  const [tapped, setTapped] = useState(false);
  const card = exampleCard(rankLabel);
  return (
    <View style={{ minHeight: height }}>
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
        pagerCardName={TOUR_CARD_NAME.kai}
        pictureMinHeight={TOUR_CARD_PICTURE_MIN}
      />
    </View>
  );
}

/** Page 2 (ranked League players in NA only): Kai dimmed but for the rank, the lit cell and the
 * EXAMPLE tag, then the player's own rank line and the required caveat. The picture may shrink to
 * the tag's height; the plate and the rank panel never shrink (the page scrolls instead). */
export function CanDuoTourPage({ height, rankLabel, line }: { height: number; rankLabel: string; line: TourRankLine }) {
  const { colors, radius, spacing, type } = useTheme();
  const card = exampleCard(rankLabel);
  return (
    <View style={{ minHeight: height, gap: spacing.md }}>
      <View style={{ flexGrow: 1 }}>
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
          pagerCardName={TOUR_CARD_NAME.kai}
          pictureMinHeight={TOUR_CAN_DUO_PICTURE_MIN}
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

/** One bubble. VoiceOver hears who said it ("Kai: ..."), which the picture tells only by side and
 * colour. */
function Bubble({ line }: { line: { from: "kai" | "you"; text: string } }) {
  const { colors, radius, spacing, type } = useTheme();
  const mine = line.from === "you";
  // The chat screen's own bubble shape (app/chat/[matchId].tsx): the tail corner tightens to 3.
  const shape = mine
    ? { borderBottomRightRadius: 3, backgroundColor: colors.bubbleOwn }
    : { borderBottomLeftRadius: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };
  return (
    <View
      accessible
      accessibilityLabel={tourChatSpoken(line)}
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "78%",
        borderRadius: radius.md,
        paddingVertical: spacing.sm + 1,
        paddingHorizontal: spacing.md - 2,
        ...shape,
      }}
    >
      <Text style={[type.body, { color: colors.text }]}>{line.text}</Text>
    </View>
  );
}

/**
 * Page 3: the real DUO LOCKED mark at its end state, centred in the room the chat leaves, then a
 * short neutral chat in a panel that fits its bubbles (as the design draws it). On a short phone,
 * or when it measures taller than its picture area at a larger text size, it gives way a step at a
 * time (tourLockedFit): the smaller mark and two bubbles, then no line under the mark. At least
 * `height` tall; still too tall after that, the page scrolls.
 */
export function LockedTourPage({ height }: { height: number }) {
  const { colors, radius, spacing, type } = useTheme();
  // RingsLock and LockBrackets with every value at 1: the locked mark, standing still, so there is
  // no motion to reduce.
  const locked = useSharedValue(1);
  // Steps only ever go up: a page that gave way never measures its way back to the taller one.
  const [steps, setSteps] = useState(0);
  const fit = tourLockedFit(height, steps);
  const short = fit > 0;
  // LockBrackets scales its brackets to the mark, as the launch intro's smaller mark does.
  const markW = short ? SHORT_MARK_W : MATCH_MARK_W;
  const markH = short ? SHORT_MARK_W * LOGO_MARK_ASPECT : MARK_H;
  const boxW = short ? SHORT_MARK_W + (BRACKET_SIDE * 2 * SHORT_MARK_W) / MATCH_MARK_W : LOCK_BOX_W;
  return (
    <View
      onLayout={(e) => {
        if (fit === 2 || e.nativeEvent.layout.height <= height + OVERFLOW_SLOP) return;
        // One step per layout of this fit: a second report of the same layout adds nothing.
        const seen = steps;
        setSteps((current) => (current === seen ? current + 1 : current));
      }}
      style={{ minHeight: height, gap: spacing.md }}
    >
      <View style={{ flexGrow: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm }}>
        <View style={{ width: boxW, height: markH, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: markW, height: markH }}>
            <RingsLock width={markW} progress={locked} woven={locked} />
            <LockBrackets markWidth={markW} progress={locked} opacity={locked} color={colors.volt} />
          </View>
        </View>
        <Text style={{ ...type.label, fontSize: 14, lineHeight: 20, letterSpacing: 3, color: colors.volt }}>{LOCKED_COPY.stamp}</Text>
        {fit < 2 ? <Text style={[type.body, { color: colors.text, textAlign: "center" }]}>{LOCKED_COPY.line}</Text> : null}
      </View>
      <View
        style={{
          padding: spacing.md,
          gap: spacing.sm,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.cardEdge,
        }}
      >
        <Text style={[type.label, { color: colors.textMuted }]}>{LOCKED_COPY.chatLabel}</Text>
        {tourChat(fit).map((line) => (
          <Bubble key={line.text} line={line} />
        ))}
      </View>
    </View>
  );
}

/**
 * The example Duo Pop as the app draws a notice: a solid panel with its 1px seam (the Can duo rank
 * panel's), the mark, who and when, then the push's own title and words (tourPopPush). One element
 * for VoiceOver, read out whole.
 */
function PopNotice({ push }: { push: TourPopPush }) {
  const { colors, radius, spacing, type } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={tourPopSpoken(push)}
      style={{
        alignSelf: "stretch",
        padding: spacing.md,
        gap: spacing.xs,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.cardEdge,
        backgroundColor: colors.cardPanel,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <Logo width={NOTICE_MARK_W} />
        <Text style={[type.label, { flex: 1, color: colors.textMuted }]}>{TOUR_POP.app}</Text>
        <Text style={[type.label, { color: colors.textMuted }]}>{TOUR_POP.when}</Text>
      </View>
      <Text style={[type.bodyStrong, { color: colors.text }]}>{push.title}</Text>
      <Text style={[type.body, { color: colors.textMuted }]}>{push.body}</Text>
    </View>
  );
}

/** The 1px seam from the Queue up control down to what it leads to. */
function QueueSeam() {
  const { colors, spacing } = useTheme();
  return <View style={{ width: 1, height: QUEUE_SEAM_H, marginVertical: spacing.xs, backgroundColor: colors.cardEdge }} />;
}

/**
 * The Queue up page, by `kind` (queueTourKind, the same split as the body):
 *   "na"     the deck header's Queue up control as it stands idle, a 1px seam down to the Duo Pop
 *            that a Queue up sends (Kai's, naming nobody, as the real push), centred in the room
 *            left; under them, for a player a pop can reach with Duo Pops off, the deck's own
 *            "Get Duo Pops?" card (decided once by welcome.tsx before the page is on screen, and
 *            counted as an ask once `duoPopsShown`, the pager settled on this page).
 *   "other"  the idle control, the seam, and the control queued ("QUEUED 60M"): outside North
 *            America a Queue up sends no Duo Pop and none can reach the player, so the notice would
 *            be a promise the page cannot keep. What is true anywhere is the hour in Online Now.
 * Nothing moves: no Riot art, no people, no motion to reduce but the card's reveal.
 *
 * At least `height` tall. When the "na" page measures taller (a short phone with the card, or a
 * larger text size) it gives way once (tourQueueFit): the control and the seam go, the notice
 * stays. Still too tall after that, the page scrolls.
 */
export function QueueTourPage({
  height,
  kind,
  rankLabel,
  offerDuoPops,
  duoPopsShown,
}: {
  height: number;
  kind: QueueTourKind;
  rankLabel: string | null;
  offerDuoPops: boolean;
  duoPopsShown: boolean;
}) {
  const { spacing } = useTheme();
  // Steps only ever go up, as on page 3: a page that gave way never measures its way back.
  const [steps, setSteps] = useState(0);
  const fit = tourQueueFit(steps);
  if (kind === "other") {
    return (
      <View style={{ minHeight: height, alignItems: "center", justifyContent: "center" }}>
        <QueueUpFace />
        <QueueSeam />
        <QueueUpFace minutesLeft={TOUR_QUEUED_MINUTES} />
      </View>
    );
  }
  return (
    <View
      onLayout={(e) => {
        if (fit === 1 || e.nativeEvent.layout.height <= height + OVERFLOW_SLOP) return;
        const seen = steps;
        setSteps((current) => (current === seen ? current + 1 : current));
      }}
      style={{ minHeight: height, gap: spacing.md }}
    >
      <View style={{ flexGrow: 1, alignItems: "center", justifyContent: "center" }}>
        {fit === 0 ? (
          <>
            <QueueUpFace />
            <QueueSeam />
          </>
        ) : null}
        <PopNotice push={tourPopPush(rankLabel)} />
      </View>
      {offerDuoPops ? <DuoPopsOptInCard surface="tour" active={duoPopsShown} /> : null}
    </View>
  );
}

/** The last page: the player's own card through the Profile tab's code, tappable, with no age. */
export function YourCardTourPage({ height, profile }: { height: number; profile: { id: string; is_active: boolean } }) {
  return <OwnCard profile={profile} height={height} mode="tour" />;
}
