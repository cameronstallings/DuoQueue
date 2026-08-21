/**
 * THE DEVICE, as an object in a studio rather than as a mockup frame.
 *
 * The Saavi reference supplies the staging for this direction and nothing else, because that is
 * all it has: two flat devices at a fixed tilt on a flat colour field, identical scale on both, no
 * camera, no light and no screen events. It is an After Effects mockup preset, and copying it is
 * how a film ends up looking like the thing Cameron rejected.
 *
 * So this takes Uber's phone beat instead, f482-f510, where the device is presented straight on
 * and near full bleed and THE MOTION IS ON THE SCREEN - notification cards sliding up from behind
 * the glass and stacking - and then adds the three things neither reference has:
 *
 *   A SPECULAR SHEEN DRIVEN BY THE ROTATION. The band across the glass is a function of rotateY,
 *   so turning the device moves the light across it. A fixed highlight is a texture; a highlight
 *   that responds to the tilt is a light source, and it is most of what "studio" means.
 *
 *   A CONTACT SHADOW THAT SQUASHES WITH THE TILT. The pool under the device is an ellipse whose
 *   height collapses and whose offset slides as the device turns, because that is the projection
 *   of a rotating rectangle onto the ground plane. The measured Uber shadow does the same thing:
 *   at peak tilt the pool under the card's centre had moved 25px while the pool under its edge had
 *   not moved at all.
 *
 *   ONE PERSPECTIVE GESTURE. The measured trapezoid, spent once, on the beat that matters.
 *
 * THE BODY IS DRAWN, NOT PHOTOGRAPHED. `deck-dark-raw.mp4` is the screen only, 1180x2556, so the
 * bezel here is 14 source pixels of near-black around it with a hairline of the studio's own light
 * on the outside and a second, darker hairline inside: the double bezel that makes a rectangle
 * read as machined hardware instead of as a border. Both hairlines scale with the device.
 */
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";

import { elevation, PAPER, sheen } from "../ground";
import { Fragment } from "../media";
import type { Pose } from "../motion";
import { SmearDef, smearFilter } from "../Smear";
import { SURFACE } from "../surface";
import { useAppTheme } from "../theme";

/** The recording's own pixels. Every position on the glass is expressed in these and scaled. */
export const SCREEN = { w: 1180, h: 2556 } as const;

/** Bezel, in the recording's pixels, so it scales with the device rather than being a constant
 * number of frame pixels that thickens as the device recedes. */
const BEZEL = 15;

export const deviceHeight = (width: number): number =>
  Math.round((width * (SCREEN.h + BEZEL * 2)) / (SCREEN.w + BEZEL * 2));

/**
 * Where a rectangle of the recording lands on the frame, given the device's placement.
 *
 * This is what makes an element lift off the glass from the exact place it lives: the crop
 * rectangles in public/footage/README.md are in the recording's own coordinates, so a fragment can
 * start its flight at the pixels it was cut from.
 */
export const onGlass = (
  device: { cx: number; cy: number; width: number },
  rect: readonly [number, number, number, number],
): { cx: number; cy: number; width: number } => {
  const k = device.width / (SCREEN.w + BEZEL * 2);
  const [x, y, w, h] = rect;
  return {
    cx: device.cx + (x + w / 2 - SCREEN.w / 2) * k,
    cy: device.cy + (y + h / 2 - SCREEN.h / 2) * k,
    width: w * k,
  };
};

/**
 * The pool the device stands in.
 *
 * An ellipse rather than a box shadow, because a box shadow cannot squash. Its height collapses
 * with rotateX and its centre slides with rotateY, which is the projection of a turning rectangle
 * onto the ground, and it fades as the object lifts away from the surface.
 *
 * THE ALPHA IS THE GROUND'S. On off-black this was rgba(0,0,0,0.78) at 0.9 opacity, because a
 * shadow on black has to be nearly opaque to register at all. On paper that same pool is a black
 * smear under a phone. The measured Uber contact ring darkens its white ground by 5 to 9%, so the
 * pool is the ground's own warm near-black at an alpha that lands in that band, and it is the
 * same colour `elevation()` casts with so the two shadows in this direction agree.
 */
export const Contact = ({
  cx,
  cy,
  width,
  rotX,
  rotY,
  lift,
}: {
  cx: number;
  cy: number;
  width: number;
  rotX: number;
  rotY: number;
  /** 0 on the surface, 1 fully lifted. */
  lift: number;
}) => {
  const w = width * (0.92 - 0.12 * lift);
  const h = 62 * (1 - 0.45 * Math.abs(Math.sin((rotX * Math.PI) / 180)) * 2) * (1 + 0.5 * lift);
  const dx = 46 * Math.sin((rotY * Math.PI) / 180);
  return (
    <div
      style={{
        position: "absolute",
        left: Math.round(cx - w / 2 + dx),
        top: Math.round(cy - h / 2),
        width: Math.round(w),
        height: Math.round(Math.max(10, h)),
        borderRadius: "50%",
        background: "radial-gradient(closest-side, rgba(41,34,18,0.34), rgba(41,34,18,0) 100%)",
        filter: "blur(18px)",
        opacity: 0.9 - 0.35 * lift,
        pointerEvents: "none",
      }}
    />
  );
};

export const Device = ({
  pose,
  cx,
  cy,
  width,
  /** How far the glass has been racked out of focus, so a floating element in front of it is the
   * subject. 0 is sharp. */
  defocus = 0,
  z = 0,
  from = 0,
  startAt = 0,
  children,
}: {
  pose: Pose;
  cx: number;
  cy: number;
  width: number;
  defocus?: number;
  z?: number;
  from?: number;
  /** The composition frame the device came on screen, so the recording on its glass is rebased
   * to it. deck-dark-raw is 486 frames and the film is 551, so an unrebased screen goes black
   * for the last shot of the film. See the `startAt` note in src/pro/media.tsx. */
  startAt?: number;
  children?: ReactNode;
}) => {
  const theme = useAppTheme();
  const height = deviceHeight(width);
  // THE BODY TAKES THE DARK LAW IN BOTH FILMS, deliberately. ../surface strengthens the shadow
  // and swaps the bevel for the app's own hairline when an object is MADE OF light-theme footage
  // and has therefore lost its own contrast against the paper. This body is drawn rather than
  // photographed, and it is near-black machined hardware whichever theme is running on the glass
  // inside it, so it keeps its 200 luma step for free. Giving it the light law would move the
  // dark film's shadow for a reason that has nothing to do with the app.
  const { shadow, rim } = elevation(pose.rotX, pose.rotY);
  const k = width / (SCREEN.w + BEZEL * 2);
  const bezel = Math.max(2, Math.round(BEZEL * k));
  const radius = Math.round(96 * k * (SCREEN.w / 1180));

  return (
    <>
      <SmearDef name="device" x={pose.smearX} y={pose.smearY} />
      <div
        style={{
          position: "absolute",
          left: Math.round(cx - width / 2),
          top: Math.round(cy - height / 2),
          width,
          height,
          borderRadius: radius,
          // The outer shell: near-black machined body, not a grey stroke. Every stop is OPAQUE,
          // which it was not on the dark ground: the last stop used to be #050604 at 31% alpha so
          // the body could fall away into a field that was the same colour anyway. On paper a
          // translucent corner is a hole, and the phone reads as a decal rather than as hardware.
          background: "linear-gradient(158deg, #2A2E24 0%, #141710 44%, #080906 100%)",
          boxShadow: shadow,
          opacity: pose.opacity,
          filter: smearFilter("device", pose.smearX, pose.smearY),
          transform: [
            `translateZ(${z.toFixed(1)}px)`,
            `rotateX(${pose.rotX.toFixed(3)}deg)`,
            `rotateY(${pose.rotY.toFixed(3)}deg)`,
            `rotateZ(${pose.rotZ.toFixed(3)}deg)`,
            `scale(${pose.scale.toFixed(4)})`,
          ].join(" "),
        }}
      >
        {/* The inner core, with its own radius so the two curves are concentric. */}
        <div
          style={{
            position: "absolute",
            inset: bezel,
            borderRadius: Math.round(radius - bezel * 0.7),
            overflow: "hidden",
            backgroundColor: SURFACE[theme].field,
            filter: defocus > 0.05 ? `blur(${(defocus * 9).toFixed(1)}px)` : undefined,
          }}
        >
          <Fragment frag="screen" from={from} startAt={startAt} />
          {/* THE FALLOFF, and it is a content rule wearing a lighting rule.

              This direction is the only one that shows the WHOLE screen, and the whole screen
              contains Kofi's prompt answer: "Hit Grand Champion in Rocket League SOLO QUEUE. Took
              two years. Worth it." Measured off the render, at DEVICE_W 760 those words are about
              24px tall and perfectly legible for the 110 frames the device is sharp. A film whose
              second line is "duoqueue is where you find the next one" cannot spend 3.7 seconds
              with SOLO QUEUE on the glass, and src/pro/media.tsx already refuses the `prompt` and
              `card-lower` crops for exactly this reason - this is the same rule, applied to the
              one shot that shows the screen entire.

              A band over just those words would be a redaction bar, because the prompt sits in a
              gap between two things that must stay lit. Measured off the recording itself by row
              luminance, as fractions of its 2556px height:

                0.579-0.585   26 . Africa . EN
                0.593-0.605   ROCKET LEAGUE . Ranked Grinder
                0.629-0.636   MY PROUDEST GAMING ACHIEVEMENT IS
                0.647-0.661   prompt line one, the one with SOLO QUEUE in it
                0.675-0.690   prompt line two

              So the glass is LIT instead: the light falls off below the game chip. That is how a
              device is lit in every reference of this kind, it puts the card's photograph, name
              and playstyle in the light and drops the rest into shadow, and the things that live
              down there are not lost from the film - the games chip and the send button LIFT OFF
              the glass into the light a beat later, which is this direction's whole argument.

              The stops are the measurement. Transparent through 0.607, which clears the chip at
              0.605; fully opaque at 0.643, which is BEFORE the prompt's first line begins at
              0.647. The first attempt here ran to 0.97 at 0.655 and the prompt stayed readable,
              because 0.655 is past the top of the text rather than above it: the opaque stop has
              to land before 0.647, not near it. The label at 0.629 is left half lit on purpose,
              since it says nothing that contradicts the voice and a gradient that dies mid-label
              is what makes this read as falloff rather than as a mask.

              THE COLOUR IT FALLS TO IS THE THEME'S, and it is the one place the light film is not
              simply the dark film with other footage in it. Both stops are lighting rather than
              graphics. On the dark screen the light dies into the app's own near black and the
              gradient is invisible AS a gradient, because everything it crosses is already that
              value. On the light screen that same near black would be a hard horizontal bar laid
              across a bright phone, and it would still be there below the card, where the app's
              own field is #F2F4EB. So the light screen BLOWS OUT instead: the wash runs to the
              app's own paper, which erases dark type exactly as the black erases light type, and
              which below the card IS the field colour already, so the falloff has no visible edge
              on either theme. The 60.7 to 64.3 span is identical in both and lands over the card's
              photograph in both, because the deck card is a photograph in both themes. */}
          <AbsoluteFill
            style={{
              backgroundImage: `linear-gradient(to bottom, rgba(${SURFACE[theme].falloff},0) 60.7%, rgba(${SURFACE[theme].falloff},1) 64.3%, rgba(${SURFACE[theme].falloff},1) 100%)`,
              pointerEvents: "none",
            }}
          />
          {/* The glass washes toward the ground as it goes out of focus, so the chip floating in
              front of it is the only thing on the frame still holding full contrast. On off-black
              this scrim was #05060A and it DARKENED, because there the lifted chip was the bright
              object. On paper both are dark and the near plane wins by staying dark while the far
              one fades toward the paper, which is the same atmospheric perspective every recede in
              these three films now uses. */}
          <AbsoluteFill
            style={{
              backgroundColor: `rgba(${PAPER},1)`,
              opacity: defocus * 0.32,
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Anything travelling off the glass is drawn inside the device's own space so that it
            inherits the device's rotation until the moment it separates. */}
        {children}

        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            backgroundImage: sheen(pose.rotY, 1),
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: radius,
            boxShadow: `inset 0 0 0 1.5px ${rim}, inset 0 0 0 ${String(bezel)}px rgba(0,0,0,0.55)`,
            pointerEvents: "none",
          }}
        />
      </div>
    </>
  );
};
