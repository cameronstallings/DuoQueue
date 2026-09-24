import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { BRACKET_SPRING } from "@/features/match/matchMoment";
import { RingsLock } from "@/features/match/RingsLock";
import { hapticSuccess } from "@/lib/haptics";

import { type BracketGlyph, bracketLayout } from "./launchBrackets";
import { launchPopKick } from "./launchPop";
import {
  BREATH_LOW,
  BREATH_MS,
  BREATHE_AFTER_MS,
  LAUNCH_BEAT_MS,
  LAUNCH_DISSOLVE_MS,
  LAUNCH_FADE_MS,
  LAUNCH_PALETTE,
  LAUNCH_RUSH_SPRING,
  LAUNCH_WINDUP,
  LAUNCH_WINDUP_MS,
  launchMarkWidth,
  launchOpening,
  launchSchedule,
  LOCKED_HOLD_MS,
  msUntil,
} from "./launchTiming";

const INKS = { ink: LAUNCH_PALETTE.ink, duo: LAUNCH_PALETTE.duo };
const WINDUP_EASING = Easing.out(Easing.quad);
const BRACKETS = { "[": bracketLayout("["), "]": bracketLayout("]") } as const;

/** One of DUO LOCKED's brackets, as its Plex Mono outline (launchBrackets.ts), drawn in a lock box
 * centred on the mark; `progress` 0 is BRACKET_TRAVEL out, 1 is home. */
function LaunchBracket({
  glyph,
  progress,
  opacity,
}: {
  glyph: BracketGlyph;
  progress: SharedValue<number>;
  opacity: SharedValue<number>;
}) {
  const { left, width, height, viewBox, path, outX } = BRACKETS[glyph];
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: (1 - progress.value) * outX }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left, width, height }, style]}>
      <Svg width={width} height={height} viewBox={viewBox}>
        <Path d={path} fill={LAUNCH_PALETTE.volt} />
      </Svg>
    </Animated.View>
  );
}

interface LaunchIntroProps {
  /** Fonts loaded and the session no longer "loading". */
  ready: boolean;
  /** The UI thread has reported the lock (or the backstop stopped waiting for it): the app can
   * mount behind the overlay without competing with the motion. Called once. */
  onLocked: () => void;
  /** The fade has finished: unmount the overlay. */
  onDone: () => void;
}

/**
 * The cold start: the native splash shows the O and the Q apart (scripts/generate-launch-splash.ts),
 * and this overlay, drawn over the whole app on the same dark field, takes over on exactly that
 * picture. The native splash is hidden a frame after the overlay has laid out, once it has surely
 * drawn, so nothing flashes between them, and the opening starts with the hide.
 *
 * The bracket lock (launchTiming.ts has every number): a short rest, then the rings wind up (pull
 * apart 7%) and rush together on a spring. The first frame they reach the lock, the weave switches
 * on, the whole mark pops (a scale spring about its centre) and the success haptic fires, all from
 * the UI thread. DUO LOCKED's brackets fade in on the way and spring home at the same instant,
 * overshoot a little inward, and stay. The mark holds until everything has settled and the app is
 * ready, breathing if that takes long, then the overlay fades away over the app.
 *
 * The app is not mounted behind the overlay until the lock has been reported: mounting the whole
 * tree is heavy UI-thread work, and done during the rush it made the rings stutter. RootLayout
 * starts restoring the session and loading data at once, so readiness is not held back.
 *
 * While it is opaque it takes every touch, so the app behind it (a sign-in button, the swipe deck)
 * cannot be tapped unseen; touches go through from the moment it starts to fade.
 */
export function LaunchIntro({ ready, onLocked, onDone }: LaunchIntroProps) {
  const reduced = useReducedMotion();
  // Decided once: a setting flipped mid-launch must not restart or change the intro.
  const [opening] = useState(() => launchOpening(Platform.OS, reduced));
  const schedule = launchSchedule(opening);
  const width = launchMarkWidth(opening);
  const startsLocked = opening === "none";

  const rings = useSharedValue(startsLocked ? 1 : 0);
  const woven = useSharedValue(startsLocked ? 1 : 0);
  /** Reduce Motion's dissolve: 0 shows the rings apart, 1 the locked mark. */
  const dissolve = useSharedValue(startsLocked ? 1 : 0);
  const locked = useSharedValue(1);
  /** The pop: the scale of the whole mark, brackets included, about its centre. */
  const pop = useSharedValue(1);
  /** The brackets' travel (0 = out, 1 = home; under Reduce Motion they only fade in, at home). */
  const brackets = useSharedValue(schedule.brackets?.travel ? 0 : 1);
  const bracketsOpacity = useSharedValue(0);
  /** Set on the UI thread the first time the mark reaches the lock, so the lock happens once. */
  const lockReached = useSharedValue(startsLocked);
  const breath = useSharedValue(1);
  const fade = useSharedValue(1);
  /** When the opening started (the native splash hid), by Date.now(). */
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  /** When the UI thread reported the lock (or the backstop gave up waiting), by Date.now(). */
  const [lockedAt, setLockedAt] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const laidOut = useRef(false);

  // The first report wins: the lock from the UI thread, or the backstop below.
  const markLocked = useCallback(() => setLockedAt((at) => at ?? Date.now()), []);

  // The lock, on the UI thread in the frame it happens. The rush overshoots, so its completion
  // callback would only come once it has settled, ~900ms later: the lock is the first frame the
  // rings reach 1 instead (the dissolve's end under Reduce Motion). It fires once.
  const springs = schedule.springs;
  const haptic = schedule.haptic;
  useAnimatedReaction(
    () => (springs ? rings.value : dissolve.value) >= 1,
    (reached) => {
      if (!reached || lockReached.value) return;
      lockReached.value = true;
      if (springs) {
        // As in DUO LOCKED, the weave switches on at the lock. The scale is at rest at exactly 1
        // here, and Reanimated drops a bare spring whose target is where it already is, so the
        // pop goes through launchPopKick (launchPop.ts), which it does not drop.
        woven.value = 1;
        pop.value = launchPopKick();
      }
      if (haptic) runOnJS(hapticSuccess)();
      runOnJS(markLocked)();
    },
  );

  function onLayout() {
    if (laidOut.current) return;
    laidOut.current = true;
    // One frame on, so the overlay has certainly drawn: the native splash can go, and the opening
    // starts with it. A busy JS thread only holds the rings apart longer, under the same picture.
    requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
      setOpenedAt(Date.now());
      if (opening === "bracket-lock") {
        rings.value = withDelay(
          LAUNCH_BEAT_MS,
          withSequence(
            withTiming(LAUNCH_WINDUP, { duration: LAUNCH_WINDUP_MS, easing: WINDUP_EASING }),
            withSpring(1, LAUNCH_RUSH_SPRING),
          ),
        );
      } else if (opening === "dissolve") {
        dissolve.value = withDelay(
          LAUNCH_BEAT_MS,
          withTiming(1, { duration: LAUNCH_DISSOLVE_MS, reduceMotion: ReduceMotion.Never }),
          ReduceMotion.Never,
        );
      } else {
        markLocked();
      }
      const b = schedule.brackets;
      if (b) {
        // withTiming's default ease, as DUO LOCKED fades its brackets in.
        bracketsOpacity.value = withDelay(
          b.atMs,
          withTiming(1, { duration: b.fadeMs, reduceMotion: ReduceMotion.Never }),
          ReduceMotion.Never,
        );
        if (b.travel) brackets.value = withDelay(b.atMs, withSpring(1, BRACKET_SPRING));
      }
    });
  }

  // Tell the root the app can mount, once.
  useEffect(() => {
    if (lockedAt !== null) onLocked();
  }, [lockedAt, onLocked]);

  // No report long after the lock was due: count it as locked, so a lost report cannot keep the
  // overlay over a ready app, or keep the app from mounting.
  useEffect(() => {
    if (openedAt === null || lockedAt !== null) return;
    const timer = setTimeout(markLocked, msUntil(schedule.lockBackstopMs, openedAt, Date.now()));
    return () => clearTimeout(timer);
  }, [openedAt, lockedAt, schedule.lockBackstopMs, markLocked]);

  // Still loading well after the lock: breathe, like the old loading screen, so it never looks stuck.
  useEffect(() => {
    if (lockedAt === null || ready) return;
    const timer = setTimeout(
      () => {
        breath.value = withRepeat(
          withTiming(BREATH_LOW, { duration: BREATH_MS, easing: Easing.ease, reduceMotion: ReduceMotion.Never }),
          -1,
          true,
          undefined,
          ReduceMotion.Never,
        );
      },
      msUntil(BREATHE_AFTER_MS, lockedAt, Date.now()),
    );
    return () => clearTimeout(timer);
  }, [lockedAt, ready, breath]);

  // Ready: fade out once the lock has been seen and has settled, and unmount.
  useEffect(() => {
    if (lockedAt === null || !ready) return;
    const timer = setTimeout(
      () => {
        cancelAnimation(breath);
        // Touches go through to the app from the first frame of the fade.
        setFading(true);
        fade.value = withTiming(
          0,
          { duration: LAUNCH_FADE_MS, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.Never },
          (finished) => {
            if (finished) runOnJS(onDone)();
          },
        );
      },
      msUntil(LOCKED_HOLD_MS, lockedAt, Date.now()),
    );
    return () => clearTimeout(timer);
  }, [lockedAt, ready, breath, fade, onDone]);

  // Nothing keeps animating after the overlay has gone.
  useEffect(
    () => () => {
      for (const value of [rings, dissolve, pop, brackets, bracketsOpacity]) cancelAnimation(value);
    },
    [rings, dissolve, pop, brackets, bracketsOpacity],
  );

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.value }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const apartStyle = useAnimatedStyle(() => ({ opacity: 1 - dissolve.value }));
  const lockedStyle = useAnimatedStyle(() => ({ opacity: dissolve.value }));

  return (
    <Animated.View
      pointerEvents={fading ? "none" : "auto"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={onLayout}
      style={[styles.overlay, overlayStyle]}
    >
      <Animated.View style={breathStyle}>
        {/* The mark's own box, so the pop scales about the mark's centre. The brackets hang
            outside it, and scale with it, so the pop cannot push the Q's tail into the "]". */}
        <Animated.View style={popStyle}>
          {opening === "dissolve" ? (
            <View>
              <Animated.View style={apartStyle}>
                <RingsLock width={width} progress={rings} woven={woven} palette={INKS} />
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, lockedStyle]}>
                <RingsLock width={width} progress={locked} woven={locked} palette={INKS} />
              </Animated.View>
            </View>
          ) : (
            <RingsLock width={width} progress={rings} woven={woven} palette={INKS} />
          )}
          {schedule.brackets && (
            <>
              <LaunchBracket glyph="[" progress={brackets} opacity={bracketsOpacity} />
              <LaunchBracket glyph="]" progress={brackets} opacity={bracketsOpacity} />
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: LAUNCH_PALETTE.background,
  },
});
