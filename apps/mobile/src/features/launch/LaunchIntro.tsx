import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { RING_BEZIER, RINGS_MS } from "@/features/match/matchMoment";
import { RingsLock } from "@/features/match/RingsLock";

import {
  BREATH_LOW,
  BREATH_MS,
  BREATHE_AFTER_MS,
  LAUNCH_BEAT_MS,
  LAUNCH_DISSOLVE_MS,
  LAUNCH_FADE_MS,
  LAUNCH_PALETTE,
  launchMarkWidth,
  launchOpening,
  launchSchedule,
  LOCKED_HOLD_MS,
  msUntil,
} from "./launchTiming";

const RING_EASING = Easing.bezier(...RING_BEZIER);
const INKS = { ink: LAUNCH_PALETTE.ink, duo: LAUNCH_PALETTE.duo };

interface LaunchIntroProps {
  /** Fonts loaded and the session no longer "loading". */
  ready: boolean;
  /** The fade has finished: unmount the overlay. */
  onDone: () => void;
}

/**
 * The cold start: the native splash shows the O and the Q apart (scripts/generate-launch-splash.ts),
 * and this overlay, drawn over the whole app on the same dark field, takes over on exactly that
 * picture. The native splash is hidden a frame after the overlay has laid out, once it has surely
 * drawn, so nothing flashes between them, and the opening starts with the hide. A short rest, then
 * the rings slide together and lock as they do in DUO LOCKED (no brackets, stamp or haptic here);
 * the mark holds until the app is ready, breathing if that takes long, then the overlay fades away
 * over the app, which has been rendering behind it all along.
 *
 * While it is opaque it takes every touch, so the app behind it (a sign-in button, the swipe deck)
 * cannot be tapped unseen; touches go through from the moment it starts to fade.
 */
export function LaunchIntro({ ready, onDone }: LaunchIntroProps) {
  const reduced = useReducedMotion();
  // Decided once: a setting flipped mid-launch must not restart or change the intro.
  const [opening] = useState(() => launchOpening(Platform.OS, reduced));
  const width = launchMarkWidth(opening);
  const startsLocked = opening === "none";

  const rings = useSharedValue(startsLocked ? 1 : 0);
  const woven = useSharedValue(startsLocked ? 1 : 0);
  /** Reduce Motion's dissolve: 0 shows the rings apart, 1 the locked mark. */
  const dissolve = useSharedValue(startsLocked ? 1 : 0);
  const locked = useSharedValue(1);
  const breath = useSharedValue(1);
  const fade = useSharedValue(1);
  /** When the opening started (the native splash hid), by Date.now(). */
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  /** When the UI thread reported the lock (or the backstop gave up waiting), by Date.now(). */
  const [lockedAt, setLockedAt] = useState<number | null>(null);
  const [fading, setFading] = useState(false);
  const laidOut = useRef(false);

  // The first report wins: the opening's own completion, or the backstop below.
  const markLocked = useCallback(() => setLockedAt((at) => at ?? Date.now()), []);

  function onLayout() {
    if (laidOut.current) return;
    laidOut.current = true;
    // One frame on, so the overlay has certainly drawn: the native splash can go, and the opening
    // starts with it. A busy JS thread only holds the rings apart longer, under the same picture.
    requestAnimationFrame(() => {
      void SplashScreen.hideAsync();
      setOpenedAt(Date.now());
      if (opening === "slide") {
        rings.value = withDelay(
          LAUNCH_BEAT_MS,
          withTiming(1, { duration: RINGS_MS, easing: RING_EASING }, (finished) => {
            // The weave switches on at the lock, as in DUO LOCKED.
            if (finished) woven.value = 1;
            // Reported however the slide ends, so nothing can keep the overlay up.
            runOnJS(markLocked)();
          }),
        );
      } else if (opening === "dissolve") {
        dissolve.value = withDelay(
          LAUNCH_BEAT_MS,
          withTiming(1, { duration: LAUNCH_DISSOLVE_MS, reduceMotion: ReduceMotion.Never }, () => {
            runOnJS(markLocked)();
          }),
          ReduceMotion.Never,
        );
      } else {
        markLocked();
      }
    });
  }

  // No report long after the lock was due: count it as locked, so a lost callback cannot keep the
  // overlay over a ready app.
  useEffect(() => {
    if (openedAt === null || lockedAt !== null) return;
    const timer = setTimeout(markLocked, msUntil(launchSchedule(opening).lockBackstopMs, openedAt, Date.now()));
    return () => clearTimeout(timer);
  }, [openedAt, lockedAt, opening, markLocked]);

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

  // Ready: fade out once the lock has been seen, and unmount.
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

  const overlayStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const breathStyle = useAnimatedStyle(() => ({ opacity: breath.value }));
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
