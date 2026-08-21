/**
 * ONE SHEET, DRAWN AS A FRAME OF THE CAMPAIGN THAT HAPPENS NOT TO MOVE.
 *
 * =====================================================================================
 * WHAT IS SHARED WITH THE FILM AND THE CAROUSEL, LITERALLY RATHER THAN IN SPIRIT
 * =====================================================================================
 *
 * `Stage` and `Plane` from src/pro/Plane.tsx           the camera, the shadow, the sheen, the rim
 * `Fragment` from src/pro/media.tsx                    the footage, per theme, rebased and held
 * `AppThemed` from src/pro/theme.tsx                   which half of the fragment table is drawn
 * `groupSize`, `wordsOf`, `DISPLAY` from src/pro/type  the fitting law and the accent
 * `GESTURE` from src/pro/motion.ts                     the only two angles a still is allowed
 * `GROUND`, `INK`, `TYPE`, `MEASURE` from ./ground     which re-export src/pro/ground unchanged
 * `Grain` from src/pro/Field.tsx                       the dither that stops the sweep banding
 *
 * There is no second implementation of any of it, which is the property src/carousel/Card.tsx has
 * and the reason both of them are on src/pro rather than beside it.
 *
 * =====================================================================================
 * THE ONE THING A STILL AD ADDS THAT NEITHER OF THE OTHERS HAS
 * =====================================================================================
 *
 * A CALL TO ACTION IN THE BRAND'S ACTUAL COLOUR, ON A SHEET WHOSE PRODUCT IS PALE.
 *
 * The light cut of the film costs the campaign its chartreuse and the number is brutal: isolating
 * #CDFF3D across the four finished reels gives pro-a 0.330%, pro-b 0.244%, pro-a-light 0.027% and
 * pro-b-light 0.025%. A twelfth. The app's light theme substitutes a forest green everywhere the
 * dark theme burns chartreuse, so a light film's only brand colour is its own end card.
 *
 * A STILL CAN HAVE BOTH, AND THE FILM CANNOT, because the ask on a still is FURNITURE the campaign
 * controls rather than footage it recorded. `Ask` below draws the film's own end card lockup: the
 * app's primary button with its two colours the other way round, off-black fill and raw #CDFF3D
 * label, which is 16.9:1 and is the one place chartreuse is legal on this ground. So the light
 * sheet keeps a pale product AND carries real brand colour, in the same frame, at the moment the
 * reader is deciding. The light film has to choose. This does not.
 *
 * MEASURED ON THE FINISHED FILES, isolating #CDFF3D at the tolerance that reproduces the four
 * film numbers above: the pill's own band carries 0.244% of the feed frame in BOTH themes, and
 * the whole object band carries 0.023% light and 0.020% dark. So the ask is 91% of all the brand
 * colour on the sheet, the light sheet lands at 0.268% against the light film's 0.029%, and the
 * two themes measure within four thousandths of each other rather than a factor of twelve.
 *
 * WHICH IS THE HONEST SHAPE OF THIS DELIVERABLE AND WORTH SAYING PLAINLY: on these two crops the
 * app theme is nearly free. The deck card is a PHOTOGRAPH in both themes, so the only chartreuse
 * inside the dark fragment is the card's NO. 001 serial, which measures 0.004% of the frame at an
 * exact match; and the games chip is amber in both, because tokens.ts buckets an overlap of three
 * or more as `many` and paints it #FFB627 whichever theme is on. The pair still differs, in the
 * card's chrome, its corners, its serial and the chip's fill, and the dark sheet reads with more
 * contrast at the same mean luma. It does not differ in brand colour, and pretending otherwise by
 * swapping in a fragment that does would have cost the platonic read. See ./plan.ts.
 */
import { AbsoluteFill } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";
import { Grain } from "@/pro/Field";
import { FRAGMENTS, Fragment } from "@/pro/media";
import { GESTURE, REST } from "@/pro/motion";
import { Plane, Stage } from "@/pro/Plane";
import { AppThemed, type AppTheme } from "@/pro/theme";
import { DISPLAY, groupSize, useFaces, wordsOf } from "@/pro/type";

import {
  CENTRE_X,
  GROUND,
  INK,
  INSET,
  LAYOUT,
  MEASURE,
  MONO,
  PIECE_GAP,
  TYPE,
  type SizeName,
  type StaticLayout,
} from "./ground";
import { KEY_WORD, OBJECT, POSE_AMOUNT, STAMP, STATEMENT, type Piece } from "./plan";

/** The crop's own aspect is what turns a stated width into a height, so nothing is ever
 * stretched and no height on this sheet is a number anybody chose. */
const heightOf = (piece: Piece, width: number): number => {
  const [w, h] = FRAGMENTS[piece.piece].source;
  return Math.round((width * h) / w);
};

/**
 * THE STATEMENT. Read first, and the two properties that make it so are both in this component:
 * `groupSize` fits it to the film's measure, which is what makes it the largest type on the
 * frame, and it stands on bare paper with the object 78px below it, which is what makes it the
 * only isolated type on the frame.
 *
 * It is set by the film's own fitter and drawn by hand, exactly as src/carousel/Card.tsx sets its
 * headline: `Words` in src/pro is a per-word build with a cadence, an exit and a smear, and on a
 * frame that never advances every one of those is either identity or a bug waiting to happen.
 *
 * THE BLOCK IS BOTTOM ANCHORED on ./ground's `base`. If a line fits larger than the estimate in
 * ./plan the block grows UPWARD into its own top air and the object does not move, which is the
 * only direction a surprise is allowed to travel on a sheet where the object's height was solved
 * against the frame.
 */
const Statement = ({ layout }: { layout: StaticLayout }) => {
  const size = groupSize(STATEMENT, MEASURE);
  const leading = Math.round(size * TYPE.leading);
  const rows = wordsOf(STATEMENT, KEY_WORD);
  const height = leading * rows.length;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: layout.base - height,
        width: "100%",
        height,
      }}
    >
      {rows.map((words, row) => (
        <div
          key={`${words.map((word) => word.text).join(" ")}-${String(row)}`}
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            // 0.28em, which is src/pro/Words.tsx's measured word gap.
            gap: Math.round(size * 0.28),
            height: leading,
            width: "100%",
          }}
        >
          {words.map((word) => (
            <span
              key={`${word.text}-${String(word.index)}`}
              style={{
                display: "inline-block",
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: `${String(size)}px`,
                lineHeight: `${String(leading)}px`,
                letterSpacing: TYPE.tracking,
                color: word.key ? INK.accent : INK.type,
                whiteSpace: "pre",
              }}
            >
              {word.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * THE PRODUCT. Read second, on area.
 *
 * Two pieces, ONE pose, one width, one top edge and one bottom edge of the group. See ./plan for
 * why it is these two pieces, why the chip is on top, and why the pose is the gesture rather than
 * the arrival.
 */
const Product = ({ layout }: { layout: StaticLayout }) => {
  const width = layout.object.width;
  const heights = OBJECT.map((piece) => heightOf(piece, width));
  const pose = {
    ...REST,
    rotX: GESTURE.rotX * POSE_AMOUNT,
    rotY: GESTURE.rotY * POSE_AMOUNT,
  };

  let y = layout.object.top;
  return (
    <Stage>
      {OBJECT.map((piece, i) => {
        const height = heights[i] ?? 0;
        const cy = y + height / 2;
        y += height + PIECE_GAP;
        return (
          <Plane
            key={piece.piece}
            name={`static-${piece.piece}`}
            pose={pose}
            cx={CENTRE_X}
            cy={cy}
            width={width}
            height={height}
            radius={Math.round(width * piece.round)}
            // A chip cut out of a screen recording is matte; a whole card is glass. The same two
            // values the carousel gives the same two kinds of object.
            gloss={height > 300 ? 0.26 : 0.18}
          >
            <Fragment frag={piece.piece} />
          </Plane>
        );
      })}
    </Stage>
  );
};

/** The mono voice. The address and the stamp, and nothing else is ever set in it. */
const Mono = ({
  text,
  size,
  leading,
}: {
  text: string;
  size: number;
  leading: number;
}) => (
  <div
    style={{
      fontFamily: FONT_FAMILY.monoSemibold,
      fontSize: `${String(size)}px`,
      lineHeight: `${String(leading)}px`,
      letterSpacing: MONO.tracking,
      textTransform: "uppercase",
      // INK.type, not INK.dim, and the reason is measured rather than stylistic.
      //
      // Both mono rows used to be dim (#5C6450), which is 5.5:1 on the ground as a flat swatch
      // and passes AA on paper. It does not survive being SET: at 22px with 0.18em tracking the
      // strokes are a pixel and a half wide, antialiasing spends most of them, and the rendered
      // line measured ink 98 against a ground of 222, about 4.4:1. The two rows that came out
      // weakest on the sheet were the URL somebody has to read and type, and the line that says
      // 18 PLUS and PLATONIC, which is the sheet's whole defence against being filed as a dating
      // ad.
      //
      // The hierarchy that dim was buying is already paid for twice over: the stamp is 22px
      // against the address's 28, and the address has the mark beside it. Spending contrast on
      // the same distinction as well is what pushed the quiet line under the floor. At INK.type
      // the foot measures about 15.9:1 and the sheet still ends on its smallest row.
      color: INK.type,
      whiteSpace: "pre",
    }}
  >
    {text}
  </div>
);

/** One centred row of the foot lockup. Every row is this component, so the three of them cannot
 * drift off the frame's one horizontal centre. */
const Row = ({
  top,
  height,
  gap = 0,
  children,
}: {
  top: number;
  height: number;
  gap?: number;
  children: React.ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      left: INSET,
      top,
      width: 1080 - INSET * 2,
      height,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap,
    }}
  >
    {children}
  </div>
);

/**
 * THE ASK. Read last, on size, and impossible to miss, on colour.
 *
 * Three rows, in the order a reader needs them: what to do, where, and what this is. The pill is
 * src/pro/End.tsx's, at the size each placement earns; the address is the film's own 0.16em mono;
 * the stamp is the carousel's running-head voice, one step smaller than the address so the sheet
 * ends on its quietest line rather than its loudest.
 *
 * THE MARK SITS WITH THE ADDRESS rather than on a corner, and that is the one place this sheet
 * departs from the carousel's furniture rule. The carousel's mark is a running head on a numbered
 * set: it tells a reader which account is talking on card four of six. A single sheet has one
 * lockup and the mark belongs in it, beside the address, where a mark and an address have always
 * gone. It also costs nothing: the row is as tall as the address line either way, where a head
 * row would have cost the object 124px of height.
 */
const Ask = ({ layout, cta }: { layout: StaticLayout; cta: Cta }) => {
  const label = layout.cta.label;
  const pillHeight = layout.cta.padY * 2 + Math.round(label * 1.15);
  const addressLeading = Math.round(layout.address.size * 1.22);
  const stampLeading = Math.round(layout.stamp.size * 1.22);
  return (
    <>
      <Row top={layout.cta.top} height={pillHeight}>
        {/* The app's own primary button with its two colours reversed: off-black fill, raw
            chartreuse label, the app's own full rounding. Chartreuse is legal here and nowhere
            else on this ground, because here it is on a dark slab and has its 16.9:1. */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: pillHeight,
            padding: `0 ${String(layout.cta.padX)}px`,
            borderRadius: 999,
            backgroundColor: INK.app,
            fontFamily: DISPLAY,
            fontWeight: 800,
            fontSize: `${String(label)}px`,
            lineHeight: `${String(Math.round(label * 1.15))}px`,
            letterSpacing: "-0.02em",
            color: INK.brand,
            whiteSpace: "pre",
          }}
        >
          {cta.line}
        </div>
      </Row>

      <Row
        top={layout.address.top}
        height={Math.max(addressLeading, Math.round(layout.address.mark * 0.62))}
        gap={layout.address.gap}
      >
        <Mark width={layout.address.mark} tone="light" />
        <Mono text={cta.url} size={layout.address.size} leading={addressLeading} />
      </Row>

      <Row top={layout.stamp.top} height={stampLeading}>
        <Mono text={STAMP} size={layout.stamp.size} leading={stampLeading} />
      </Row>
    </>
  );
};

/**
 * THE SHEET.
 *
 * `theme` is which half of the fragment table the object is cut from, and nothing else: the
 * ground, the camera, the grid, the type, the inks and the ask are identical across the pair, so
 * the two files differ only in which app theme Cameron had on the phone when he recorded. That is
 * the same comparison src/pro/a and src/pro/b are registered twice for.
 */
export const Still = ({
  size,
  theme,
  cta,
}: {
  size: SizeName;
  theme: AppTheme;
  cta: Cta;
}) => {
  // fitText caches its measurement for the life of the page, so a size taken before the brand
  // faces land would typeset the whole sheet for a typeface it does not contain. A still has
  // exactly one frame in which to get that wrong.
  const loaded = useFaces();
  const layout = LAYOUT[size];

  if (!loaded) {
    return <AbsoluteFill style={{ backgroundColor: GROUND.base }} />;
  }

  return (
    <AppThemed theme={theme}>
      <AbsoluteFill
        style={{ backgroundColor: GROUND.base, width: layout.w, height: layout.h }}
      >
        <AbsoluteFill style={{ backgroundImage: GROUND.sweep }} />
        <AbsoluteFill style={{ backgroundImage: layout.pool }} />
        <Statement layout={layout} />
        <Product layout={layout} />
        <Ask layout={layout} cta={cta} />
        {/* Nothing is drawn in layout.sticker. That band is the deliverable on the story sheet:
            160px of empty paper where the link sticker lands, so the one placement that can reach
            the waitlist in a single tap does not have to put the sticker on top of the ad. */}
        <Grain />
      </AbsoluteFill>
    </AppThemed>
  );
};
