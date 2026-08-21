/**
 * CARD SIX: THE FILM'S END CARD, HELD STILL.
 *
 * The last frame of Pro-B is the one element of this campaign Cameron has consistently said he
 * likes, across ten rejected directions, so the last card of the carousel is that frame and not a
 * redesign of it for a different aspect. Every number below is copied from src/pro/End.tsx: the
 * 196px mark, the 122px wordmark, the 62px call to action inside the app's own fully rounded
 * button with its two colours the other way round, and the 40px URL in the app's mono at 0.16em.
 * The film's end card is 620px tall on a 1920 frame; it is 620px tall here too, which is the
 * meaning of "at the film's own numbers" rather than "scaled to fit".
 *
 * WHAT IS DROPPED IS ONLY THE TIME. The film's version arrives out of a perspective, wipes its
 * button open from its own left edge and lands its URL twelve frames later. A still has one frame,
 * so all four elements are simply present, at the pose and the opacity the film leaves them at.
 *
 * WHY THE URL IS ON THE CARD AT ALL, given that nothing on a PNG is tappable on either platform.
 * Because a reader who has swiped five cards has decided something, and the only honest thing to
 * hand them at that moment is a string they can type. The caption carries it as well, where it can
 * be copied; the earlier version of this set promised a link on the last card and there was never
 * a link, which is worse than not having promised.
 *
 * WHERE IT SITS is the one number that could not be copied. src/pro/End.tsx puts the lockup at 47%
 * of a 1920 frame, which is above centre, because a lockup's optical centre is above its geometric
 * one: the mark is the heaviest thing in it and the mark is on top. 47% of 1350 is 635, and the
 * card is not a bare frame the way the film's last shot is; it has a head row at 100 and a foot row
 * at 1198, so the band the lockup actually lives in is 1098px rather than 1350. Rendered at 635 the
 * box left 239px of paper under it and 173 above, which is the same defect the film's number exists
 * to avoid, arrived at by copying the film's number. Centred in the band it is at 649, and its
 * optical centre then lands about 640: above the middle of the card, which is what 47% meant.
 */
import { AbsoluteFill } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";
import { DISPLAY } from "@/pro/type";

import { CENTRE_X, FOOT_TOP, INK, INSET } from "./ground";

/** src/pro/End.tsx's four sizes, unchanged. The tagline is SMALLER than the body lines in both
 * measured reference end cards, which is the note that redesign took: the campaign whispers at the
 * end, it does not shout. */
const MARK_W = 196;
const WORDMARK = 122;
const LABEL = 62;
const URL = 40;

const WIDTH = 760;
const HEIGHT = 620;

export const Lockup = ({ cta }: { cta: Cta }) => (
  <AbsoluteFill
    style={{
      left: Math.round(CENTRE_X - WIDTH / 2),
      top: Math.round((INSET + FOOT_TOP) / 2 - HEIGHT / 2),
      width: WIDTH,
      height: HEIGHT,
      alignItems: "center",
      justifyContent: "center",
      gap: 30,
    }}
  >
    <Mark width={MARK_W} tone="light" />

    <div
      style={{
        fontFamily: FONT_FAMILY.displayBold,
        fontSize: `${String(WORDMARK)}px`,
        lineHeight: `${String(Math.round(WORDMARK * 1.14))}px`,
        letterSpacing: `${String(WORDMARK * 0.015)}px`,
        color: INK.type,
      }}
    >
      duoqueue
    </div>

    {/* The app's own primary button with its two colours reversed: off-black fill, raw chartreuse
        label, the app's own full rounding. Chartreuse is legal here and nowhere else on the ground,
        because here it is on a dark slab and has its 13:1. */}
    <div
      style={{
        marginTop: 22,
        padding: "26px 54px",
        borderRadius: 999,
        backgroundColor: INK.app,
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: `${String(LABEL)}px`,
        lineHeight: `${String(Math.round(LABEL * 1.15))}px`,
        letterSpacing: "-0.02em",
        color: INK.brand,
      }}
    >
      {cta.line}
    </div>

    <div
      style={{
        marginTop: 8,
        fontFamily: FONT_FAMILY.monoSemibold,
        fontSize: `${String(URL)}px`,
        letterSpacing: "0.16em",
        // The one string on the whole set somebody has to read off a screen and then TYPE, so it
        // is the last thing that should be set quietly. Dim (#5C6450) is 5.5:1 as a swatch but
        // does not survive being set: small, wide-tracked mono has strokes barely over a pixel,
        // antialiasing spends most of them, and the same treatment measured about 4.4:1 rendered
        // on the static sheets. Same fix here as there.
        color: INK.type,
      }}
    >
      {cta.url}
    </div>
  </AbsoluteFill>
);
