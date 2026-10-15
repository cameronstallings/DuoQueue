import { type ReactNode, useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  Easing,
  type EntryOrExitLayoutType,
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Button } from "@/components/Button";
import { Name } from "@/components/Name";
import { PresenceAvatar } from "@/components/PresenceAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ownPictureState } from "@/features/profile/pictureStatus";
import { useOwnProfilePhotos } from "@/features/profile/useOwnProfilePhotos";
import { hapticHeavy, hapticSelection, hapticSuccess } from "@/lib/haptics";
import { useSessionStore } from "@/store/session-store";
import { revealEntering } from "@/theme/entering";
import { LOGO_MARK_ASPECT } from "@/theme/logo-geometry";
import { useTheme } from "@/theme/useTheme";

import { LockBrackets } from "./LockBrackets";
import {
  BUTTONS_FADE_MS,
  FADE_MS,
  FLASH_MS,
  POP_CLOSE_MS,
  POP_CONTENT_OUT_MS,
  POP_INK_MS,
  POP_LABEL_OUT_MS,
  POP_Q_FADE_MS,
  type LockSchedule,
  STAMP_MS,
  lockSchedule,
} from "./lockTimeline";
import {
  BRACKET_FADE_MS,
  BRACKET_SIDE,
  BRACKET_SPRING,
  MATCH_MARK_W as MARK_W,
  type MatchExit,
  type MatchReason,
  RING_BEZIER,
  RINGS_MS,
  lockSentence,
  popOFrom,
  popQFrom,
} from "./matchMoment";
import { PopCountdownRing } from "./PopCountdownRing";
import { PoppedInLine } from "./PoppedInLine";
import { RingsLock } from "./RingsLock";

const MARK_H = MARK_W * LOGO_MARK_ASPECT;
/** The bracket numbers live in matchMoment.ts, and LockBrackets draws them, here and in the launch
 * intro. Vertical placement: the brackets' ink is centred on the rings (the mark's centre), as the
 * launch intro centres it. Up to build 15 they were Text at 96/96, which iOS set with the glyph
 * centred ~8.3pt above the rings and ~3.4pt of each top arm cut off by the Text's box. */
const LOCK_BOX_W = MARK_W + BRACKET_SIDE * 2;
const PLAYER_SIZE = 40;
/** The stamp line: "DUO LOCKED" (and on the Pop card, "Duo Pop" in the same slot before it). */
const STAMP_LINE = 22;
/** RING_BEZIER (matchMoment.ts), shared with duoqueue.io's match card. */
const RING_EASING = Easing.bezier(...RING_BEZIER);
const STAMP_EASING = Easing.bezier(0.23, 1, 0.32, 1);
/** The countdown ring (track, arc and closed volt O) fading out from under the ink O, once the
 * ink O is fully in. Drawn under it, the same circle three more times leaves volt and border in the
 * ink O's anti-aliased rim; gone, the final frame is the mark alone. Covered by the ink O, so the
 * fade itself shows nothing but the fringe going. */
const POP_RING_OUT_MS = 120;

export type DuoPopPhase = "counting" | "locked" | "over";

export interface DuoLockedPop {
  /** "counting" while the ring drains; "locked" once answer_duo_pop says so (the ring closes and
   * the moment plays in place); "over" when it was taken, expired or ended. */
  phase: DuoPopPhase;
  /** From get_duo_pop's seconds_left, ticked down once a second by the caller. */
  secondsLeft: number;
  totalSeconds: number;
  /** Drawn under the ring while counting or over (the Pop card's name, game and buttons). It
   * fades out when the ring closes. */
  content: ReactNode;
}

interface DuoLockedScreenProps {
  /** "match": DUO LOCKED as it has always opened (a like back, a Duo Pop's sender). "pop": the
   * Duo Pop card, whose countdown ring closes into DUO LOCKED in place when the recipient is in. */
  variant: "match" | "pop";
  theirName: string;
  theirPhoto: string | null;
  reason: MatchReason | null;
  /** A Duo Pop's popped-in time (1 to 600). Known: the "POPPED IN 0:41" stamp rolls in under DUO
   * LOCKED and the sentence says it came from a Duo Pop. Null: today's DUO LOCKED exactly. */
  poppedInSeconds: number | null;
  onExit: (exit: MatchExit) => void;
  /** Called once, right after the one success haptic at the lock (the rating prompt's trigger). */
  onLocked?: () => void;
  /** Under the buttons (the push pre-ask). Laid out from the first frame of the block it sits in,
   * hidden, and faded in after the buttons, so nothing above it moves when it shows. */
  belowButtons?: ReactNode;
  /** The Duo Pop card's state; required for variant "pop". */
  pop?: DuoLockedPop;
}

function PlayerChip({ label, name, uri }: { label: string; name: string; uri: string | null }) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ width: LOCK_BOX_W / 2, alignItems: "center", gap: spacing.xs }}>
      <PresenceAvatar uri={uri} name={name} size={PLAYER_SIZE} />
      <Name variant="bodyStrong" numberOfLines={1} style={{ color: colors.text, maxWidth: LOCK_BOX_W / 2 - 8 }}>
        {label}
      </Name>
    </View>
  );
}

/**
 * DUO LOCKED: the logo made real, and the one signature moment in the app, "the ring closes".
 *
 * Variant "match" (a like back, or the sender's DUO LOCKED after a Duo Pop): the O+Q rings start
 * apart, one from each side, slide together and interlock; the brackets snap shut around them
 * with a slight overshoot; one flash, one success haptic; "DUO LOCKED" stamps in (scale 1.25 to 1).
 * Then the two players, the reason strip (facts only), the sentence and the buttons. With a
 * popped-in time, "POPPED IN 0:41" rolls in under the stamp first and the rest waits for its digits
 * to land. Centred, as it always was.
 *
 * Variant "pop" (the Duo Pop card): top-anchored, so the ring never moves when the content under
 * it changes. While counting, the O sits in the middle of the mark as a ten-minute ring draining
 * in volt, with the time in its hole and "DUO POP" in the stamp slot; the card's own content
 * (name, age, game, I'm in, Not now) sits below. When the answer says "locked", the ring closes
 * IN PLACE: the drained gap fills, the content fades out, the O slides 31.5pt left into its place
 * as the Q flies in from the right, brackets, flash, "DUO LOCKED" takes the slot as "DUO POP"
 * fades, and the volt O hands over to the ink O so the final frame is exactly the logo mark. Then
 * the Popped-in stamp and the same block as the match variant.
 *
 * Every number is in lockTimeline.ts. Transforms and opacity only; no glow, blur, particles or new
 * colours. Haptics: heavy once when the Pop card opens counting, success once at the lock (then
 * onLocked), selection when the popped digits land; the caller fires rigid on I'm in and warning
 * when a Pop is taken. Reduce Motion: the countdown still steps; at the lock everything cuts to the
 * locked picture (no slide, flash or roll), the success haptic fires, and everything after it
 * fades in with no waiting. Every animation is cancelled on unmount ("Keep swiping" can close the
 * screen mid-way).
 */
export function DuoLockedScreen({
  variant,
  theirName,
  theirPhoto,
  reason,
  poppedInSeconds,
  onExit,
  onLocked,
  belowButtons,
  pop,
}: DuoLockedScreenProps) {
  const { colors, spacing, type } = useTheme();
  const reduced = useReducedMotion();
  const profile = useSessionStore((s) => s.profile);
  const { data: ownPhotos } = useOwnProfilePhotos(profile?.id);
  const ownPicture = ownPhotos ? ownPictureState(ownPhotos).url : null;

  const isPop = variant === "pop";
  const popState: DuoLockedPop = pop ?? { phase: "counting", secondsLeft: 0, totalSeconds: 600, content: null };
  const phase: DuoPopPhase = isPop ? popState.phase : "locked";
  const popped = poppedInSeconds !== null;
  const schedule = lockSchedule(variant, popped);

  // The match variant under Reduce Motion starts locked, as it always has; the Pop card always
  // starts apart (the O in the middle as the countdown ring, the Q not there yet).
  const startLocked = !isPop && reduced ? 1 : 0;
  const rings = useSharedValue(startLocked);
  const woven = useSharedValue(startLocked);
  const brackets = useSharedValue(startLocked);
  const bracketsOpacity = useSharedValue(startLocked);
  const stamp = useSharedValue(startLocked);
  const flash = useSharedValue(0);
  // The Pop card's own layers (unused by the match variant, whose RingsLock takes none of them).
  const counting = isPop && phase === "counting" ? 1 : 0;
  const qOpacity = useSharedValue(0);
  const oInk = useSharedValue(0);
  const closed = useSharedValue(0);
  const arc = useSharedValue(counting);
  const time = useSharedValue(counting);
  const popLabel = useSharedValue(1);
  /** The whole countdown ring, under the ink O: 1 until the ink O has taken over, then 0. */
  const countdownRing = useSharedValue(1);

  // The lock happens once: one success haptic, one onLocked. The latest onLocked is called (the
  // Pop card's changes when the answer brings the match id, in the same render as "locked").
  const onLockedRef = useRef(onLocked);
  useEffect(() => {
    onLockedRef.current = onLocked;
  });
  const lockedRef = useRef(false);
  function handleLock() {
    if (lockedRef.current) return;
    lockedRef.current = true;
    hapticSuccess();
    onLockedRef.current?.();
  }

  function handleLanded() {
    // Under Reduce Motion nothing rolled, so there is no landing to feel, and the tap would come
    // right on top of the success one.
    if (!reduced) hapticSelection();
  }

  function cancelAll() {
    for (const value of [rings, woven, brackets, bracketsOpacity, stamp, flash, qOpacity, oInk, closed, arc, time, popLabel, countdownRing]) {
      cancelAnimation(value);
    }
  }

  // A Duo Pop arrives: one heavy tap when the Pop card opens on a live countdown.
  const heavyRef = useRef(false);
  useEffect(() => {
    if (isPop && phase === "counting" && !heavyRef.current) {
      heavyRef.current = true;
      hapticHeavy();
    }
    // Mount only: a Pop that opens already over or locked gets no tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DUO LOCKED (variant "match"): the sequence starts as the screen opens.
  useEffect(() => {
    if (isPop) return;
    if (reduced) {
      handleLock();
      return;
    }
    const s = lockSchedule("match", popped);
    rings.value = withDelay(
      s.ringsAt,
      withTiming(1, { duration: RINGS_MS, easing: RING_EASING }, (finished) => {
        if (!finished) return;
        // The lock: the weave snaps in, one flash, the stamp, one haptic.
        woven.value = 1;
        flash.value = withSequence(withTiming(0.18, { duration: FLASH_MS }), withTiming(0, { duration: FLASH_MS }));
        stamp.value = withTiming(1, { duration: STAMP_MS, easing: STAMP_EASING });
        runOnJS(handleLock)();
      }),
    );
    bracketsOpacity.value = withDelay(s.bracketsAt, withTiming(1, { duration: BRACKET_FADE_MS }));
    brackets.value = withDelay(s.bracketsAt, withSpring(1, BRACKET_SPRING));
    return cancelAll;
    // Mount only: the moment plays once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Pop card: "over" fades the arc and the time out; "locked" closes the ring.
  useEffect(() => {
    if (!isPop) return;
    if (phase === "over") {
      const fade = { duration: FADE_MS, reduceMotion: ReduceMotion.Never };
      arc.value = withTiming(0, fade);
      time.value = withTiming(0, fade);
      return;
    }
    if (phase !== "locked" || lockedRef.current) return;
    if (reduced) {
      // Cut straight to the locked picture.
      closed.value = 1;
      time.value = 0;
      rings.value = 1;
      woven.value = 1;
      qOpacity.value = 1;
      brackets.value = 1;
      bracketsOpacity.value = 1;
      oInk.value = 1;
      countdownRing.value = 0;
      popLabel.value = 0;
      stamp.value = 1;
      handleLock();
      return;
    }
    const s = lockSchedule("pop", popped);
    const never = ReduceMotion.Never;
    // T0: the drained gap fills in volt and the time goes.
    closed.value = withTiming(1, { duration: POP_CLOSE_MS, easing: Easing.out(Easing.quad), reduceMotion: never });
    time.value = withTiming(0, { duration: POP_LABEL_OUT_MS, reduceMotion: never });
    // The O slides into its place as the Q flies in from the right, fading up.
    qOpacity.value = withDelay(s.ringsAt, withTiming(1, { duration: POP_Q_FADE_MS, reduceMotion: never }));
    rings.value = withDelay(
      s.ringsAt,
      withTiming(1, { duration: RINGS_MS, easing: RING_EASING }, (finished) => {
        if (!finished) return;
        // The lock: the weave, the flash, the stamp takes the slot, the volt O becomes the mark.
        woven.value = 1;
        flash.value = withSequence(withTiming(0.18, { duration: FLASH_MS }), withTiming(0, { duration: FLASH_MS }));
        stamp.value = withTiming(1, { duration: STAMP_MS, easing: STAMP_EASING });
        popLabel.value = withTiming(0, { duration: POP_LABEL_OUT_MS, reduceMotion: never });
        oInk.value = withTiming(1, { duration: POP_INK_MS, reduceMotion: never }, (inkIn) => {
          // The ink O is whole now: take the volt ring out from under it.
          if (inkIn) countdownRing.value = withTiming(0, { duration: POP_RING_OUT_MS, reduceMotion: never });
        });
        runOnJS(handleLock)();
      }),
    );
    bracketsOpacity.value = withDelay(s.bracketsAt, withTiming(1, { duration: BRACKET_FADE_MS }));
    brackets.value = withDelay(s.bracketsAt, withSpring(1, BRACKET_SPRING));
    // The schedule plays once per lock; the unmount cleanup below cancels it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (!isPop) return;
    return cancelAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: stamp.value,
    transform: [{ scale: 1.25 - 0.25 * stamp.value }],
  }));
  const popLabelStyle = useAnimatedStyle(() => ({ opacity: popLabel.value }));
  const countdownRingStyle = useAnimatedStyle(() => ({ opacity: countdownRing.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const stampText = { ...type.label, fontSize: 16, lineHeight: STAMP_LINE, letterSpacing: 3, textAlign: "center" } as const;
  const locked = phase === "locked";

  const lockBox = (
    <View style={{ width: LOCK_BOX_W, height: MARK_H, alignItems: "center", justifyContent: "center" }}>
      {/* The mark's own box: the brackets hang out of it into the lock box's sides. */}
      <View style={{ width: MARK_W, height: MARK_H }}>
        {isPop ? (
          <RingsLock
            width={MARK_W}
            progress={rings}
            woven={woven}
            oFrom={popOFrom(MARK_W)}
            qFrom={popQFrom(MARK_W)}
            qOpacity={qOpacity}
            oOpacity={oInk}
            oOverlay={
              // Stays drawn after the lock: the closed volt ring is the O until the ink O has
              // faded in over it, and then it fades out from under it (countdownRing), so the
              // final frame is the mark. VoiceOver stops reading it as a timer once it has closed.
              <Animated.View
                style={[StyleSheet.absoluteFill, countdownRingStyle]}
                accessibilityElementsHidden={locked}
                importantForAccessibility={locked ? "no-hide-descendants" : "auto"}
              >
                <PopCountdownRing
                  width={MARK_W}
                  secondsLeft={popState.secondsLeft}
                  totalSeconds={popState.totalSeconds}
                  closed={closed}
                  arc={arc}
                  time={time}
                />
              </Animated.View>
            }
          />
        ) : (
          <RingsLock width={MARK_W} progress={rings} woven={woven} />
        )}
        <LockBrackets markWidth={MARK_W} progress={brackets} opacity={bracketsOpacity} color={colors.volt} />
      </View>
    </View>
  );

  const poppedLine =
    poppedInSeconds !== null && locked ? (
      <PoppedInLine
        seconds={poppedInSeconds}
        startAt={schedule.poppedAt ?? 0}
        reduced={reduced}
        onLanded={handleLanded}
      />
    ) : null;

  /** Everything after the lock fades in on the schedule; Reduce Motion keeps the fades
   * (ReduceMotion.Never) and drops the waiting. The match variant counts from the screen opening,
   * the Pop card from the lock's T0, which is when this block mounts. */
  function fadeAt(ms: number) {
    return FadeIn.duration(FADE_MS)
      .delay(reduced ? 0 : ms)
      .reduceMotion(ReduceMotion.Never);
  }
  const buttonsEntering = reduced
    ? FadeIn.duration(FADE_MS).reduceMotion(ReduceMotion.Never)
    : FadeInDown.duration(BUTTONS_FADE_MS).delay(schedule.buttonsAt);

  const afterLock = (
    <AfterLock
      schedule={schedule}
      fadeAt={fadeAt}
      buttonsEntering={buttonsEntering}
      ownName={profile?.display_name ?? "You"}
      ownPicture={ownPicture}
      theirName={theirName}
      theirPhoto={theirPhoto}
      reason={reason}
      // The Pop card is always a Duo Pop, even if the answer came back without its time.
      sentence={lockSentence(theirName, popped || isPop)}
      onExit={onExit}
      belowButtons={belowButtons}
    />
  );

  const flashOverlay = (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.volt }, flashStyle]} />
  );

  if (!isPop) {
    const lockEntering = reduced ? FadeIn.duration(FADE_MS).reduceMotion(ReduceMotion.Never) : undefined;
    return (
      // The lock flash, edge to edge: among the children it would fill only the padded content.
      <ScreenContainer atmosphere="match" overlay={flashOverlay}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg }}>
          <Animated.View entering={lockEntering} style={{ alignItems: "center", gap: spacing.md }}>
            {lockBox}
            <Animated.Text accessibilityRole="header" style={[{ ...stampText, color: colors.volt }, stampStyle]}>
              DUO LOCKED
            </Animated.Text>
            {poppedLine}
          </Animated.View>
          {afterLock}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer atmosphere="match" overlay={flashOverlay}>
      {/* Top-anchored: the ring stays exactly where it is while the content below it changes. */}
      <View style={{ alignItems: "center", gap: spacing.lg, paddingTop: spacing.xl }}>
        <View style={{ alignItems: "center", gap: spacing.md }}>
          {lockBox}
          {/* One slot, two stamps: "DUO POP" while it counts, "DUO LOCKED" stamped over it at the
              lock. VoiceOver reads whichever is showing. */}
          <View style={{ height: STAMP_LINE, alignSelf: "stretch", alignItems: "center", justifyContent: "center" }}>
            <Animated.Text
              accessibilityElementsHidden={locked}
              importantForAccessibility={locked ? "no-hide-descendants" : "auto"}
              style={[{ ...stampText, color: colors.voltDim, position: "absolute" }, popLabelStyle]}
            >
              Duo Pop
            </Animated.Text>
            <Animated.Text
              accessibilityRole="header"
              accessibilityElementsHidden={!locked}
              importantForAccessibility={locked ? "auto" : "no-hide-descendants"}
              style={[{ ...stampText, color: colors.volt }, stampStyle]}
            >
              DUO LOCKED
            </Animated.Text>
          </View>
          {poppedLine}
        </View>

        {locked ? (
          afterLock
        ) : (
          // Keyed by phase: the "over" content fades in as the countdown's fades out. At the lock
          // the content fades out over POP_CONTENT_OUT_MS while the ring closes.
          <Animated.View
            key={phase}
            entering={revealEntering()}
            exiting={FadeOut.duration(POP_CONTENT_OUT_MS).reduceMotion(ReduceMotion.Never)}
            style={{ alignSelf: "stretch" }}
          >
            {popState.content}
          </Animated.View>
        )}
      </View>
    </ScreenContainer>
  );
}

/** The players, the reason strip, the sentence, the two buttons and the caller's card, each fading
 * in at its time. Shared by both variants. */
function AfterLock({
  schedule,
  fadeAt,
  buttonsEntering,
  ownName,
  ownPicture,
  theirName,
  theirPhoto,
  reason,
  sentence,
  onExit,
  belowButtons,
}: {
  schedule: LockSchedule;
  fadeAt: (ms: number) => EntryOrExitLayoutType;
  buttonsEntering: EntryOrExitLayoutType;
  ownName: string;
  ownPicture: string | null;
  theirName: string;
  theirPhoto: string | null;
  reason: MatchReason | null;
  sentence: string;
  onExit: (exit: MatchExit) => void;
  belowButtons?: ReactNode;
}) {
  const { colors, radius, spacing, type } = useTheme();
  return (
    <>
      {/* "You" under the O, them under the Q. */}
      <Animated.View entering={fadeAt(schedule.playersAt)} style={{ flexDirection: "row", width: LOCK_BOX_W }}>
        <PlayerChip label="You" name={ownName} uri={ownPicture} />
        <PlayerChip label={theirName} name={theirName} uri={theirPhoto} />
      </Animated.View>

      {reason && (
        <Animated.View
          entering={fadeAt(schedule.reasonAt)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: radius.picture,
            borderWidth: 1,
            borderColor: colors.cardEdge,
            backgroundColor: colors.cardPanel,
          }}
        >
          {reason.kind === "duo" && <Ionicons name="people" size={16} color={colors.success} />}
          <Text style={[type.bodyStrong, { color: colors.text }]}>{reason.text}</Text>
        </Animated.View>
      )}

      <Animated.Text entering={fadeAt(schedule.sentenceAt)} style={{ ...type.body, color: colors.text, textAlign: "center" }}>
        {sentence}
      </Animated.Text>

      <Animated.View entering={buttonsEntering} style={{ width: "100%", gap: spacing.sm }}>
        <Button label="Send a message" onPress={() => onExit("message")} />
        <Button label="Keep swiping" variant="ghost" onPress={() => onExit("keep-swiping")} />
      </Animated.View>

      {/* Rendered (hidden) from this block's first frame, so whatever the caller passes is laid
          out before anything moves; it fades in after the buttons. */}
      {belowButtons !== undefined && (
        <Animated.View entering={fadeAt(schedule.belowButtonsAt)} style={{ width: "100%" }}>
          {belowButtons}
        </Animated.View>
      )}
    </>
  );
}
