/** DOM port of apps/mobile/src/components/SectionLabel.tsx. Keep in sync. Values come
 * from tokens; no literals. */
import { darkColors, spacing, type as typeScale } from "@app/theme/tokens";

import { px } from "@/lib/scale";
import { textStyle } from "@/lib/text-style";

/**
 * The heading above a grouped section. Sections are separated by the label itself rather
 * than by a rule mark beside it.
 */
export const SectionLabel = ({ children }: { children: string }) => (
  <div style={{ marginBottom: px(spacing.sm) }}>
    <div style={{ ...textStyle(typeScale.label), color: darkColors.textMuted }}>{children}</div>
  </div>
);
