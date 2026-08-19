/** DOM port of apps/mobile/src/components/Chip.tsx. Keep in sync. Values come from
 * tokens; no literals. */
import { darkColors, hairline, radius, spacing, type as typeScale } from "@app/theme/tokens";

import { px } from "@/lib/scale";
import { textStyle } from "@/lib/text-style";

export type ChipTone = "default" | "volt" | "success" | "amber" | "danger" | "soft";

interface ChipProps {
  label: string;
  tone?: ChipTone;
}

/**
 * The one chip idiom, minus everything a frame of video cannot use: no press state, no
 * icon (the app's come from an icon font this project deliberately does not carry), and
 * no `detail` string, because type.caption names a Manrope face that src/lib/fonts.ts
 * does not load. Geometry and tone mapping are the app's, scaled by S.
 */
export const Chip = ({ label, tone = "default" }: ChipProps) => {
  let backgroundColor = "transparent";
  let borderColor: string = darkColors.border;
  let textColor: string = darkColors.textMuted;

  if (tone === "volt") {
    borderColor = darkColors.volt;
    textColor = darkColors.volt;
  } else if (tone === "soft") {
    backgroundColor = darkColors.voltSoft;
    borderColor = "transparent";
    textColor = darkColors.volt;
  } else if (tone === "success") {
    backgroundColor = darkColors.successFill;
    borderColor = darkColors.success;
    textColor = darkColors.success;
  } else if (tone === "amber") {
    backgroundColor = darkColors.amberSoft;
    borderColor = darkColors.amber;
    textColor = darkColors.amber;
  } else if (tone === "danger") {
    borderColor = darkColors.danger;
    textColor = darkColors.danger;
  }

  return (
    <div
      style={{
        // react-native measures every box border-box; the DOM does not, so the border and
        // the padding would otherwise grow the chip past the app's geometry.
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        borderRadius: px(radius.chip),
        borderWidth: px(hairline),
        borderStyle: "solid",
        borderColor,
        backgroundColor,
        paddingTop: px(spacing.xs + 1),
        paddingBottom: px(spacing.xs + 1),
        paddingLeft: px(spacing.sm + 1),
        paddingRight: px(spacing.sm + 1),
        ...textStyle(typeScale.chipText),
        color: textColor,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  );
};
