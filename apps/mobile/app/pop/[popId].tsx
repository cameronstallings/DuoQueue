import { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { ReportReason } from "@duoqueue/shared-types";

import { Button } from "@/components/Button";
import { ReportModal } from "@/components/ReportModal";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useBlockUser, useReportUser } from "@/features/chat/useMatchActions";
import { DuoLockedScreen, type DuoPopPhase } from "@/features/match/DuoLockedScreen";
import { exitMatchMoment } from "@/features/match/exitMatchMoment";
import { BRACKET_SIDE, MATCH_MARK_W, matchReason } from "@/features/match/matchMoment";
import { PushPreAskCard } from "@/features/push/PushPreAskCard";
import { PopCardContent, PopOverContent, type PopOverResult } from "@/features/queue/PopCardContent";
import { POP_COPY, popLockedTitle, POP_RESULT_COPY, queueErrorMessage } from "@/features/queue/queueCopy";
import { QueueUpSheet } from "@/features/queue/QueueUpSheet";
import type { DuoPopStatus } from "@/features/queue/types";
import { useAnswerDuoPop, useDuoPop } from "@/features/queue/useDuoPop";
import { useDuoLockedReviewPrompt } from "@/features/rating/useReviewTriggers";
import { useRequireSession } from "@/hooks/useRequireSession";
import { hapticError, hapticLight, hapticRigid, hapticWarning } from "@/lib/haptics";
import { useToastStore } from "@/store/toast-store";
import { LOGO_MARK_ASPECT, R, VB_W, W } from "@/theme/logo-geometry";
import { useTheme } from "@/theme/useTheme";

/** A pop id, by shape (the same rule notificationRouting.ts applies to a tapped push). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A Duo Pop lasts ten minutes (0085's pop_expires_at). */
const POP_TOTAL_SECONDS = 600;

/** The O ring's outer diameter on the card, for the loading skeleton in its place. */
const RING_D = (2 * R + W) * (MATCH_MARK_W / VB_W);
const MARK_H = MATCH_MARK_W * LOGO_MARK_ASPECT;

function closeCard() {
  if (router.canGoBack()) router.back();
  else router.replace("/(tabs)");
}

/**
 * The Duo Pop card: a recipient's ten minutes to say I'm in. Opened as a modal from the duo_pop
 * push (a tap, from cold start, warm or mid-gate; useNotificationTapRouting), over whatever was in
 * front.
 *
 * It is DuoLockedScreen's "pop" variant (Group M): the mark's O ring drains as a ten-minute
 * countdown from the server's own `seconds_left` (so a phone with a wrong clock still counts
 * right), with who is queueing under it. When I'm in comes back "locked", the ring closes IN
 * PLACE into DUO LOCKED, "Popped in 0:41", and the usual two buttons. DuoLockedScreen fires the
 * heavy tap when the card opens counting and the one success tap at the lock; this screen fires
 * rigid on I'm in and warning when someone else got there first or it ran out.
 *
 * What a first read can say, and what is drawn for it:
 *   open            the countdown
 *   locked_by_you   reopened after I'm in: a still "You're duo locked with Kai" and Send a message
 *                   (no animation, no haptic; the moment already happened)
 *   taken, expired, ended   the matching "over" card straight away
 *   no row          (not a recipient any more, blocked, reported, the sender gone, or 0085 not
 *                   live): "This Duo Pop isn't available anymore"
 */
export default function PopCardScreen() {
  useRequireSession();
  const params = useLocalSearchParams<{ popId: string }>();
  const raw = typeof params.popId === "string" ? params.popId.toLowerCase() : "";
  const popId = UUID_PATTERN.test(raw) ? raw : null;

  const pop = useDuoPop(popId);
  const answer = useAnswerDuoPop();
  const reportUser = useReportUser();
  const blockUser = useBlockUser();
  const showToast = useToastStore((s) => s.showToast);

  const [lockedMatchId, setLockedMatchId] = useState<string>();
  const [poppedIn, setPoppedIn] = useState<number | null>(null);
  const [after, setAfter] = useState<{ kind: "locked" } | { kind: "over"; result: PopOverResult } | null>(null);
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const [reportVisible, setReportVisible] = useState(false);
  const [queueSheetVisible, setQueueSheetVisible] = useState(false);
  const onLocked = useDuoLockedReviewPrompt(lockedMatchId);

  // What the FIRST read said decides which card this is; later reads only move a live countdown on.
  const firstStatus = useRef<DuoPopStatus | null>(null);
  if (pop.data && firstStatus.current === null) firstStatus.current = pop.data.status;

  // The countdown, from the server's seconds_left at the moment that read landed.
  const deadlineMs = pop.data ? pop.dataUpdatedAt + pop.data.seconds_left * 1000 : 0;
  // Ticks once a second while the card counts, and stops by itself at zero.
  const counting = after === null && firstStatus.current === "open";
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!counting) return;
    setNowMs(Date.now());
    const timer = setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (now >= deadlineMs) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [counting, deadlineMs]);
  const secondsLeft = Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));

  if (!popId) return <PlainCard title={POP_RESULT_COPY.unavailable.title} />;

  if (pop.isPending) return <LoadingCard />;

  if (pop.isError && !pop.data) {
    return (
      <PlainCard
        title={POP_COPY.loadFailed}
        primary={{ label: POP_COPY.tryAgain, onPress: () => void pop.refetch() }}
      />
    );
  }

  const card = pop.data;
  if (!card) return <PlainCard title={POP_RESULT_COPY.unavailable.title} />;

  if (firstStatus.current === "locked_by_you" && after === null) {
    const matchId = card.match_id;
    return (
      <PlainCard
        title={popLockedTitle(card.display_name)}
        primary={
          matchId
            ? {
                label: POP_COPY.sendMessage,
                onPress: () => router.replace({ pathname: "/chat/[matchId]", params: { matchId } }),
              }
            : undefined
        }
      />
    );
  }

  // The phase: what happened after a tap, else the first read's answer, else the live countdown
  // (which a later read can end: someone else got it, or the sender stopped), and zero is over.
  let phase: DuoPopPhase;
  let overResult: PopOverResult = "expired";
  if (after?.kind === "locked") {
    phase = "locked";
  } else if (after?.kind === "over") {
    phase = "over";
    overResult = after.result;
  } else if (firstStatus.current !== "open") {
    phase = "over";
    overResult = firstStatus.current === "taken" || firstStatus.current === "ended" ? firstStatus.current : "expired";
  } else if (card.status === "taken" || card.status === "ended" || card.status === "expired") {
    phase = "over";
    overResult = card.status;
  } else if (secondsLeft <= 0 && !answer.isPending) {
    phase = "over";
    overResult = "expired";
  } else {
    phase = "counting";
  }

  /** Not now, after a report or a block: nothing is ever sent to the sender. */
  function declineQuietly() {
    if (popId) answer.mutate({ popId, accept: false });
  }

  function handleImIn() {
    if (!popId || answer.isPending) return;
    hapticRigid();
    answer.mutate(
      { popId, accept: true },
      {
        onSuccess: (res) => {
          switch (res.result) {
            case "locked":
              if (res.match_id) {
                // One render: the match id (for onLocked and the buttons), the popped-in time and
                // the phase, so the ring closes with everything it needs.
                setLockedMatchId(res.match_id);
                setPoppedIn(res.popped_in_seconds ?? null);
                setAfter({ kind: "locked" });
              } else {
                setAfter({ kind: "over", result: "unavailable" });
              }
              return;
            case "taken":
            case "expired":
              hapticWarning();
              setAfter({ kind: "over", result: res.result });
              return;
            case "already_matched":
              setMatchedId(res.match_id);
              setAfter({ kind: "over", result: "already_matched" });
              return;
            case "ended":
            case "unavailable":
              setAfter({ kind: "over", result: res.result });
              return;
            case "declined":
              closeCard();
              return;
          }
        },
        onError: (err) => showToast(queueErrorMessage(err, POP_COPY.answerFailed), "error"),
      },
    );
  }

  function handleNotNow() {
    hapticLight();
    declineQuietly();
    closeCard();
  }

  function handleReportSubmit(reason: ReportReason, details: string) {
    if (!card) return;
    reportUser.mutate(
      { reportedId: card.sender_id, reason, details },
      {
        onSuccess: () => {
          setReportVisible(false);
          declineQuietly();
          Alert.alert(POP_COPY.reportSubmittedTitle, POP_COPY.reportSubmittedBody);
          closeCard();
        },
        onError: () => {
          hapticError();
          Alert.alert(POP_COPY.failedTitle, POP_COPY.failedBody);
        },
      },
    );
  }

  function handleBlock() {
    if (!card) return;
    Alert.alert(POP_COPY.blockTitle, POP_COPY.blockBody, [
      { text: POP_COPY.cancel, style: "cancel" },
      {
        text: POP_COPY.blockConfirm,
        style: "destructive",
        onPress: () =>
          blockUser.mutate(card.sender_id, {
            onSuccess: () => {
              declineQuietly();
              closeCard();
            },
            onError: () => {
              hapticError();
              Alert.alert(POP_COPY.failedTitle, POP_COPY.failedBody);
            },
          }),
      },
    ]);
  }

  const content =
    phase === "over" ? (
      <PopOverContent
        result={overResult}
        name={card.display_name}
        onQueueUp={() => setQueueSheetVisible(true)}
        onClose={closeCard}
        onOpenChat={() => {
          if (matchedId) router.replace({ pathname: "/chat/[matchId]", params: { matchId: matchedId } });
          else closeCard();
        }}
      />
    ) : (
      <PopCardContent
        name={card.display_name}
        age={card.age}
        gameName={card.game_name}
        rankText={card.rank_text}
        canDuo={card.can_duo}
        answering={answer.isPending && answer.variables?.accept === true}
        onImIn={handleImIn}
        onNotNow={handleNotNow}
        onReport={() => setReportVisible(true)}
        onBlock={handleBlock}
      />
    );

  return (
    <>
      <DuoLockedScreen
        variant="pop"
        theirName={card.display_name}
        theirPhoto={null}
        reason={matchReason({ duo: card.can_duo ? "1" : undefined })}
        poppedInSeconds={poppedIn}
        onExit={(exit) => {
          if (lockedMatchId) exitMatchMoment(exit, lockedMatchId);
          else closeCard();
        }}
        onLocked={onLocked}
        belowButtons={<PushPreAskCard surface="match" otherName={card.display_name} />}
        pop={{ phase, secondsLeft, totalSeconds: POP_TOTAL_SECONDS, content }}
      />
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmit={handleReportSubmit}
        submitting={reportUser.isPending}
      />
      <QueueUpSheet visible={queueSheetVisible} onClose={() => setQueueSheetVisible(false)} />
    </>
  );
}

/** The card while its first read is in flight: the ring's place and two lines, no spinner, laid
 * out where the real card will be so nothing jumps when it lands. */
function LoadingCard() {
  const { radius, spacing } = useTheme();
  return (
    <ScreenContainer atmosphere="match">
      <View style={{ alignItems: "center", gap: spacing.lg, paddingTop: spacing.xl }}>
        <View
          style={{ width: MATCH_MARK_W + BRACKET_SIDE * 2, height: MARK_H, alignItems: "center", justifyContent: "center" }}
        >
          <Skeleton width={RING_D} height={RING_D} borderRadius={radius.round} />
        </View>
        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <Skeleton width={160} height={22} />
          <Skeleton width={220} height={16} />
        </View>
      </View>
    </ScreenContainer>
  );
}

/** A still card: a title and up to one action, then Close. For a pop that cannot be shown, a
 * failed read and a pop reopened after this player was already in. */
function PlainCard({ title, primary }: { title: string; primary?: { label: string; onPress: () => void } }) {
  const { colors, spacing, type } = useTheme();
  return (
    <ScreenContainer atmosphere="match">
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.lg }}>
        <Text accessibilityRole="header" style={[type.title, { color: colors.text, textAlign: "center" }]}>
          {title}
        </Text>
        <View style={{ gap: spacing.sm }}>
          {primary && <Button label={primary.label} onPress={primary.onPress} />}
          <Button label={POP_COPY.close} variant={primary ? "ghost" : "primary"} onPress={closeCard} />
        </View>
      </View>
    </ScreenContainer>
  );
}
