/**
 * THE END CARD, on the light ground and in this film's motion.
 *
 * The card is the one thing Cameron has consistently said he likes, so what is kept is its
 * ARGUMENT: the mark, the wordmark, a call to action with the shape of a button, and the URL
 * under it, arriving in that order on four events. What changes is everything the ground decides.
 *
 * =====================================================================================
 * THE PILL IS OFF-BLACK WITH CHARTREUSE WORDS, WHICH IS THE FILM'S THESIS ON ITS LAST FRAME
 * =====================================================================================
 *
 * The app draws its own primary button as a volt fill with an off-black label (`volt` / `onVolt`
 * in the theme), and on off-black that is exactly right at about 13:1. On this paper it is not
 * available: #CDFF3D on warm off-white is about 1.4:1, so a filled chartreuse shape has no
 * silhouette and a button loses the thing a button is read by.
 *
 * So the fill and the label swap. An off-black pill carrying raw chartreuse words has the same
 * 13:1, keeps the app's own button SHAPE, and restates the whole direction on the last frame
 * anybody remembers: a dark object with the brand burning inside it, sitting on a light ground.
 * The mark and the wordmark are the app's light-theme ink, which is what the app itself draws
 * them in on paper.
 *
 * =====================================================================================
 * THE TAGLINE IS SMALLER THAN THE BODY, WHICH IS MEASURED AND COUNTERINTUITIVE
 * =====================================================================================
 *
 * The measured end cards run a tagline at about 43px against body lines of 54 to 86 in the same
 * reel, on a 46% measure against the body's 63-75%. THE FILM WHISPERS AT THE END; IT DOES NOT
 * SHOUT. Converted: 65px on a 500px measure. The pill's label is set at 62 and the URL at 40, so
 * the last frame is the quietest in the film and the two smallest things on it are the two things
 * a viewer has to act on.
 *
 * =====================================================================================
 * IT ARRIVES THE WAY EVERY OTHER OBJECT IN THE FILM ARRIVES
 * =====================================================================================
 *
 * The lockup is a Plane in the film's one camera, so it enters rotated, oversized and smeared and
 * unwinds to flat over eight frames, exactly as the card and the device do. That is what makes it
 * the last object in a film rather than a title slide appended to one. The previous card slid an
 * opaque field in from the right; on this ground that would be the only field change in the film,
 * and the film holds ONE ground from its first frame to its last, which is what all three
 * reference reels do.
 *
 * The plane is filled "transparent" on purpose and that flag now means something: see the `fill`
 * prop in ../Plane. A transparent plane is a rotating frame of reference rather than an object,
 * so it casts no shadow. On off-black a shadow behind an empty rect was invisible; on paper it
 * would be a 760x620 grey halo around the brand.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";

import { Mark } from "@/components/Mark";
import type { Cta } from "@/config/phase";
import { FONT_FAMILY } from "@/lib/fonts";

import { CENTRE_X, FRAME, INK } from "./ground";
import { arrive, EASE, ramp } from "./motion";
import { Plane, Stage } from "./Plane";
import { DISPLAY } from "./type";

const MARK_W = 196;
const WORDMARK = 122;
const LABEL = 62;
const URL = 40;

/** The four events, in frames of the card's own 45. The lockup arrives on 0; the pill wipes at
 * 12; its label ignites while the wipe is still travelling, because a quartic out is 94% of the
 * way there at 60% of its duration and queueing the two end to end put four dead frames between
 * them; the URL lands at 24. */
const PILL_AT = 12;
const PILL_FRAMES = 11;
const URL_AT = 24;

export const End = ({ cta }: { cta: Cta }) => {
  const frame = useCurrentFrame();
  const pose = arrive(frame);

  const wipe = ramp(frame, PILL_AT, PILL_AT + PILL_FRAMES, 0, 1, EASE.quartOut);
  const url = ramp(frame, URL_AT, URL_AT + 8, 0, 1, EASE.quartOut);

  // The plane is sized to the lockup rather than the lockup being placed on a plane, so the
  // occlusion pool under it is the shape of the thing that is actually there.
  const width = 760;
  const height = 620;

  return (
    <Stage>
      <Plane
        name="end"
        pose={pose}
        cx={CENTRE_X}
        cy={Math.round(FRAME.h * 0.47)}
        width={width}
        height={height}
        radius={0}
        gloss={0}
        fill="transparent"
      >
        <AbsoluteFill
          style={{
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

          {/* The app's own primary button with its two colours the other way round: off-black
              fill, raw chartreuse label, the app's own full rounding. It wipes open from its own
              left edge rather than fading, so the shape arrives before the words in it do, which
              is the order a button is read in on a feed. */}
          <div style={{ position: "relative", marginTop: 22, padding: "26px 54px" }}>
            <AbsoluteFill
              style={{
                backgroundColor: INK.app,
                borderRadius: 999,
                transformOrigin: "0% 50%",
                transform: `scaleX(${wipe.toFixed(4)})`,
              }}
            />
            <div
              style={{
                position: "relative",
                fontFamily: DISPLAY,
                fontWeight: 800,
                fontSize: `${String(LABEL)}px`,
                lineHeight: `${String(Math.round(LABEL * 1.15))}px`,
                letterSpacing: "-0.02em",
                color: INK.brand,
                opacity: wipe > 0.55 ? 1 : 0,
              }}
            >
              {cta.line}
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              fontFamily: FONT_FAMILY.monoSemibold,
              fontSize: `${String(URL)}px`,
              letterSpacing: "0.16em",
              color: INK.dim,
              opacity: url,
              transform: `translateY(${((1 - url) * 22).toFixed(1)}px)`,
            }}
          >
            {cta.url}
          </div>
        </AbsoluteFill>
      </Plane>
    </Stage>
  );
};
