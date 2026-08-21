/**
 * THE OBJECT. One rectangle, in one camera, with real corners.
 *
 * A Plane is drawn inside a <Stage>, which owns the film's single `perspective`. Because the
 * perspective lives on the parent and the rotation lives on the plane, the browser projects the
 * plane: its four corners move INDEPENDENTLY, its near edge grows, its far edge foreshortens,
 * and the straight lines inside it converge. That is the whole finding. The rejected direction
 * held a constant `rotateY(7deg) rotateX(2deg)` at a 2400px perspective for the length of a film,
 * which is a mockup preset; a rotation that unwinds to flat over eight frames at a 1400px
 * perspective is a 3D move.
 *
 * TWO STRUCTURAL RULES THAT ARE EASY TO BREAK BY ACCIDENT.
 *
 *   `perspective` REACHES ONLY DIRECT CHILDREN. Any wrapper between the stage and the plane
 *   flattens every rotation in the film into a 2D shear, silently. So the plane carries its own
 *   smear filter and its own opacity rather than being wrapped in elements that carry them.
 *
 *   A FILTER ON AN ANCESTOR FLATTENS 3D. Same failure, same silence. The smear is on the plane
 *   itself for the same reason.
 *
 * THE SURFACE. Three layers over the content, all of them driven by the live rotation:
 *
 *   the RIM, a hairline of the studio's own light along the object's edge, brightest when the
 *   face is square to camera, because that is when a bevel catches a key light;
 *   the SHEEN, a specular band whose position across the face is a function of rotateY, which is
 *   what a fixed light does when you turn a phone in your hand. Neither reference reel has this,
 *   and it is the thing that separates an object in a studio from a picture of one;
 *   the ELEVATION, a shadow on paper whose offset and spread are computed from the rotation, so
 *   it is the projection of the tilted quad rather than a filter riding along behind it. On the
 *   light ground this is the reference's own occlusion ring at the alphas it was measured at,
 *   rather than the inversion the dark cut had to build.
 *
 * A plane with `fill: "transparent"` is not an object and gets none of the three; see the prop.
 */
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill } from "remotion";

import { CAMERA } from "./ground";
import { SmearDef, smearFilter } from "./Smear";
import type { Pose } from "./motion";
import { elevationOf, faceLight, SURFACE } from "./surface";
import { useAppTheme } from "./theme";

/** The film's one camera. Everything that rotates is a direct child of one of these. */
export const Stage = ({
  children,
  origin = CAMERA.origin,
  style,
}: {
  children: ReactNode;
  origin?: string;
  style?: CSSProperties;
}) => (
  <AbsoluteFill
    style={{ perspective: `${String(CAMERA.perspective)}px`, perspectiveOrigin: origin, ...style }}
  >
    {children}
  </AbsoluteFill>
);

export interface PlaneProps {
  /** Unique within a frame; it names this plane's smear filter. */
  name: string;
  pose: Pose;
  /** The plane's centre on the frame. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  radius?: number;
  /** Extra Z, in the stage's perspective, for layers that live at different depths. Negative is
   * further away, and it is what makes a camera move produce parallax rather than a zoom. */
  z?: number;
  /** How strongly this surface takes the key light. A device is glass and takes it all; a chip
   * cut out of a screen recording is matte and takes a third. */
  gloss?: number;
  /**
   * Painted under the content, so a rounded corner reveals the app's own field rather than a
   * sliver of the ground through an antialiased edge. Left unset it is whichever theme's
   * background this film was shot in; see ./theme.tsx.
   *
   * "transparent" means THIS PLANE IS NOT AN OBJECT, only a rotating frame of reference, and it
   * turns off the shadow, the sheen and the rim with it. On the dark ground that distinction cost
   * nothing, because a black pool under a transparent rect on a black field is invisible. On
   * paper it is the difference between a lockup arriving in the film's camera and a lockup
   * arriving inside a 760x620 grey halo with nothing in it.
   */
  fill?: string;
  /**
   * How far a caller has already washed this plane's CONTENT toward the paper, 0 to 1, for a
   * caller that recedes an object by drawing a scrim inside it rather than by taking its opacity
   * down. The shadow and the rim are outside that scrim and would otherwise survive it; see the
   * `veil` note in ./surface.
   */
  veil?: number;
  children: ReactNode;
}

export const Plane = ({
  name,
  pose,
  cx,
  cy,
  width,
  height,
  radius = 26,
  z = 0,
  gloss = 0.34,
  fill,
  veil = 0,
  children,
}: PlaneProps) => {
  const theme = useAppTheme();
  const paint = fill ?? SURFACE[theme].field;
  const { shadow, rim, rimWidth } = elevationOf(pose.rotX, pose.rotY, theme, veil);
  const key = faceLight(pose.rotY, gloss, theme);
  const solid = paint !== "transparent";
  return (
    <>
      <SmearDef name={name} x={pose.smearX} y={pose.smearY} />
      <div
        style={{
          position: "absolute",
          left: Math.round(cx - width / 2),
          top: Math.round(cy - height / 2),
          width,
          height,
          borderRadius: radius,
          backgroundColor: paint,
          boxShadow: solid ? shadow : undefined,
          opacity: pose.opacity,
          filter: smearFilter(name, pose.smearX, pose.smearY),
          transform: [
            `translateZ(${z.toFixed(1)}px)`,
            `rotateX(${pose.rotX.toFixed(3)}deg)`,
            `rotateY(${pose.rotY.toFixed(3)}deg)`,
            `rotateZ(${pose.rotZ.toFixed(3)}deg)`,
            `scale(${pose.scale.toFixed(4)})`,
          ].join(" "),
        }}
      >
        <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden" }}>
          {children}
        </div>
        {/* The key light, travelling across the face as the face turns. */}
        {solid ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              backgroundImage: key.image,
              mixBlendMode: key.blend,
              pointerEvents: "none",
            }}
          />
        ) : null}
        {/* The bevel, and on the light films the app's own hairline in the same slot: a white
            bevel catching a key light is nothing on a near-white face, and #C9CFBB at luma 192
            against a ground of 224 is a boundary whatever the footage behind it happens to be.
            Inset either way, so it survives the rounded corner. */}
        {solid ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: radius,
              boxShadow: `inset 0 0 0 ${String(rimWidth)}px ${rim}, inset 0 ${String(rimWidth)}px 0 0 ${rim}`,
              pointerEvents: "none",
            }}
          />
        ) : null}
      </div>
    </>
  );
};
