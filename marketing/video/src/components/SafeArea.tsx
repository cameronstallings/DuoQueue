/** Dev overlay. Not a design element: it draws the box every format has to keep its text
 * inside, and renders nothing at all unless it is asked for. */
import { AbsoluteFill } from "remotion";

import { darkColors, hairline } from "@app/theme/tokens";

import { px, SAFE } from "@/lib/scale";

/**
 * Two spellings on purpose. The Remotion CLI only forwards host environment variables whose
 * names begin with REMOTION_ into the browser bundle (everything else has to come from a .env
 * file or from `envVariables` on the Node render API), so `DEV_GUIDES=1 remotion still ...`
 * would silently draw nothing. The plan's name is kept as the one the render scripts pass
 * programmatically; the prefixed one is what works from a shell.
 */
const guidesOn = (): boolean =>
  process.env.DEV_GUIDES === "1" || process.env.REMOTION_DEV_GUIDES === "1";

/**
 * SAFE is in composition pixels, not app points: it is sized for the platform chrome
 * (TikTok's right rail and caption block, the worst of the three), which has nothing to do
 * with the app's own layout, so it is deliberately not run through px().
 */
export const SafeArea = () => {
  if (!guidesOn()) {
    return null;
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: SAFE.top,
          bottom: SAFE.bottom,
          left: SAFE.side,
          right: SAFE.side,
          // See Card: react-native is border-box everywhere, the DOM is not, and a guide
          // that reports the wrong bounds is worse than no guide.
          boxSizing: "border-box",
          borderWidth: px(hairline),
          borderStyle: "solid",
          borderColor: darkColors.volt,
        }}
      />
    </AbsoluteFill>
  );
};
