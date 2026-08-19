import { SCRIM_RGB } from "@app/theme/tokens";

/** `#RRGGBB` -> `r,g,b`. */
const triple = (hex: string): string =>
  `${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)}`;

/**
 * A solid token color at an alpha the app applies in code rather than in a token.
 * tokens.ts stores solids as hex and its few fixed translucencies as ready-made rgba
 * strings, but the graticule and the footage scrim need arbitrary alphas over a token
 * hue. Doing the conversion here is what keeps "no color is typed twice" true: the only
 * `rgba(` literals under src/ live in this file, and every one of them is fed a token.
 */
export const alpha = (hex: string, a: number): string => `rgba(${triple(hex)},${a})`;

/** The photo scrim: green-black, not #000, and already a triple in tokens.ts. */
export const scrim = (a: number): string => `rgba(${SCRIM_RGB},${a})`;
