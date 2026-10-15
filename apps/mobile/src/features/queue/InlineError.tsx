import Animated from "react-native-reanimated";

import { quickEntering, quickExiting } from "@/theme/entering";
import { useTheme } from "@/theme/useTheme";

/**
 * A failure said under the button that failed: Queue up and Stop in the Queue Up sheet, Stop on
 * Online Now's status card, I'm in on the Duo Pop card.
 *
 * Why not the toast. Every one of those buttons sits on a React Native Modal (the sheet) or a
 * modal screen (Online Now, the Pop card), and the app's one Toast is mounted at the root, under
 * all of them: it drew behind the panel and was gone in 2 s, so a failed Queue up was one buzz and
 * nothing to read. Here it stays until the next try, the sheet opening again, or the screen going.
 *
 * Danger on the sheet's surfaceSolid and on the screens' background, both audited pairs. The buzz
 * is the caller's (useQueueUp.ts, the Pop card), fired once when the failure lands. Keyed by the
 * message, so a different failure fades in rather than swapping its words in place.
 */
export function InlineError({ message, align = "center" }: { message: string | null; align?: "center" | "right" }) {
  const { colors, type } = useTheme();
  if (!message) return null;
  return (
    <Animated.Text
      key={message}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      entering={quickEntering()}
      exiting={quickExiting()}
      style={[type.caption, { color: colors.danger, textAlign: align }]}
    >
      {message}
    </Animated.Text>
  );
}
