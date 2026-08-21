/**
 * THE LAST CARD, and it is the film's end card standing still.
 *
 * The end card is the one element of this campaign Cameron has consistently said he likes,
 * across eight rejected cuts, so nothing about it is redesigned for the aspect. Every number
 * below is src/frag/FragEnd.tsx's: the mark at 250, the wordmark at 152 over 176 with 2%
 * tracking, the 40px gaps, the slab's 26px of separation and its 22 by 42 padding, the call
 * to action at 68 over 78 at minus 2% tracking, the URL at 44 in mono at 12% tracking. Those
 * are all decisions about a 1080px wide field, and this is the same field.
 *
 * WHAT IS DROPPED IS THE CHOREOGRAPHY AND NOTHING ELSE. The film's card has four events: the
 * lockup arrives on the seam picking up the leftward current, the slab wipes open from its
 * left edge, the URL lifts in four frames before that wipe nominally finishes, and the whole
 * thing holds. A still is the last of those four states, so the slab is drawn open and the
 * URL drawn landed, and the three transitions have nowhere to happen.
 *
 * =====================================================================================
 * THE INVERSION IS THE POINT, AND IT IS WHY THE SLAB IS NOT CHARTREUSE
 * =====================================================================================
 *
 * #CDFF3D on this ground is about 1.4:1, so a filled chartreuse shape on warm off-white has
 * no edge and a button loses the thing a button is read by, which is its silhouette. So the
 * slab is the app's own off-black and the words on it are raw chartreuse, at about 13:1.
 *
 * That is also the campaign's thesis restated on its last frame: a dark object carrying
 * chartreuse, sitting on a light ground. The mark and the wordmark are the app's light theme
 * ink, which is what the app itself draws them in on paper.
 *
 * =====================================================================================
 * IT IS CENTRED ON THE FRAME AND NOT ON THE STAGE, WHICH IS A CHANGE FROM THE FILM
 * =====================================================================================
 *
 * The film puts its lockup's optical centre on STAGE_Y, where every object in the body
 * landed, because the brand arriving in the place the product just vacated is the point of
 * that seam. There is no seam here. Six cards are six separate pictures, and a lockup hung
 * at 866 on a 1350 frame would put its bottom edge 8px off the counter with 500px of empty
 * ground above it: a motion argument reproduced as a composition mistake.
 *
 * So it centres between the spine label and the counter, which sit at 150 and 1200 and are
 * symmetric about the frame's own centre at 675. The lockup runs about 653px tall, so it has
 * a clear 175px of air above and below it inside that band.
 */
import { AbsoluteFill } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";

import { INK, INSET } from "./ground";

const MARK_WIDTH = 250;
const WORDMARK = 152;

export const Lockup = ({ cta }: { cta: Cta }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      paddingLeft: INSET,
      paddingRight: INSET,
      gap: 40,
    }}
  >
    <Mark width={MARK_WIDTH} tone="light" />

    <div
      style={{
        fontFamily: FONT_FAMILY.displayBold,
        fontSize: `${String(WORDMARK)}px`,
        lineHeight: `${String(Math.round(WORDMARK * 1.16))}px`,
        letterSpacing: `${String(WORDMARK * 0.02)}px`,
        color: INK.type,
      }}
    >
      duoqueue
    </div>

    {/* The call to action as a filled slab rather than a line of text: in a feed the shape of
        a button is read before the words in it are. Off-black fill, chartreuse words. */}
    <div
      style={{
        marginTop: 26,
        padding: "22px 42px",
        backgroundColor: INK.slab,
        fontFamily: FONT_FAMILY.extrabold,
        fontSize: "68px",
        lineHeight: "78px",
        letterSpacing: "-0.02em",
        color: INK.brand,
      }}
    >
      {cta.line}
    </div>

    <div
      style={{
        fontFamily: FONT_FAMILY.monoSemibold,
        fontSize: "44px",
        letterSpacing: "0.12em",
        color: INK.type,
      }}
    >
      {cta.url}
    </div>
  </AbsoluteFill>
);
