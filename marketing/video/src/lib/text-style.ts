import type { CSSProperties } from "react";

import { S } from "./scale";

/** The shape of every entry in tokens.ts's `type` scale, restated structurally so this
 * module does not have to import react-native's TextStyle to name it. */
interface TypeToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
}

/**
 * Turns one app type token into CSS. Two conversions, both mandatory:
 * react-native reads a bare `lineHeight` as a length while CSS reads it as a multiple of
 * the font size (and React only auto-appends "px" to properties it knows are lengths, so
 * lineHeight would silently become a ratio), and every measurement is authored in iPhone
 * points, so it has to be multiplied by S to occupy the same share of a 1080-wide frame.
 * letterSpacing is scaled unrounded: at 0.6pt a rounded value is off by nearly half.
 */
export function textStyle(token: TypeToken): CSSProperties {
  return {
    fontFamily: token.fontFamily,
    fontSize: `${token.fontSize * S}px`,
    lineHeight: `${token.lineHeight * S}px`,
    letterSpacing: `${token.letterSpacing * S}px`,
    ...(token.textTransform ? { textTransform: token.textTransform } : {}),
  };
}
