/** The last two and a half seconds of every post. One ending, one call to action, and the
 * only thing in the pipeline that changes between the waitlist and the App Store. */
import { AbsoluteFill } from "remotion";

import { darkColors, spacing, type as typeScale } from "@app/theme/tokens";

// The resolved call to action is handed in as a prop and this component never reads
// process.env: phase.ts resolves it, render-day checks it before bundling, and it travels the
// rest of the way as data, so no render can quietly burn a placeholder URL into a finished
// video. The import is type-only, so none of phase.ts is pulled into the browser bundle here.
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";
import { display, DISPLAY_LEADING, px, SAFE } from "@/lib/scale";
import { textStyle } from "@/lib/text-style";

import { Lockup } from "./Lockup";
import { Stage } from "./Stage";
import { Tick } from "./Tick";

/** 2.5 seconds at 30fps. Long enough to read a line and a URL, short enough that it is not
 * the reason someone scrolls. Task 8's calculateMetadata adds it to every hook's duration. */
export const END_CARD_FRAMES = 75;

/** In composition pixels, like SAFE, because this is a video layout decision and not app
 * chrome. Deliberately smaller in proportion than the app's welcome screen (220 of 393, so
 * 56%): here the lockup shares the frame with a call to action and a URL, and at that share
 * it would crowd both. */
const LOCKUP_WIDTH = 420;

/** Deliberately static. It is the frame a viewer has the least time on, the one a still is
 * taken of for the cover image, and the one that has to be legible the instant it arrives. */
export const EndCard = ({ cta }: { cta: Cta }) => (
  <Stage>
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: px(spacing.xl),
        // The safe box, as padding. Nothing here is measured with fitText, so this is what
        // stops a long call to action or a long store URL from running to the frame edge and
        // under the platform chrome.
        paddingLeft: SAFE.side,
        paddingRight: SAFE.side,
      }}
    >
      <Lockup width={LOCKUP_WIDTH} />
      <div
        style={{
          fontFamily: FONT_FAMILY.bold,
          fontSize: `${display.sub}px`,
          lineHeight: `${display.sub * DISPLAY_LEADING}px`,
          color: darkColors.text,
          textAlign: "center",
        }}
      >
        {cta.line}
      </div>
      {/* type.label is already Plex Mono SemiBold, uppercase, 1.2 tracking: the same three
          values the plan names, taken from the token rather than restated. */}
      <div
        style={{
          ...textStyle(typeScale.label),
          color: darkColors.volt,
          textAlign: "center",
          // A URL has nothing the browser will break on, so without this it would ignore the
          // padding above and overflow. Two centred mono lines is not pretty; off the frame
          // is worse. Keeping the store link in its short form (apps.apple.com/app/id...)
          // keeps it on one line.
          overflowWrap: "anywhere",
        }}
      >
        {cta.url}
      </div>
      <Tick>18+ / IOS / US</Tick>
    </AbsoluteFill>
  </Stage>
);
