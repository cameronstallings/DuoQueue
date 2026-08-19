/**
 * DOM port of <Logo variant="lockup"/> from apps/mobile/src/components/Logo.tsx. Keep in
 * sync. Same stack, same ratios: mark at half the lockup width, wordmark at 0.145 of it
 * with 1.16 leading and 0.02 tracking, so the proportions hold at any size the way they
 * do on device.
 */
import { darkColors, spacing } from "@app/theme/tokens";

import { FONT_FAMILY } from "@/lib/fonts";
import { px } from "@/lib/scale";

import { Mark } from "./Mark";

export const Lockup = ({ width }: { width: number }) => {
  // Unbounded runs wide, so the wordmark needs a small ratio to fit the box.
  const fontSize = width * 0.145;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: px(spacing.md),
      }}
    >
      <Mark width={width * 0.5} />
      <div
        style={{
          fontFamily: FONT_FAMILY.displayBold,
          fontSize: `${fontSize}px`,
          lineHeight: `${fontSize * 1.16}px`,
          letterSpacing: `${fontSize * 0.02}px`,
          color: darkColors.text,
        }}
      >
        duoqueue
      </div>
    </div>
  );
};
