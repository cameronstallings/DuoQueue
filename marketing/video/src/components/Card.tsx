/** DOM port of apps/mobile/src/components/Card.tsx. Keep in sync. Values come from
 * tokens; no literals. */
import type { CSSProperties, ReactNode } from "react";

import { darkColors, hairline, radius, spacing } from "@app/theme/tokens";

import { px } from "@/lib/scale";

interface CardProps {
  children?: ReactNode;
  style?: CSSProperties;
  /** No fill or edge, for rows inside dense lists. */
  flat?: boolean;
  /** 1px volt edge instead of the plain border. Hero surfaces only. */
  luminous?: boolean;
}

export const Card = ({ children, style, flat, luminous }: CardProps) => (
  <div
    style={{
      // See Chip: react-native is border-box everywhere, the DOM is not.
      boxSizing: "border-box",
      backgroundColor: flat ? "transparent" : darkColors.surface,
      borderRadius: px(radius.card),
      padding: px(spacing.lg),
      borderWidth: flat ? 0 : px(hairline),
      borderStyle: "solid",
      borderColor: luminous ? darkColors.volt : darkColors.border,
      ...style,
    }}
  >
    {children}
  </div>
);
