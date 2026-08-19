/**
 * The video project must never contain react-native at runtime. It imports exactly one
 * react-native TYPE, `TextStyle`, and only because apps/mobile/src/theme/tokens.ts types its
 * `type` scale with it. This stub satisfies that and nothing else, so an accidental
 * `import { View } from "react-native"` fails at typecheck instead of silently pulling the
 * real package out of the hoisted root node_modules.
 */
declare module "react-native" {
  export interface TextStyle {
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  }
}
