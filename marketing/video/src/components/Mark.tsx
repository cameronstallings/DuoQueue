/**
 * DOM twin of <LogoMark/> in apps/mobile/src/components/Logo.tsx: the same four elements
 * in the same paint order, the same viewBox, the same two inks, every number taken from
 * the geometry module the app itself draws from. The mark on video is the app's mark
 * rather than a likeness of it. Keep the element list in sync; the numbers look after
 * themselves.
 */
import {
  CXA,
  CXB,
  CY,
  LOGO_MARK_ASPECT,
  mix,
  NUB,
  R,
  SEG_PATH,
  VB_H,
  VB_W,
  VB_X,
  VB_Y,
  W,
} from "@app/theme/logo-geometry";
import { darkColors } from "@app/theme/tokens";

// Deliberately hue-free: one ink at two strengths, computed exactly as the app computes
// it. Every video is dark, so darkColors stands where useTheme() resolves on device.
const ink = darkColors.text;
const duo = mix(darkColors.text, darkColors.background, 0.58);

export const Mark = ({ width }: { width: number }) => (
  // The app's <Svg/> is tagged as an image for VoiceOver. A frame of video has no
  // accessibility tree to serve, so here the mark is decorative markup and nothing more.
  <svg
    width={width}
    height={width * LOGO_MARK_ASPECT}
    viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
    aria-hidden
  >
    <circle cx={CXB} cy={CY} r={R} fill="none" stroke={duo} strokeWidth={W} />
    <circle cx={NUB.cx} cy={NUB.cy} r={NUB.r} fill={duo} />
    <circle cx={CXA} cy={CY} r={R} fill="none" stroke={ink} strokeWidth={W} />
    <path d={SEG_PATH} fill="none" stroke={duo} strokeWidth={W} />
  </svg>
);
