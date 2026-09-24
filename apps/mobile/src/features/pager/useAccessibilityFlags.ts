import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

/**
 * Reduce Motion, live. Reanimated's useReducedMotion() is read once at launch; this starts from
 * it (so the first frame is right) and follows the switch while the screen is open, as
 * Previously's pagers do.
 */
export function useReduceMotionLive(): boolean {
  const atLaunch = useReducedMotion();
  const [reduce, setReduce] = useState(atLaunch);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduce(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => setReduce(value));
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}

/** Whether VoiceOver (or TalkBack) is running, so the peek can stand down for it. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((value) => {
      if (alive) setOn(value);
    });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", (value) => setOn(value));
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  return on;
}
