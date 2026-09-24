import { withDelay, withSpring } from "react-native-reanimated";

import { LAUNCH_POP_SPRING } from "./launchTiming";

/**
 * The pop's kick, assigned to the mark's scale on the UI thread the frame the rings reach the lock.
 * The scale is at rest at exactly 1 then, and the pop is a spring to 1 with a start velocity, so
 * a bare `withSpring(1, LAUNCH_POP_SPRING)` would never run: Reanimated 4.1.7's value setter
 * (valueSetter.js) drops any animation that is not higher-order and whose target equals the
 * current value. It calls the completion callback and returns, so the velocity is thrown away and
 * the mark never pops.
 *
 * withDelay is higher-order, so it gets past that check. At 0ms it starts the spring on the same
 * frame, and it hands the spring the scale's previous animation, which is none (the scale has
 * never moved before the lock), so the velocity stays LAUNCH_POP_SPRING's 2.9288 and is not added
 * to anything. launchPop.test.ts runs this through Reanimated's own setter, withDelay and
 * withSpring.
 */
export function launchPopKick() {
  "worklet";
  return withDelay(0, withSpring(1, LAUNCH_POP_SPRING));
}
