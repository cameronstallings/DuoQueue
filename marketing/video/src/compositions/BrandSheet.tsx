import { AbsoluteFill } from "remotion";

import { darkColors, spacing, type as typeScale } from "@app/theme/tokens";

import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Lockup } from "@/components/Lockup";
import { Mark } from "@/components/Mark";
import { SectionLabel } from "@/components/SectionLabel";
import { Tick } from "@/components/Tick";
import { px, VIDEO_W } from "@/lib/scale";
import { textStyle } from "@/lib/text-style";

const TONES = ["default", "volt", "success", "amber", "danger", "soft"] as const;

/**
 * Not a format, never rendered into a post: this is the reference sheet the brand bridge
 * is checked against. Put a still of it beside the running app and the mark, the lockup,
 * the six chip tones, both card edges, a section label and a tick all have to match. It
 * survives Task 8's cleanup because that comparison is worth being able to re-run every
 * time a token or the mark's geometry moves.
 */
export const BrandSheet = () => (
  <AbsoluteFill
    style={{
      backgroundColor: darkColors.background,
      padding: px(spacing.lg),
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: px(spacing.md),
    }}
  >
    <SectionLabel>mark</SectionLabel>
    {/* Three sizes off one width, so a scaling bug reads as a shape that changes with
        size rather than one that is simply wrong at every size. */}
    <div style={{ display: "flex", alignItems: "flex-end", gap: px(spacing.lg) }}>
      <Mark width={VIDEO_W * 0.26} />
      <Mark width={VIDEO_W * 0.14} />
      <Mark width={VIDEO_W * 0.07} />
    </div>

    <SectionLabel>lockup</SectionLabel>
    <Lockup width={VIDEO_W * 0.32} />

    <SectionLabel>chips</SectionLabel>
    <div style={{ display: "flex", flexWrap: "wrap", gap: px(spacing.sm) }}>
      {TONES.map((tone) => (
        <Chip key={tone} label={tone} tone={tone} />
      ))}
    </div>

    <SectionLabel>cards</SectionLabel>
    <div style={{ display: "flex", gap: px(spacing.md) }}>
      <Card style={{ flex: 1 }}>
        <div style={{ ...textStyle(typeScale.title), color: darkColors.text }}>solid panel</div>
        <div style={{ ...textStyle(typeScale.body), color: darkColors.textMuted }}>
          one seam, no glow
        </div>
      </Card>
      <Card luminous style={{ flex: 1 }}>
        <div style={{ ...textStyle(typeScale.title), color: darkColors.text }}>luminous edge</div>
        <div style={{ ...textStyle(typeScale.body), color: darkColors.textMuted }}>
          hero surfaces only
        </div>
      </Card>
    </div>

    <SectionLabel>tick</SectionLabel>
    <Tick>18+ / IOS / US</Tick>
  </AbsoluteFill>
);
