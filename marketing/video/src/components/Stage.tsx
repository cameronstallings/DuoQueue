/** The ground every format stands on: the app's background, its graticule and its grain,
 * in that order, with the dev guides on top of everything. */
import type { ReactNode } from "react";

import { AbsoluteFill, staticFile } from "remotion";

import { darkColors, hairline } from "@app/theme/tokens";

import { alpha } from "@/lib/color";
import { px } from "@/lib/scale";

import { SafeArea } from "./SafeArea";

/**
 * Ported from apps/mobile/src/components/GraticuleBackground.tsx, dark scheme, "default"
 * variant. Keep in sync. The numbers are the app's and are in iPhone points, so px() puts
 * them on a 1080-wide frame at the density a phone shows them at: the 24pt grid becomes 66px.
 *
 * CSS gradients rather than the app's SVG <Pattern>: this repaints on every one of the
 * roughly 300 frames in a post, and a tiled background is a single composited layer where an
 * SVG pattern is a full rasterisation.
 */
const GRID = 24;
const TICK_GRID = 96;
const TICK_R = 1.2;
const LINE_ALPHA = 0.035;
const TICK_ALPHA = 0.06;
/** Grain tile opacity, from apps/mobile/src/components/GrainOverlay.tsx. */
const GRAIN_ALPHA = 0.035;

const lineInk = alpha(darkColors.volt, LINE_ALPHA);
const tickInk = alpha(darkColors.volt, TICK_ALPHA);
const lineWidth = px(hairline);
const dot = px(TICK_R);
const grid = px(GRID);
const ticks = px(TICK_GRID);

// Ticks first so they paint over the grid, which is the app's paint order. Both dots are
// clipped by their tile exactly as the SVG <Pattern> clips them, so the lattice corners show
// a quarter dot and the tile centres a whole one, the same as on device.
const GRATICULE = [
  `radial-gradient(circle at 0 0, ${tickInk} ${dot}px, transparent ${dot}px)`,
  `radial-gradient(circle at 50% 50%, ${tickInk} ${dot}px, transparent ${dot}px)`,
  `linear-gradient(to bottom, ${lineInk} ${lineWidth}px, transparent ${lineWidth}px)`,
  `linear-gradient(to right, ${lineInk} ${lineWidth}px, transparent ${lineWidth}px)`,
].join(", ");

const GRATICULE_SIZE = [
  `${ticks}px ${ticks}px`,
  `${ticks}px ${ticks}px`,
  `${grid}px ${grid}px`,
  `${grid}px ${grid}px`,
].join(", ");

export const Stage = ({ children }: { children?: ReactNode }) => (
  <AbsoluteFill style={{ backgroundColor: darkColors.background }}>
    <AbsoluteFill
      style={{
        backgroundImage: GRATICULE,
        backgroundSize: GRATICULE_SIZE,
        backgroundRepeat: "repeat",
      }}
    />
    {/* Grain stays at the PNG's own 128px tile rather than being scaled by S. It is a
        texture, not chrome: enlarging it 2.75x turns film grain into soft blobs, and a
        finer tile also survives H.264 better than a coarse one. */}
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile("noise.png")})`,
        backgroundRepeat: "repeat",
        opacity: GRAIN_ALPHA,
      }}
    />
    {children}
    {/* Last, so the guides sit over the footage a format lays down rather than under it.
        Every format goes through Stage, so this is the one place they have to be wired. */}
    <SafeArea />
  </AbsoluteFill>
);
