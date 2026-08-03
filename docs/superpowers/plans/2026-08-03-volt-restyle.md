# Volt Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Aurora visual identity (violet/glass/glow/pills) with Volt (off-black + chartreuse, solid seamed panels, sharp radii, IBM Plex Mono machine voice) across the DuoQueue mobile app, per `docs/superpowers/specs/2026-08-03-volt-restyle-design.md`.

**Architecture:** Token-first migration with a temporary compat layer. Task 2 rewrites `tokens.ts` to Volt values while keeping every removed key/helper as a `@deprecated` alias that already *renders* Volt (glow → no-op, gradients → solid fills), so the app wears the new identity immediately and `pnpm typecheck` stays green after every task. Component tasks then migrate call sites to the new names; Task 11 deletes the aliases and grep-gates prove nothing is left. No structural, layout, motion-timing, or backend changes.

**Tech Stack:** Expo / React Native, TypeScript, expo-router, react-native-svg, reanimated, `@expo-google-fonts/*`, pnpm monorepo.

## Global Constraints

- Spec is the authority: `docs/superpowers/specs/2026-08-03-volt-restyle-design.md`. Exact values live there; this plan repeats them where used.
- NO violet/pink family anywhere (`#14101F #8B5CF6 #7C3AED #FF6EC7 #CB427B #A78BFA #C9B4FF #8452F5 #E0479E #C93A8C` all must reach zero occurrences outside docs/).
- NO translucent surfaces (`rgba(255,255,255,…)` fills), NO backdrop blur, NO colored glow/shadow. Depth = solid panel + 1px seam; emphasis = 2px volt edge-bar, volt border, inverted fill, or mono tick.
- `radius.round` (999) is legal ONLY for avatars and dots. No pill-shaped controls or chips.
- Paper (light) rule: **inks fill, chartreuse marks** — `colors.volt` on paper IS the olive ink `#4A6B00`; raw chartreuse (`colors.voltRaw`) never exceeds chip scale and never carries light text.
- Fonts: Unbounded + Manrope stay; IBM Plex Mono (500/600) is added. No other fonts.
- After EVERY task: `pnpm typecheck && pnpm lint` green from repo root, then commit. No `git push` (Cameron pushes).
- Do not touch: DB, edge functions, `admin/index.html`, voice-intro dormant backend, motion timing values.

---

### Task 1: IBM Plex Mono + machine-voice type styles

**Files:**
- Modify: `apps/mobile/package.json` (dependencies)
- Modify: `apps/mobile/app/_layout.tsx:10-17` (font loading)
- Modify: `apps/mobile/src/theme/tokens.ts:14-34` (fonts + type)

**Interfaces:**
- Produces: `fonts.mono` ("IBMPlexMono_500Medium"), `fonts.monoSemibold` ("IBMPlexMono_600SemiBold"); `type.tick` (mono 9px), `type.chipText` (mono 10px); `type.label` re-based onto mono. All later tasks reference these exact names.

- [ ] **Step 1: Add the font package**

Run: `pnpm --filter mobile add @expo-google-fonts/ibm-plex-mono`
Expected: version `^0.4.x` appears in `apps/mobile/package.json` dependencies.

- [ ] **Step 2: Load the two faces in the root layout**

In `apps/mobile/app/_layout.tsx`, extend the google-fonts imports (next to the Unbounded import):

```tsx
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono";
```

and add both names to the existing `useFonts({ … })` object (find the call that already lists `Manrope_500Medium` etc.; add the two keys the same way).

- [ ] **Step 3: Extend `fonts` and `type` in tokens.ts**

In `apps/mobile/src/theme/tokens.ts` replace the `fonts` block and the `label` entry, and add two styles:

```ts
export const fonts = {
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  /** Unbounded — names, screen titles, hero moments ONLY. */
  display: "Unbounded_600SemiBold",
  displayBold: "Unbounded_700Bold",
  /** IBM Plex Mono — the machine voice: labels, ticks, stats, statuses, indexes. */
  mono: "IBMPlexMono_500Medium",
  monoSemibold: "IBMPlexMono_600SemiBold",
} as const;
```

In `type`: change `label` to the mono voice and add `tick` and `chipText`:

```ts
  /** The ONLY uppercase styles. label = section headers; tick = timestamps, statuses,
   * counters, index marks; chipText = chip labels. All Plex Mono. */
  label: { fontFamily: fonts.monoSemibold, fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase" },
  tick: { fontFamily: fonts.mono, fontSize: 9, lineHeight: 12, letterSpacing: 0.8, textTransform: "uppercase" },
  chipText: { fontFamily: fonts.mono, fontSize: 10, lineHeight: 14, letterSpacing: 0.6, textTransform: "uppercase" },
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both green (nothing consumes the new styles yet; `label` consumers recompile fine — it is still a `TextStyle`).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/app/_layout.tsx apps/mobile/src/theme/tokens.ts
git commit -m "Volt 1/14: IBM Plex Mono joins as the machine voice"
```

---

### Task 2: Volt tokens with a self-rendering compat layer

**Files:**
- Modify: `apps/mobile/src/theme/tokens.ts` (palettes, radius, scrim, helpers)
- Modify: `apps/mobile/src/theme/useTheme.ts` (comment + passthrough only)

**Interfaces:**
- Produces (new canonical keys, both schemes): `volt voltDim voltSoft voltRaw onVolt amber onAmber amberSoft danger dangerDark success warning info onFill successFill warningFill background surface surfaceAlt surfaceSolid border text textMuted p1Line p2Line overlap playstyle`.
- Produces (deprecated aliases that later tasks DELETE at Task 11): `heroA heroB pink brand brandInk brandDark brandSoft accent accentInk accentSoft solarA solarB onSolar glowViolet glowPink glowSolar glowSuccess`, plus helpers `glow()` (returns `{}`), `heroGradient()`/`solarGradient()` (solid volt/amber pairs).
- `radius` becomes: `chip 3, sm 4, input 6, button 6, window 8, md 8, card 8, lg 8, sheet 16, round 999`.

- [ ] **Step 1: Replace the header comment and both palettes**

Replace the file's doc comment (lines 3–8) with:

```ts
/**
 * DuoQueue design tokens — "Volt".
 * Off-black with green warmth, solid panels split by 1px seams, ONE interactive
 * accent (volt chartreuse; olive ink on paper), amber strictly for money.
 * Depth = seams + edge-bars, never glow. Machine voice = IBM Plex Mono.
 * Paper rule: inks fill, chartreuse marks. See 2026-08-03-volt-restyle-design.md.
 */
```

Replace `darkColors` with (categorical inks included):

```ts
const OVERLAP_DARK = { none: "#8A927E", one: "#93B45C", two: "#B7DD3F", many: "#FFB627" } as const;
const OVERLAP_LIGHT = { none: "#66705C", one: "#4E7018", two: "#5A7A00", many: "#8F5E00" } as const;
const PLAYSTYLE_DARK = { casual: "#A8B096", intermediate: "#8FC46B", competitive: "#7FB7D9", ranked_grinder: "#E0A33E" } as const;
const PLAYSTYLE_LIGHT = { casual: "#5E6650", intermediate: "#3E6B1E", competitive: "#2F5E80", ranked_grinder: "#8A5E10" } as const;

export const darkColors = {
  background: "#0A0B09",
  surface: "#12140F",
  surfaceSolid: "#12140F",
  surfaceAlt: "#1A1D15",
  border: "#232720",
  text: "#EDF1E6",
  textMuted: "#98A18A",

  volt: "#CDFF3D",
  voltDim: "#94BC2C",
  voltSoft: "rgba(205,255,61,0.10)",
  /** Raw chartreuse. Same as volt on dark; on paper this is the ONLY chartreuse,
   * legal at ≤ chip scale with near-black text — volt itself becomes olive ink there. */
  voltRaw: "#CDFF3D",
  onVolt: "#0A0B09",

  amber: "#FFB627",
  onAmber: "#201400",
  amberSoft: "rgba(255,182,39,0.12)",

  danger: "#FF5A48",
  dangerDark: "#D8321F",
  success: "#3FD68C",
  warning: "#FFB627",
  info: "#6EC8FF",
  onFill: "#FFFFFF",
  successFill: "rgba(63,214,140,0.14)",
  warningFill: "rgba(255,182,39,0.14)",

  p1Line: "#CDFF3D",
  p2Line: "#F2F6EA",

  overlap: OVERLAP_DARK,
  playstyle: PLAYSTYLE_DARK,

  // ——— DEPRECATED Aurora aliases: DELETE in Task 11. Values already render Volt. ———
  /** @deprecated Volt migration — use volt */ brand: "#CDFF3D",
  /** @deprecated Volt migration — use volt */ accent: "#CDFF3D",
  /** @deprecated Volt migration — use voltDim */ brandInk: "#94BC2C",
  /** @deprecated Volt migration — use voltDim */ accentInk: "#94BC2C",
  /** @deprecated Volt migration — use voltDim */ brandDark: "#94BC2C",
  /** @deprecated Volt migration — use voltSoft */ brandSoft: "rgba(205,255,61,0.10)",
  /** @deprecated Volt migration — use voltSoft */ accentSoft: "rgba(205,255,61,0.10)",
  /** @deprecated Volt migration — use volt/voltDim */ heroA: "#CDFF3D", heroB: "#CDFF3D",
  /** @deprecated Volt migration — use voltRaw */ pink: "#CDFF3D",
  /** @deprecated Volt migration — use amber */ solarA: "#FFB627", solarB: "#FFB627",
  /** @deprecated Volt migration — use onAmber */ onSolar: "#201400",
  /** @deprecated Volt migration — glow is dead */ glowViolet: "rgba(0,0,0,0)", glowPink: "rgba(0,0,0,0)", glowSolar: "rgba(0,0,0,0)", glowSuccess: "rgba(0,0,0,0)",
} as const;
```

Replace `lightColors` with the same shape (Paper):

```ts
export const lightColors = {
  background: "#F2F4EB",
  surface: "#FFFFFF",
  surfaceSolid: "#FFFFFF",
  surfaceAlt: "#E7EBDB",
  border: "#C9CFBB",
  text: "#161A0F",
  textMuted: "#5C6450",

  volt: "#4A6B00",
  voltDim: "#3B5600",
  voltSoft: "rgba(205,255,61,0.35)",
  voltRaw: "#CDFF3D",
  onVolt: "#F7F9F0",

  amber: "#8F5E00",
  onAmber: "#FBF6EA",
  amberSoft: "rgba(143,94,0,0.12)",

  danger: "#C22E20",
  dangerDark: "#C22E20",
  success: "#17784C",
  warning: "#8F5E00",
  info: "#16688F",
  onFill: "#FFFFFF",
  successFill: "rgba(23,120,76,0.14)",
  warningFill: "rgba(143,94,0,0.14)",

  p1Line: "#4A6B00",
  p2Line: "#161A0F",

  overlap: OVERLAP_LIGHT,
  playstyle: PLAYSTYLE_LIGHT,

  // ——— DEPRECATED Aurora aliases: DELETE in Task 11. ———
  /** @deprecated Volt migration — use volt */ brand: "#4A6B00",
  /** @deprecated Volt migration — use volt */ accent: "#4A6B00",
  /** @deprecated Volt migration — use voltDim */ brandInk: "#3B5600",
  /** @deprecated Volt migration — use voltDim */ accentInk: "#3B5600",
  /** @deprecated Volt migration — use voltDim */ brandDark: "#3B5600",
  /** @deprecated Volt migration — use voltSoft */ brandSoft: "rgba(205,255,61,0.35)",
  /** @deprecated Volt migration — use voltSoft */ accentSoft: "rgba(205,255,61,0.35)",
  /** @deprecated Volt migration — use volt/voltDim */ heroA: "#4A6B00", heroB: "#4A6B00",
  /** @deprecated Volt migration — use voltRaw */ pink: "#4A6B00",
  /** @deprecated Volt migration — use amber */ solarA: "#8F5E00", solarB: "#8F5E00",
  /** @deprecated Volt migration — use onAmber */ onSolar: "#FBF6EA",
  /** @deprecated Volt migration — glow is dead */ glowViolet: "rgba(0,0,0,0)", glowPink: "rgba(0,0,0,0)", glowSolar: "rgba(0,0,0,0)", glowSuccess: "rgba(0,0,0,0)",
} as const;
```

- [ ] **Step 2: Radius, scrim, helpers**

```ts
export const radius = {
  chip: 3, sm: 4, window: 8, input: 6, button: 6, md: 8, card: 8, lg: 8,
  sheet: 16, round: 999,
} as const;

/** Photo scrim black — green-black, not #000. */
export const SCRIM_RGB = "6,8,4";

/** @deprecated Volt migration — glow is dead; returns nothing. DELETE in Task 11. */
export function glow(_color: string, _r = 20) {
  return {} as const;
}

/** @deprecated Volt migration — gradients retired; renders a solid volt fill. DELETE in Task 11. */
export function heroGradient(c: ThemeColors) {
  return { colors: [c.volt, c.volt] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
}
/** @deprecated Volt migration — renders a solid amber fill. DELETE in Task 11. */
export function solarGradient(c: ThemeColors) {
  return { colors: [c.amber, c.amber] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
}
```

Keep `spacing`, `motion`, `hairline`, `ThemeColors`, `fonts`, `type` as-is (Task 1 already reshaped type). Delete the old contrast-audit comments that reference heroA/#CB427B (they describe dead constraints); keep a one-liner: `// All pairs verified by scripts/audit-contrast.mjs (Task 12).`

- [ ] **Step 3: Update the dark-first comment in useTheme.ts**

`apps/mobile/src/theme/useTheme.ts:13` — change `// Aurora is dark-first: …` to `// Volt is dark-first: an unreadable system scheme resolves dark.` No API change.

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: green. Every existing call site still compiles against aliases and already renders Volt (glows vanish, gradients turn solid, pills sharpen to radius 3 app-wide).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/theme/tokens.ts apps/mobile/src/theme/useTheme.ts
git commit -m "Volt 2/14: the palette flips — chartreuse in, violet out, glow dead"
```

---

### Task 3: Chip — sharp mono tags, every tone

**Files:**
- Modify: `apps/mobile/src/components/Chip.tsx`

**Interfaces:**
- Produces: `ChipTone = "default" | "volt" | "success" | "amber" | "danger" | "soft"` plus temporary aliases `"accent"→"volt"`, `"solar"→"amber"` (removed in Task 11). Props otherwise unchanged (`label detail icon selected tone onPress accessibilityLabel`).
- Consumes: `type.chipText` (Task 1), Volt color keys (Task 2).

- [ ] **Step 1: Rewrite tone resolution and text style**

Replace the component body's tone logic and text styles (keep the Pressable/View split and accessibility exactly as-is):

```tsx
export type ChipTone = "default" | "volt" | "success" | "amber" | "danger" | "soft"
  /** @deprecated Volt migration aliases — DELETE in Task 11 */
  | "accent" | "solar";

export function Chip({ label, detail, icon, selected, tone = "default", onPress, accessibilityLabel }: ChipProps) {
  const { colors, radius, spacing, type } = useTheme();

  const resolved = tone === "accent" ? "volt" : tone === "solar" ? "amber" : tone;
  const isVolt = selected || resolved === "volt";

  let backgroundColor: string = "transparent";
  let borderColor: string = colors.border;
  let textColor: string = colors.textMuted;

  if (isVolt) {
    borderColor = colors.volt;
    textColor = colors.volt;
  } else if (resolved === "soft") {
    backgroundColor = colors.voltSoft;
    borderColor = "transparent";
    textColor = colors.volt;
  } else if (resolved === "success") {
    backgroundColor = colors.successFill;
    borderColor = colors.success;
    textColor = colors.success;
  } else if (resolved === "amber") {
    backgroundColor = colors.amberSoft;
    borderColor = colors.amber;
    textColor = colors.amber;
  } else if (resolved === "danger") {
    borderColor = colors.danger;
    textColor = colors.danger;
  }
```

Chip text switches from `type.caption` to `type.chipText` for the label, `detail` keeps `type.caption` at `colors.textMuted` (mixed-case detail stays readable). Padding: `paddingVertical: spacing.xs + 1, paddingHorizontal: spacing.sm + 1` (tags hug tighter than pills did). Remove the `glow` import and the `selected ? glow(…) : null` entry entirely — selection is the volt border + text, nothing else. `borderRadius: radius.chip` stays (now 3 via tokens).

Note on paper: `colors.volt` resolves to olive and `voltSoft`'s text pairs with `colors.volt` (olive ≈ `#4A6B00`) — exactly the "inks mark" rule; nothing scheme-branched in this file. Add one comment saying so.

- [ ] **Step 2: Verify + eyeball**

Run: `pnpm typecheck && pnpm lint`
Expected: green (existing `tone="accent"`/`tone="solar"` call sites hit the alias branches).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/Chip.tsx
git commit -m "Volt 3/14: chips drop the pill — 3px mono tags, border-only selection"
```

---

### Task 4: Button — solid fills, no gradient, no glow

**Files:**
- Modify: `apps/mobile/src/components/Button.tsx`

**Interfaces:**
- Produces: `variant = "primary" | "secondary" | "ghost" | "premium"` with temporary alias `"solar"→"premium"` (removed Task 11). `size`, `loading`, `disabled`, `ButtonRow` unchanged.
- Consumes: `colors.volt/onVolt/amber/onAmber` (Task 2).

- [ ] **Step 1: Replace fills**

Drop the `LinearGradient` import and the `glow`/`heroGradient`/`solarGradient` destructuring. New resolution:

```tsx
type Variant = "primary" | "secondary" | "ghost" | "premium"
  /** @deprecated Volt migration alias — DELETE in Task 11 */
  | "solar";

export function Button({ label, onPress, loading, disabled, variant = "primary", size = "md" }: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;
  const v = variant === "solar" ? "premium" : variant;

  const textColor =
    v === "primary" ? colors.onVolt : v === "premium" ? colors.onAmber : colors.text;
  const fill =
    v === "primary" ? colors.volt : v === "premium" ? colors.amber : undefined;
```

The content `View` (single branch now — no gradient path) gets:

```tsx
<View
  style={[
    styles.content,
    contentStyle,
    fill ? { backgroundColor: fill } : null,
    v === "secondary" ? { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border } : null,
  ]}
>
```

Keep press-scale, disabled opacity, `ButtonLabel` pulse, `contentStyle` paddings, `radius.button` (now 6). The old comment about glow/gradient split is obsolete — replace with: `/** Solid fills only: volt = act, amber = pay. Paper resolves volt to olive ink, so no scheme branch here. */`

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: green (`variant="solar"` call sites hit the alias).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/Button.tsx
git commit -m "Volt 4/14: buttons go solid — volt acts, amber pays"
```

---

### Task 5: Chrome & forms — Card, Sheet, TextField, Toast, Skeleton, OfflineBanner, ModalHeader, SectionLabel, NavRow, Slider, PageDots

**Files:**
- Modify: `apps/mobile/src/components/Card.tsx`, `Sheet.tsx`, `TextField.tsx`, `Toast.tsx`, `Skeleton.tsx`, `OfflineBanner.tsx`, `ModalHeader.tsx`, `SectionLabel.tsx`, `NavRow.tsx`, `Slider.tsx`, `PageDots.tsx`

**Interfaces:**
- Consumes: Volt keys (Task 2), `type.label` mono (Task 1). No exported API changes in any of these files.

- [ ] **Step 1: Sweep the batch, file by file**

Per-file requirements (each is a small mechanical edit; read the file, apply, move on):

- `Card.tsx`: destructure without `glow`/`heroGradient`; any `glow(…)` style entries deleted; surface = `colors.surface` + `borderWidth: 1, borderColor: colors.border` if not already; radius token already sharpened it.
- `Sheet.tsx`: translucent/glass fills (`rgba(255,255,255,…)` or `surfaceAlt`-as-glass) → `colors.surfaceSolid` + top seam (`borderTopWidth: 1, borderColor: colors.border`); grabber bar → `colors.border`; radius token (sheet 16) already applied. A plain black separation shadow may stay if present; colored ones go.
- `TextField.tsx`: fill `colors.surfaceAlt`, `borderWidth: 1, borderColor: colors.border`, focus state border → `colors.volt` (was accent/brand); error border `colors.danger`.
- `Toast.tsx`: solid `colors.surfaceSolid` + seam + **2px status edge-bar**: `borderLeftWidth: 2, borderLeftColor:` success→`colors.success`, error→`colors.danger`, info→`colors.volt`. Kill any glow.
- `Skeleton.tsx`: shimmer/base colors → `colors.surfaceAlt` base, highlight `colors.surface`; nothing violet.
- `OfflineBanner.tsx`: fill `colors.dangerDark`, text `colors.onFill` (keep the collapsed-height padding fix — do NOT reintroduce padding on the collapsed state).
- `ModalHeader.tsx`: title stays; any accent tint → `colors.volt`; close icon `colors.textMuted`.
- `SectionLabel.tsx`: uses `type.label` — verify it renders the new mono style cleanly (letterSpacing 1.2 can clip: add `includeFontPadding: false` if Android clipping is visible in code review; color `colors.textMuted`). Replace any `colors.accentInk` with `colors.textMuted`.
- `NavRow.tsx`: chevron/accent → `colors.textMuted`; press state `colors.surfaceAlt`.
- `Slider.tsx`: track `colors.surfaceAlt`, fill `colors.volt`, thumb `colors.text`; any brand/accent refs die.
- `PageDots.tsx`: active dot `colors.volt`, inactive `colors.border`. Dots keep `radius.round` (legal: dots).

- [ ] **Step 2: Grep-gate the batch**

Run: `grep -nE "colors\.(brand|accent|pink|solar|glow|heroA|heroB)|glow\(" apps/mobile/src/components/{Card,Sheet,TextField,Toast,Skeleton,OfflineBanner,ModalHeader,SectionLabel,NavRow,Slider,PageDots}.tsx`
Expected: no output.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components
git commit -m "Volt 5/14: chrome goes solid — seams, edge-bars, olive focus"
```

---

### Task 6: Status & identity — EmptyState, PresenceAvatar, Logo, ReportModal, VoiceIntroPlayer, ChipSelect

**Files:**
- Modify: `apps/mobile/src/components/EmptyState.tsx`, `PresenceAvatar.tsx`, `Logo.tsx`, `ReportModal.tsx`, `VoiceIntroPlayer.tsx`, `ChipSelect.tsx`

**Interfaces:**
- Consumes: Volt keys, `type.label`/`type.tick`. No exported API changes.

- [ ] **Step 1: File-by-file**

- `EmptyState.tsx`: any glow/aurora accents die. Title stays as-is; the icon/art slot gets the bracket motif: wrap the existing title in mono brackets by adding above it a `Text` with `type.tick`, `colors.voltDim`, content `[ ${label} ]` where `label` is a short prop-derived status (add optional prop `tick?: string`, default `"EMPTY"`, so call sites can pass e.g. `"NO ONE IN QUEUE"` later — default keeps existing call sites compiling unchanged).
- `PresenceAvatar.tsx`: online ring/glow → **volt dot**: 8px `colors.volt` circle, bottom-right, `borderWidth: 2, borderColor: colors.background`. Avatar itself stays `radius.round` (legal). Kill `glow(`.
- `Logo.tsx`: wordmark color `colors.text`; any brand/accent tint → `colors.volt` only if it is a small mark (dot/symbol), otherwise text color.
- `ReportModal.tsx`: confirm fill `colors.dangerDark` + `colors.onFill`; outline state `colors.danger` border/text.
- `VoiceIntroPlayer.tsx` (dormant but must compile): brand/accent → volt family; glow dies; waveform bars `colors.voltDim`, active `colors.volt`.
- `ChipSelect.tsx`: passes tones through to Chip — update any `tone="accent"` to `tone="volt"` and `tone="solar"` to `tone="amber"` here while touching the file.

- [ ] **Step 2: Grep-gate + verify**

Run: `grep -nE "colors\.(brand|accent|pink|solar|glow|heroA|heroB)|glow\(" apps/mobile/src/components/{EmptyState,PresenceAvatar,Logo,ReportModal,VoiceIntroPlayer,ChipSelect}.tsx`
Expected: no output.
Run: `pnpm typecheck && pnpm lint` — green.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components
git commit -m "Volt 6/14: presence dots, bracket empty-states, ink logo"
```

---

### Task 7: GraticuleBackground replaces AuroraBackground; grain dials down

**Files:**
- Create: `apps/mobile/src/components/GraticuleBackground.tsx`
- Modify: `apps/mobile/src/components/GrainOverlay.tsx` (opacity −30%)
- Modify (import swap `AuroraBackground` → `GraticuleBackground`): `apps/mobile/src/components/ScreenContainer.tsx`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/chat/[matchId].tsx`, `apps/mobile/app/match/[matchId].tsx`, `apps/mobile/app/party/[partyId]/index.tsx`, `apps/mobile/app/party/[partyId]/chat.tsx`, `apps/mobile/src/features/swipe/ProfileDetailContent.tsx`
- Delete: `apps/mobile/src/components/AuroraBackground.tsx`

**Interfaces:**
- Produces: `GraticuleBackground({ variant?: "default" | "match" | "solar" })` — same prop surface as AuroraBackground so the swap is mechanical (`variant` maps to line alpha only; `"solar"` alias accepted until Task 11 renames call sites, treated as `"default"`).

- [ ] **Step 1: Write the component**

```tsx
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";

interface GraticuleBackgroundProps {
  /** "match" draws slightly stronger lines for the moment screens.
   * "solar" is a deprecated Aurora alias (Task 11 removes it) — renders default. */
  variant?: "default" | "match" | "solar";
}

/** Volt's atmosphere: a static engineering graticule — 24px grid of hairlines with
 * sparse crosshair ticks. Replaces Aurora's drifting washes; grain supplies life. */
export function GraticuleBackground({ variant = "default" }: GraticuleBackgroundProps) {
  const { colors, scheme } = useTheme();
  const strength = variant === "match" ? 1.6 : 1;
  const lineColor = scheme === "dark" ? "rgba(205,255,61," : "rgba(74,107,0,";
  const lineAlpha = (scheme === "dark" ? 0.035 : 0.05) * strength;
  const tickAlpha = (scheme === "dark" ? 0.06 : 0.08) * strength;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <Line x1="0" y1="0" x2="24" y2="0" stroke={`${lineColor}${lineAlpha})`} strokeWidth="1" />
            <Line x1="0" y1="0" x2="0" y2="24" stroke={`${lineColor}${lineAlpha})`} strokeWidth="1" />
          </Pattern>
          <Pattern id="ticks" width="96" height="96" patternUnits="userSpaceOnUse">
            <Circle cx="0" cy="0" r="1.2" fill={`${lineColor}${tickAlpha})`} />
            <Circle cx="48" cy="48" r="1.2" fill={`${lineColor}${tickAlpha})`} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
        <Rect width="100%" height="100%" fill="url(#ticks)" />
      </Svg>
    </View>
  );
}
```

- [ ] **Step 2: Swap all 8 usage sites + ScreenContainer**

In each listed file: change the import and the JSX tag 1:1 (`<AuroraBackground variant="match" />` → `<GraticuleBackground variant="match" />`). No other prop changes. Then delete `AuroraBackground.tsx`.

- [ ] **Step 3: GrainOverlay opacity**

In `GrainOverlay.tsx`, find the overlay opacity constant/style and multiply by 0.7 (e.g. `opacity: 0.05` → `opacity: 0.035`). Keep the asset and tiling untouched.

- [ ] **Step 4: Grep-gate + verify**

Run: `grep -rn "AuroraBackground" apps/mobile` — Expected: no output.
Run: `pnpm typecheck && pnpm lint` — green.

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile/src/components apps/mobile/app apps/mobile/src/features
git commit -m "Volt 7/14: auroras set — the graticule rises"
```

---

### Task 8: Tab bar + deck screen

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/src/features/swipe/SwipeCard.tsx`, `apps/mobile/src/features/swipe/LikePassButtons.tsx`

**Interfaces:**
- Consumes: `type.tick`, Volt keys. No exported API changes.

- [ ] **Step 1: Tab bar (`(tabs)/_layout.tsx`)**

- Bar background: dark `#0E100C` literal is WRONG — use `colors.surfaceSolid`; top seam `borderTopWidth: 1, borderTopColor: colors.border`.
- Remove the active-tab tile (the 34×28 rounded tile + glow): active state = icon+label in `colors.volt` plus a 2px underline bar (`width: 16, height: 2, backgroundColor: colors.volt, marginTop: 2`), inactive `colors.textMuted`.
- Labels move to `type.tick`.
- Kill `glow(`/`heroGradient` references.

- [ ] **Step 2: Deck (`(tabs)/index.tsx` + `SwipeCard.tsx`)**

- SwipeCard surface: `colors.surface` + seam border, radius from tokens (8); scrim uses `SCRIM_RGB` already — verify no literal violet rgba remains.
- Overlap line becomes mono: `type.tick`, `colors.volt`, text `>> ${n} GAMES IN COMMON` (n≥1; existing copy logic supplies the count — only restyle, keep pluralization if present).
- Add the index mark: top-right over the photo, `type.tick`, `colors.voltRaw` at 0.9 opacity on the scrim, content `NO.${String(index + 1).padStart(3, "0")}` — `SwipeCard` already receives its position in the deck; if it does not, pass `index` down from the deck list render in `(tabs)/index.tsx` (optional prop `index?: number`, mark renders only when provided).
- Like/pass overlays and `LikePassButtons.tsx`: LIKE stamp → volt border/text; PASS stamp → `colors.textMuted`; buttons: pass = seam outline circle, like = solid volt circle with `colors.onVolt` icon; drop glow/gradient imports.

- [ ] **Step 3: Grep-gate + verify**

Run: `grep -nE "colors\.(brand|accent|pink|solar|glow|heroA|heroB)|glow\(|heroGradient|solarGradient" "apps/mobile/app/(tabs)/_layout.tsx" "apps/mobile/app/(tabs)/index.tsx" apps/mobile/src/features/swipe/SwipeCard.tsx apps/mobile/src/features/swipe/LikePassButtons.tsx`
Expected: no output.
Run: `pnpm typecheck && pnpm lint` — green.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/(tabs)" apps/mobile/src/features/swipe
git commit -m "Volt 8/14: tab underlines and a deck with serial numbers"
```

---

### Task 9: Chat — both surfaces

**Files:**
- Modify: `apps/mobile/app/chat/[matchId].tsx`, `apps/mobile/app/party/[partyId]/chat.tsx`

**Interfaces:**
- Consumes: `type.tick`, Volt keys. Optimistic-send flow, entrance animations, haptics, keyboard handling: DO NOT TOUCH.

- [ ] **Step 1: Bubbles + ticks (`chat/[matchId].tsx`)**

- Own bubble: gradient (`heroGradient`) → solid `{ backgroundColor: scheme === "dark" ? "#202817" : colors.voltSoft }` — add token-free literal ONLY if a `bubbleOwn` value is absent; PREFERRED: add `bubbleOwn: "#202817"` (dark) / `bubbleOwn: "#E4EDC8"` (light) to both palettes in tokens.ts in this task, with text `colors.text`. Radius: `radius.md` (8) with the tail-corner at 3 if the current design differentiates a tail corner — otherwise uniform 8.
- Their bubble: `colors.surface` + 1px seam.
- Timestamps + receipt line ("Sending…"/"Sent"): `type.tick`; own-status color `colors.voltDim`, timestamps `colors.textMuted`. Copy stays as-is except casing — tick style uppercases visually; do not change the strings.
- Composer: fill `colors.surfaceAlt`, seam border, radius 6; send button = solid volt circle (`colors.onVolt` icon), disabled state opacity 0.45. Kill glows/gradients.
- Header/menu (`Sheet` chrome already Volt from Task 5): verify no brand/accent refs remain in this file.

- [ ] **Step 2: Party chat mirrors**

Apply the same bubble/tick/composer treatment in `party/[partyId]/chat.tsx` (it shares idioms; smaller file). p1/p2 identity colors: use `colors.p1Line`/`colors.p2Line` where the file distinguishes senders.

- [ ] **Step 3: Grep-gate + verify**

Run: `grep -nE "colors\.(brand|accent|pink|solar|glow|heroA|heroB)|glow\(|heroGradient|solarGradient" "apps/mobile/app/chat/[matchId].tsx" "apps/mobile/app/party/[partyId]/chat.tsx"`
Expected: no output.
Run: `pnpm typecheck && pnpm lint` — green.

- [ ] **Step 4: Commit**

```bash
git add "apps/mobile/app/chat" "apps/mobile/app/party"
git commit -m "Volt 9/14: chat goes solid — moss bubbles, mono ticks"
```

---

### Task 10: Match moment — brackets close, DUO LOCKED

**Files:**
- Modify: `apps/mobile/app/match/[matchId].tsx`

**Interfaces:**
- Consumes: `type.tick`/`type.label`, `colors.volt`, existing animation timing values (reuse the SAME duration/delay constants the aura-disc sequence uses today — re-skin, not re-time). Haptics calls stay exactly where they are.

- [ ] **Step 1: Replace the merging-discs visual**

Current: two aurora discs drift together behind the avatars. New sequence, same beats/timings:
1. Both avatars slide in (existing animation — keep).
2. Where the discs merged, render two bracket glyphs closing around the avatar pair: two `Animated.Text` elements, `[` and `]`, `fonts.monoSemibold` at ~64px, `colors.volt`, translating from ±40px outside the pair to hugging it (reuse the disc-merge shared values / timings).
3. At the merge beat (where the discs' union completed), a single full-screen volt flash: `Animated.View` overlay `backgroundColor: colors.volt`, opacity 0 → 0.18 → 0 over `motion.base`.
4. Title: replace the current "It's a match"-equivalent display text with `DUO LOCKED` in `type.label` scaled up (`fontSize: 16, letterSpacing: 3`, `colors.volt`), subtitle keeps existing copy/style with `colors.text`.
5. CTA buttons are already Volt via Task 4.

Delete the disc SVG/gradient code paths from this file. `GraticuleBackground variant="match"` (Task 7) is already in place.

- [ ] **Step 2: Grep-gate + verify**

Run: `grep -nE "colors\.(brand|accent|pink|solar|glow|heroA|heroB)|glow\(|heroGradient|solarGradient|RadialGradient" "apps/mobile/app/match/[matchId].tsx"`
Expected: no output.
Run: `pnpm typecheck && pnpm lint` — green.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/match"
git commit -m "Volt 10/14: the match moment — brackets close, DUO LOCKED"
```

---

### Task 11: Full sweep + alias deletion (the point of no return)

**Files:**
- Modify: every remaining file with deprecated refs — the authoritative list is the grep output, currently: `apps/mobile/app/settings/{privacy,notifications,connections,appearance}.tsx`, `app/{block-list,paywall,filters,edit-prompts,admirers,edit-details,online-now}.tsx`, `app/safety/index.tsx`, `app/(onboarding)/{shows,prompts}.tsx`, `app/(tabs)/{matches,profile}.tsx`, `src/features/onboarding/{CatalogPicker,WizardStep}.tsx`, `src/features/party/PartyInvitesBanner.tsx`, `src/features/profile/{GalleryPanel,ProfileCompleteness,VoiceIntroRecorderCard}.tsx`, `src/features/profile/sections/{VibeSection,PromptsSection}.tsx`, `src/features/swipe/ProfileDetailContent.tsx`
- Modify: `apps/mobile/src/theme/tokens.ts` + `useTheme.ts` (delete aliases + dead helpers)
- Modify: `apps/mobile/src/components/Chip.tsx`, `Button.tsx`, `GraticuleBackground.tsx` (drop deprecated tone/variant aliases)

**Interfaces:**
- Produces: a token file with ONLY Volt keys; `useTheme()` no longer returns `glow`, `heroGradient`, `solarGradient`. `ChipTone` loses `"accent"/"solar"`; Button loses `"solar"`; Graticule loses `"solar"`.

- [ ] **Step 1: Migrate every call site**

Mechanical mapping (apply per file, reading each usage in context):
`colors.brand|colors.accent → colors.volt` · `colors.brandInk|accentInk|brandDark → colors.voltDim` · `colors.brandSoft|accentSoft → colors.voltSoft` · `colors.pink → colors.voltRaw` (or `colors.volt` if it carries text) · `colors.solarA|solarB → colors.amber` · `colors.onSolar → colors.onAmber` · `colors.heroA|heroB → colors.volt` · `glow(anything) → delete the style entry` · `heroGradient/solarGradient JSX → solid fill View with colors.volt/colors.amber` (paywall CTA: `variant="premium"` Button) · `tone="accent" → tone="volt"` · `tone="solar" → tone="amber"` · `variant="solar" → variant="premium"` (Button) or `variant="default"` (Graticule).
Judgment calls: paywall hero art and Locked chips use amber family; profile completeness meter fill = `colors.volt`; admirers/online-now badges = voltSoft chip tone `"soft"`.

- [ ] **Step 2: Delete the compat layer**

In `tokens.ts`: remove every `@deprecated` alias key from BOTH palettes, and delete `glow()`, `heroGradient()`, `solarGradient()`. In `useTheme.ts`: remove `glow`, `heroGradient`, `solarGradient` from the import and the returned object. In `Chip.tsx`/`Button.tsx`/`GraticuleBackground.tsx`: remove alias tone/variant members and their mapping lines.

- [ ] **Step 3: The gates**

Run: `grep -rnE "colors\.(brand|accent|pink|solar|heroA|heroB|glow)|glow\(|heroGradient|solarGradient|onSolar" apps/mobile --include="*.tsx" --include="*.ts"`
Expected: no output.
Run: `grep -rnE "#8B5CF6|#7C3AED|#FF6EC7|#CB427B|#A78BFA|#14101F|#8452F5|#C9B4FF|#E0479E|#C93A8C" apps/mobile --include="*.tsx" --include="*.ts"`
Expected: no output.
Run: `pnpm typecheck && pnpm lint`
Expected: green — typecheck passing WITH the aliases deleted is the proof the sweep is complete.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "Volt 11/14: the sweep — Aurora's last tokens fall"
```

---

### Task 12: Contrast audit script (committed this time)

**Files:**
- Create: `scripts/audit-contrast.mjs`
- Modify: `package.json` (root — add script `"audit:contrast": "node scripts/audit-contrast.mjs"`)
- Possibly modify: `apps/mobile/src/theme/tokens.ts` (audit is the authority — darken failing values)

**Interfaces:**
- Produces: `pnpm audit:contrast` exits 0 when all enumerated pairs pass, 1 with a table of failures otherwise. Task 14 runs it as a gate.

- [ ] **Step 1: Write the script**

Parse token values by importing them directly (the file is plain TS constants — read via regex on `tokens.ts` source, matching `key: "#HEX"` and `key: "rgba(...)"`; composite rgba-over-background before measuring). Implement WCAG relative luminance + contrast ratio. Enumerate these pairs per scheme (min 4.5 unless marked LARGE→3.0):

```
text/background · text/surface · text/surfaceAlt · textMuted/background · textMuted/surface
volt/background (dark only — on paper volt is ink: volt/background 4.5) · voltDim/background
onVolt/volt · onAmber/amber · amber/background · danger/background · onFill/dangerDark
success/background · success/(successFill over background) · warning/(warningFill over background)
info/background · volt/(voltSoft over background) [paper: #2A3600-class check → assert volt(olive)/voltSoft-composite]
p2Line/background · overlap.*/surface · playstyle.*/surface
tabInactive(textMuted)/surfaceSolid · LARGE: voltRaw decorative marks are exempt (list them in an EXEMPT comment, don't measure)
```

Exit non-zero listing `scheme · pair · ratio · needed`.

- [ ] **Step 2: Run and reconcile**

Run: `pnpm audit:contrast`
If failures: darken the failing token (keep hue, drop lightness) in `tokens.ts`, re-run until 0 failures. Spec note: audit output overrides spec tables. Likely candidates to move: light `overlap.two #5A7A00` and `playstyle` midtones.

- [ ] **Step 3: Commit**

```bash
git add scripts/audit-contrast.mjs package.json apps/mobile/src/theme/tokens.ts
git commit -m "Volt 12/14: contrast audit joins the repo — every pair proven"
```

---

### Task 13: App icon + splash regeneration

**Files:**
- Modify: `scripts/generate-app-icons.mjs` (mark + colors)
- Regenerate: the icon/splash assets it writes (see the script's output paths — `apps/mobile/assets/*`)
- Verify: `apps/mobile/app.json` backgroundColor / splash values

**Interfaces:**
- Consumes: none. Produces: final assets; no code interfaces.

- [ ] **Step 1: Rework the mark**

In `scripts/generate-app-icons.mjs`: background `#0A0B09`; replace the two merging-aura discs with the volt double-chevron — two `»` chevrons drawn as SVG paths, `#CDFF3D`, geometric stroke (build as two polygons: `M x0 y0 L x0+w y_mid L x0 y1` shapes, weight ≈ 18% of canvas, second chevron offset right by 55% of chevron width at 0.55 opacity), centered optically (nudge left ~2% — chevrons read right-heavy). Keep the existing grain/noise application if the script has it.

- [ ] **Step 2: Regenerate + check app.json**

Run: `node scripts/generate-app-icons.mjs`
Expected: icon/splash PNGs rewritten. Then in `apps/mobile/app.json`: `splash.backgroundColor` and any `backgroundColor`/`adaptiveIcon.backgroundColor` → `#0A0B09`.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-app-icons.mjs apps/mobile/assets apps/mobile/app.json
git commit -m "Volt 13/14: the mark — double chevron, queue-forward"
```

---

### Task 14: Final verification + docs

**Files:**
- Modify: `README.md` (identity paragraph if it names Aurora), `docs/` mentions as found

**Interfaces:** none.

- [ ] **Step 1: The full gate battery**

```bash
pnpm typecheck && pnpm lint && pnpm audit:contrast
grep -rnE "#8B5CF6|#7C3AED|#FF6EC7|#CB427B|#A78BFA|#14101F|#8452F5|#C9B4FF|#E0479E|#C93A8C" apps/mobile --include="*.tsx" --include="*.ts" --include="*.json"
grep -rnE "Aurora|aurora" apps/mobile/src apps/mobile/app --include="*.tsx" --include="*.ts"
```
Expected: first line all green; both greps empty (rename any straggling "aurora" identifiers/comments).

- [ ] **Step 2: Docs sweep**

- `README.md`: update any design-system description to Volt (one short paragraph: off-black + chartreuse, seams not glow, Plex Mono machine voice; link the spec). While in there: fix the stale pre-production stubs section (photo moderation and email confirmations are LIVE — remove or mark done).
- Do NOT rewrite Aurora-era specs/plans in `docs/superpowers/` — they are history.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Volt 14/14: gates green, docs current — restyle complete"
```

- [ ] **Step 4: Report**

Summarize for Cameron: what changed, the device-pass checklist (dark + Paper, every screen, both button variants, chat send, match moment, paywall, empty states), and that Expo Go is enough to review (no native deps added).

---

## Self-review notes (resolved inline)

- Spec coverage: tokens→T2, chips→T3, buttons→T4, chrome→T5, status→T6, atmosphere→T7, tab/deck→T8, chat→T9, match→T10, sweep+deletion→T11, audit→T12, icon→T13, docs/verify→T14. Standouts rail, gallery, sheets, settings inherit via components + T11 sweep. ✔
- Type consistency: `type.tick`/`type.chipText`/`fonts.mono*` defined T1, consumed T3/T5/T6/T8/T9/T10. `voltRaw` defined T2, consumed T8 (index mark) + audit exemption T12. Chip tone `"soft"` defined T3, consumed T11 (admirers/online-now). ✔
- Placeholder scan: no TBDs; judgment calls are named and bounded (T11 Step 1 list). ✔
- Every task ends typecheck-green thanks to the T2 compat layer; T11's alias deletion is the completeness proof. ✔
