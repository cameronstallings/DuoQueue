# Aurora Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Cartridge" design system with "Aurora" (dark violet atmosphere, glass surfaces, one hero gradient, grain + aurora washes) across the whole app, and simplify profile view/edit, matches, and chat per the approved spec.

**Spec:** `docs/superpowers/specs/2026-08-01-aurora-restyle-design.md` — read it before starting any task.

**Architecture:** Token-first rollout. Phase 1 rewrites `tokens.ts`/`useTheme` with Aurora values while keeping every existing export name alive (Cartridge-only concepts become inert shims), so all ~40 screens instantly re-skin substantially and keep compiling. Phase 2 rebuilds shared components. Phase 3 sweeps screens mechanically. Phase 4 does the approved structural rebuilds. Phase 5 deletes the shims and verifies.

**Tech Stack:** Expo 54 / RN 0.81 (New Architecture — `boxShadow` string styles work), expo-router, reanimated 4, expo-linear-gradient (present), react-native-svg (ADDED in Task 1), @expo-google-fonts/unbounded + manrope (ADDED in Task 1), zustand, pnpm workspace.

## Global Constraints

- Repo: `C:\Users\stall\duoqueue`, branch `ui-overhaul`. App lives in `apps/mobile`. Path alias `@/` → `apps/mobile/src/`.
- **No test runner exists in this repo.** The verification cycle for every task is: `pnpm --filter @duoqueue/mobile typecheck` then `pnpm --filter @duoqueue/mobile lint` — both must pass before every commit. Where a task has testable pure logic, the "test" is a typecheck-level assertion described in the task.
- `fontWeight` must NEVER be set alongside a named `fontFamily` (Android synthesizes bold and smears; iOS ignores). Weight lives in the font file name.
- The app must compile after EVERY task. Compat shims listed in Task 2 may not be deleted before Task 24.
- Commit after every task with the message given in the task (append the repo's standard `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer).
- One uppercase style only: `type.label`. Do not add `textTransform: "uppercase"` anywhere else.
- Only these things may glow (colored `boxShadow`): primary/solar Button, active tab, presence/online indicators, unread match ring, selected Chip (subtle). Nothing else.
- Only hero surfaces get the luminous gradient edge: deck card, match sheet, own-profile identity card.

### Cartridge→Aurora transformation table (used by every sweep task)

| Cartridge idiom (found in screens) | Aurora replacement |
|---|---|
| `borderWidth: hairline, borderColor: colors.ink` on surfaces | keep border, it now renders as glass hairline (tokens changed); DELETE the line only where a `Card`/`Chip` component replaces the hand-rolled view |
| `...shadow` / `...shadowLifted` spreads | delete the spread (shims return `{}` — remove the dead reference) |
| `pressedOffset` / `transform: [{translateX: 2}, {translateY: 2}]` press states | `opacity: pressed ? 0.85 : 1` |
| `radius.pill` | `radius.chip` (both 999 now; prefer `chip`) |
| `type.stat` / `type.statSm` | `type.caption` with `color: colors.textMuted` (delete uppercase intent) |
| `type.micro` | `type.label` |
| hardcoded `#fff`, `#000`, `fontSize:`, `fontWeight:`, `borderRadius:` literals | nearest token (`colors.*`, `type.*`, `radius.*`); if a size genuinely has no token, use the closest `type` style and note it in the commit body |
| `colors.brandSoft`/`accentSoft` boxes with borders | `Card` (glass) or plain `colors.surface` view |
| `foil` gradient usages | `theme.solarGradient` (same `{colors,start,end}` shape) |
| section head rules (`height: 3` bars, `p1Line` underlines) | delete — spacing + `SectionLabel` do the separation |

---

## Phase 1 — Foundation

### Task 1: Dependencies and font loading

**Files:**
- Modify: `apps/mobile/package.json` (via pnpm commands, not hand-edit)
- Modify: `apps/mobile/app/_layout.tsx:10-18,83-91`

**Interfaces:**
- Produces: loaded font faces `Unbounded_600SemiBold`, `Unbounded_700Bold`, `Manrope_500Medium`, `Manrope_600SemiBold`, `Manrope_700Bold`, `Manrope_800ExtraBold` — Task 2's `fonts` object depends on exactly these names. Also `react-native-svg` importable as `react-native-svg` — Task 3 depends on it.

- [ ] **Step 1: Add new dependencies (Expo-pinned)**

```bash
cd apps/mobile
npx expo install react-native-svg
pnpm add @expo-google-fonts/unbounded @expo-google-fonts/manrope
pnpm remove @expo-google-fonts/archivo @expo-google-fonts/bungee @expo-google-fonts/martian-mono
```

(If `npx expo install` misbehaves under pnpm workspaces, `pnpm --filter @duoqueue/mobile add react-native-svg@<version expo 54 pins>` — find the pin with `npx expo install --check`.)

- [ ] **Step 2: Swap the font imports and `useFonts` block in `_layout.tsx`**

Replace lines 11-18 (Archivo/Bungee/MartianMono imports) with:

```tsx
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { Unbounded_600SemiBold, Unbounded_700Bold } from "@expo-google-fonts/unbounded";
```

Replace the `useFonts({...})` object (lines 84-91) with those six faces.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @duoqueue/mobile typecheck` → expect FAIL ONLY in `src/theme/tokens.ts` (references `Archivo_*` names via strings — actually tokens.ts uses string literals, so expect PASS; if PASS, fonts are simply unresolved at runtime until Task 2 — acceptable, Task 2 lands in the same session). `pnpm --filter @duoqueue/mobile lint` → PASS.

- [ ] **Step 4: Commit** — `git commit -m "Swap to Aurora font stack and add react-native-svg"`

### Task 2: Rewrite tokens.ts and useTheme.ts

**Files:**
- Rewrite: `apps/mobile/src/theme/tokens.ts`
- Rewrite: `apps/mobile/src/theme/useTheme.ts`

**Interfaces:**
- Consumes: font face names from Task 1.
- Produces (consumed by every later task):
  - `spacing` (unchanged values), `radius = { chip: 999, sm: 10, window: 16, input: 14, button: 16, md: 16, card: 20, lg: 20, sheet: 28, round: 999, pill: 999 }`
  - `fonts = { medium, semibold, bold, extrabold, display, displayBold, /* compat: */ black, mono, monoBold, marquee }`
  - `type = { screenTitle, cardName, title, quote, body, bodyStrong, caption, label, /* compat: */ marquee, stat, statSm, micro }`
  - `lightColors`/`darkColors` with ALL existing keys plus `surfaceSolid, pink, heroA, heroB, solarA, solarB, onSolar, glowViolet, glowPink`
  - `glow(color: string, r?: number): { boxShadow: string }`
  - `heroGradient(colors)` / `solarGradient(colors)` returning `{ colors: readonly [string,string], start: {x,y}, end: {x,y} }`
  - compat shims: `shadow()`, `shadowLifted()` → `{}`; `pressedOffset` → `{}`; `hairline = 1`; `foil` → solar-shaped `{colors,start,end,onFoil}`; `SCRIM_RGB = "10,7,18"`
  - `useTheme()` returns everything it does today PLUS `glow`, `heroGradient`, `solarGradient` (resolved for the active scheme).

- [ ] **Step 1: Write the new tokens.ts**

```tsx
import type { TextStyle } from "react-native";

/**
 * DuoQueue design tokens — "Aurora".
 * Dark violet night, glass surfaces, one hero gradient (pink→violet), gold for money.
 * Depth = glow, never borders-and-plates. Texture = grain + aurora washes (see
 * components/GrainOverlay and components/AuroraBackground).
 */

export const spacing = {
  xs: 4, sm: 8, tight: 12, md: 16, lg: 24, xl: 32, xxl: 48, huge: 64,
} as const;

export const fonts = {
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  /** Unbounded — names, screen titles, hero moments ONLY. */
  display: "Unbounded_600SemiBold",
  displayBold: "Unbounded_700Bold",
  /** @deprecated Cartridge compat — migrate to display/bold. Deleted in the cleanup task. */
  black: "Unbounded_600SemiBold",
  mono: "Manrope_600SemiBold",
  monoBold: "Manrope_700Bold",
  marquee: "Unbounded_700Bold",
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: 0 },
  cardName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  title: { fontFamily: fonts.extrabold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  quote: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23, letterSpacing: -0.1 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  /** The ONLY uppercase style. Section labels, sparingly. */
  label: { fontFamily: fonts.extrabold, fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: "uppercase" },
  /** @deprecated Cartridge compat aliases — migrate: marquee→screenTitle, stat/statSm→caption, micro→label. */
  marquee: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30, letterSpacing: 0.4 },
  stat: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  statSm: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
  micro: { fontFamily: fonts.extrabold, fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: "uppercase" },
} as const satisfies Record<string, TextStyle>;

export const radius = {
  chip: 999, sm: 10, window: 16, input: 14, button: 16, md: 16, card: 20, lg: 20,
  sheet: 28, round: 999,
  /** @deprecated use chip */
  pill: 999,
} as const;

/* Categorical inks — same anti-rarity-ladder rationale as before (word label always
 * accompanies; a property of the PAIR, not the person), re-hued for Aurora. */
const OVERLAP_DARK = { none: "#8E86A3", one: "#7BC7A8", two: "#8FA7E8", many: "#E8B36B" } as const;
const OVERLAP_LIGHT = { none: "#736A8C", one: "#2E7D5B", two: "#3B5BA8", many: "#A8690F" } as const;
const PLAYSTYLE_DARK = { casual: "#B9B3CC", intermediate: "#9ED4B4", competitive: "#A6BCE8", ranked_grinder: "#E4C08E" } as const;
const PLAYSTYLE_LIGHT = { casual: "#5E5878", intermediate: "#1F6E48", competitive: "#33518F", ranked_grinder: "#8F5E14" } as const;

export const darkColors = {
  background: "#14101F",
  surface: "rgba(255,255,255,0.06)",
  surfaceSolid: "#1C1728",
  surfaceAlt: "rgba(255,255,255,0.10)",
  border: "rgba(255,255,255,0.09)",
  /** @deprecated Cartridge keyline — now the glass hairline; migrate to `border`. */
  ink: "rgba(255,255,255,0.09)",
  text: "#F0ECF7",
  textMuted: "#9C92B8",

  heroA: "#FF6EC7", heroB: "#8B5CF6",
  pink: "#FF6EC7",
  brand: "#8B5CF6",
  brandInk: "#C9B4FF",
  brandDark: "#7C3AED",
  brandSoft: "rgba(139,92,246,0.16)",
  accent: "#A78BFA",
  accentInk: "#B79CFF",
  accentSoft: "rgba(167,139,250,0.14)",
  p1Line: "#FF6EC7",
  p2Line: "#A78BFA",

  solarA: "#FFD98A", solarB: "#FF9D5C", onSolar: "#4A2A00",

  danger: "#FF5C7A",
  success: "#4ADE9C",
  warning: "#FFC864",
  info: "#7FD4FF",
  onFill: "#FFFFFF",
  successFill: "rgba(74,222,156,0.18)",
  warningFill: "rgba(255,200,100,0.18)",

  glowViolet: "rgba(139,92,246,0.45)",
  glowPink: "rgba(255,110,199,0.45)",

  overlap: OVERLAP_DARK,
  playstyle: PLAYSTYLE_DARK,
} as const;

export const lightColors = {
  background: "#F7F4FC",
  surface: "#FFFFFF",
  surfaceSolid: "#FFFFFF",
  surfaceAlt: "#EFEAF8",
  border: "rgba(76,58,130,0.14)",
  ink: "rgba(76,58,130,0.14)",
  text: "#241A3D",
  textMuted: "#6E6390",

  heroA: "#E0479E", heroB: "#7C3AED",
  pink: "#C93A8C",
  brand: "#7C3AED",
  brandInk: "#6D28D9",
  brandDark: "#5B21B6",
  brandSoft: "rgba(124,58,237,0.10)",
  accent: "#7C3AED",
  accentInk: "#6D28D9",
  accentSoft: "rgba(124,58,237,0.08)",
  p1Line: "#C93A8C",
  p2Line: "#7C3AED",

  solarA: "#E8963C", solarB: "#D97706", onSolar: "#FFFFFF",

  danger: "#D6335F",
  success: "#1F8A5D",
  warning: "#9A6B00",
  info: "#1D7FA8",
  onFill: "#FFFFFF",
  successFill: "rgba(31,138,93,0.14)",
  warningFill: "rgba(154,107,0,0.14)",

  glowViolet: "rgba(124,58,237,0.25)",
  glowPink: "rgba(224,71,158,0.25)",

  overlap: OVERLAP_LIGHT,
  playstyle: PLAYSTYLE_LIGHT,
} as const;

export type ThemeColors = typeof darkColors;

/** Colored soft glow — the ONLY depth/emphasis channel. See Global Constraints for
 * the short list of things allowed to glow. */
export function glow(color: string, r = 20) {
  return { boxShadow: `0 0 ${r}px 0 ${color}` } as const;
}

export function heroGradient(c: ThemeColors) {
  return { colors: [c.heroA, c.heroB] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
}
export function solarGradient(c: ThemeColors) {
  return { colors: [c.solarA, c.solarB] as const, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
}

/** Photo scrim black — violet-tinted, not #000. */
export const SCRIM_RGB = "10,7,18";

export const motion = { instant: 90, quick: 140, base: 200, deliberate: 260 } as const;

/* ------------------------------------------------------------------ */
/* Cartridge compat shims — inert. Deleted in the final cleanup task.  */
/* ------------------------------------------------------------------ */
/** @deprecated plates are gone; returns {}. Remove the call site when you touch it. */
export function shadow(_scheme: "light" | "dark") { return {} as const; }
/** @deprecated plates are gone; returns {}. */
export function shadowLifted(_scheme: "light" | "dark") { return {} as const; }
/** @deprecated press feedback is opacity/scale now; this is a no-op style. */
export const pressedOffset = {} as const;
/** @deprecated the printed keyline is dead; 1px glass hairlines use colors.border. */
export const hairline = 1;
/** @deprecated foil is dead; this now carries the solar gradient so paywall surfaces
 * stay premium-looking until they migrate to useTheme().solarGradient. */
export const foil = {
  colors: ["#FFD98A", "#FF9D5C"] as const,
  start: { x: 0, y: 1 }, end: { x: 1, y: 0 },
  onFoil: "#4A2A00",
} as const;
```

- [ ] **Step 2: Write the new useTheme.ts**

```tsx
import { useColorScheme } from "react-native";

import { useThemeStore } from "@/store/theme-store";

import {
  darkColors, fonts, foil, glow, hairline, heroGradient, lightColors, motion,
  pressedOffset, radius, SCRIM_RGB, shadow, shadowLifted, solarGradient, spacing, type,
} from "./tokens";

export function useTheme() {
  const systemScheme = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  // Aurora is dark-first: an unreadable system scheme resolves dark.
  const scheme = preference === "system" ? (systemScheme ?? "dark") : preference;
  const colors = scheme === "dark" ? darkColors : lightColors;
  return {
    colors, spacing, radius, scheme, type, fonts, motion,
    glow,
    heroGradient: heroGradient(colors),
    solarGradient: solarGradient(colors),
    scrimRgb: SCRIM_RGB,
    // Compat (all inert or deprecated — see tokens.ts):
    shadow: shadow(scheme), shadowLifted: shadowLifted(scheme), pressedOffset, hairline, foil,
  } as const;
}
```

- [ ] **Step 3: Verify** — typecheck + lint both PASS (every old export name still exists). Boot check if convenient: `pnpm mobile` renders dark violet screens with glass hairlines.

- [ ] **Step 4: Commit** — `git commit -m "Rebuild the token layer as Aurora, with inert Cartridge shims"`

### Task 3: GrainOverlay, AuroraBackground, ScreenContainer

**Files:**
- Create: `scripts/generate-noise-png.mjs`, `apps/mobile/assets/noise.png` (generated)
- Create: `apps/mobile/src/components/GrainOverlay.tsx`
- Create: `apps/mobile/src/components/AuroraBackground.tsx`
- Modify: `apps/mobile/src/components/ScreenContainer.tsx`

**Interfaces:**
- Produces:
  - `<GrainOverlay />` — absolute-fill, pointerEvents none, no props.
  - `<AuroraBackground variant?: "default" | "match" | "solar" />` — absolute-fill behind content.
  - `ScreenContainer` gains prop `aurora?: "default" | "solar" | "none"` (default `"default"`); keeps `title/showClose/showBack/refreshControl` exactly as today.

- [ ] **Step 1: Write the noise generator (no new deps — raw PNG chunks + node zlib)**

```js
// scripts/generate-noise-png.mjs — writes apps/mobile/assets/noise.png
// 128x128 RGBA: white pixels, random alpha 0–22. Run: node scripts/generate-noise-png.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const W = 128, H = 128;
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  const row = y * (1 + W * 4);
  raw[row] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const px = row + 1 + x * 4;
    raw[px] = raw[px + 1] = raw[px + 2] = 255;
    raw[px + 3] = Math.floor(Math.random() * 23);
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (typeStr, data) => {
  const t = Buffer.from(typeStr, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(new URL("../apps/mobile/assets/noise.png", import.meta.url), png);
console.log("wrote apps/mobile/assets/noise.png", png.length, "bytes");
```

- [ ] **Step 2: Run it** — `node scripts/generate-noise-png.mjs`; confirm the PNG exists and opens.

- [ ] **Step 3: Write GrainOverlay.tsx**

```tsx
import { Image, StyleSheet } from "react-native";

/** Aurora's film grain — a tiled noise PNG at ~5%. Sits over the aurora washes,
 * under content. The single cheapest thing keeping flat gradients from reading flat. */
export function GrainOverlay() {
  return (
    <Image
      source={require("../../assets/noise.png")}
      resizeMode="repeat"
      pointerEvents="none"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, { width: undefined, height: undefined, opacity: 0.05 }]}
    />
  );
}
```

- [ ] **Step 4: Write AuroraBackground.tsx**

```tsx
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";

interface AuroraBackgroundProps {
  variant?: "default" | "match" | "solar";
}

/** Two soft radial washes — violet upper-left, pink lower-right (gold pair for solar).
 * Fixed geometry per variant; background only, content never sits inside a gradient. */
export function AuroraBackground({ variant = "default" }: AuroraBackgroundProps) {
  const { colors, scheme } = useTheme();
  const a = variant === "solar" ? colors.solarB : scheme === "dark" ? "#8B5CF6" : "#7C3AED";
  const b = variant === "solar" ? colors.solarA : scheme === "dark" ? "#FF6EC7" : "#E0479E";
  const opacity = scheme === "dark" ? (variant === "solar" ? 0.30 : 0.34) : 0.14;
  // match: the two washes sit close, about to merge behind the avatars.
  const posA = variant === "match" ? { cx: "35%", cy: "42%" } : { cx: "12%", cy: "8%" };
  const posB = variant === "match" ? { cx: "65%", cy: "46%" } : { cx: "92%", cy: "94%" };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="aurA"><Stop offset="0" stopColor={a} stopOpacity={opacity} /><Stop offset="1" stopColor={a} stopOpacity="0" /></RadialGradient>
          <RadialGradient id="aurB"><Stop offset="0" stopColor={b} stopOpacity={opacity * 0.75} /><Stop offset="1" stopColor={b} stopOpacity="0" /></RadialGradient>
        </Defs>
        <Ellipse {...posA} rx="70%" ry="45%" fill="url(#aurA)" />
        <Ellipse {...posB} rx="65%" ry="42%" fill="url(#aurB)" />
      </Svg>
    </View>
  );
}
```

- [ ] **Step 5: Rework ScreenContainer**

Keep the entire existing behavior (title row, close/back buttons, modal `topInset` logic, scroll padding, status-bar backdrop) with these changes:

1. Root view: render `<AuroraBackground variant={aurora === "solar" ? "solar" : "default"} />` then `<GrainOverlay />` as the first children of the `KeyboardAvoidingView` (skip both when `aurora === "none"`), so every screen inherits the atmosphere.
2. Nav buttons (all three Pressables): drop `borderWidth`/`borderColor`, `backgroundColor: colors.surfaceAlt`, `borderRadius: radius.round`.
3. Delete the title rule bar (`width: 32, height: 3` view) — Aurora kills section rules.
4. Title row / backdrop `backgroundColor: colors.background` stays (auroras are inside the container, behind these).
5. New prop: `aurora?: "default" | "solar" | "none"` defaulting `"default"`.

- [ ] **Step 6: Verify** — typecheck + lint PASS. Boot: every ScreenContainer screen shows washes + grain.

- [ ] **Step 7: Commit** — `git commit -m "Add the Aurora atmosphere: grain, washes, and a container that carries them"`

### Task 4: Dark default

**Files:**
- Modify: `apps/mobile/src/store/theme-store.ts:14`

**Interfaces:**
- Produces: default `preference` is `"dark"` when nothing is persisted. `loadThemePreference` behavior unchanged (explicit saved choices always win).

- [ ] **Step 1:** In `useThemeStore`, change `preference: "system"` → `preference: "dark"`. Update the file's comment to say: dark is Aurora's default; "system"/"light" remain user choices via Settings → Appearance.
- [ ] **Step 2: Verify** — typecheck + lint PASS. Fresh install (or cleared AsyncStorage) boots dark even on a light-mode device.
- [ ] **Step 3: Commit** — `git commit -m "Default new installs to dark"`

---

## Phase 2 — Core components

### Task 5: Chip + ChipSelect + InfoChip

**Files:**
- Create: `apps/mobile/src/components/Chip.tsx`
- Rewrite: `apps/mobile/src/components/ChipSelect.tsx` (same public API, renders Chips)
- Rewrite: `apps/mobile/src/components/InfoChip.tsx` (same public API, renders a Chip)

**Interfaces:**
- Produces:

```tsx
// Chip.tsx
export type ChipTone = "default" | "accent" | "success" | "solar" | "danger";
export interface ChipProps {
  label: string;
  /** Inline secondary value rendered after a dot — "Valorant · Diamond". */
  detail?: string;
  icon?: React.ReactNode;      // pre-sized element, 13px
  selected?: boolean;
  tone?: ChipTone;             // default "default"
  onPress?: () => void;        // renders Pressable when given
}
export function Chip(props: ChipProps): JSX.Element;
```

- [ ] **Step 1: Write Chip.tsx** — pill (`radius.chip`), `paddingVertical: spacing.sm - 1`, `paddingHorizontal: spacing.md - 2`, row + `gap: spacing.xs`.
  - Resting: `backgroundColor: colors.surface`, `borderWidth: 1`, `borderColor: colors.border`, label `type.caption` in `colors.text`, detail in `colors.textMuted` after a `·`.
  - `selected` (or tone `accent`): bg `colors.brandSoft`, border `colors.accent` at 50% (use `colors.accentSoft` trick: border `rgba` via `colors.accent` + opacity is not expressible — use `colors.accent` and it reads fine at 1px), text `colors.brandInk`, plus `glow(colors.glowViolet, 10)` when `selected`.
  - tones: `success` → bg `colors.successFill`, text/border `colors.success`; `solar` → bg `colors.warningFill`, text/border `colors.solarA` (dark) — implement as `scheme === "dark" ? colors.solarA : colors.solarB`; `danger` → text/border `colors.danger`, bg transparent.
  - If `onPress`: wrap in Pressable, `accessibilityRole="button"`, `accessibilityState={{ selected }}`, pressed → `opacity: 0.85`.
- [ ] **Step 2: Rewrite ChipSelect** to map options → `<Chip label onPress selected />` (keeps generic `<T extends string>` API and wrap layout).
- [ ] **Step 3: Rewrite InfoChip** as a wrapper: `label`, `sublabel` → `detail`, icon families → a sized icon element passed to `Chip icon`. Icon color: `colors.accentInk`. Mark with `@deprecated use Chip` doc tag (call sites migrate in later tasks; the wrapper keeps them compiling AND correctly styled meanwhile).
- [ ] **Step 4: Verify** — typecheck + lint PASS (API-compatible, no call-site edits needed).
- [ ] **Step 5: Commit** — `git commit -m "One chip to rule them all"`

### Task 6: Button + ModalHeader

**Files:**
- Rewrite: `apps/mobile/src/components/Button.tsx`
- Create: `apps/mobile/src/components/ModalHeader.tsx`

**Interfaces:**
- Produces:
  - `Button` props gain `variant?: "primary" | "secondary" | "ghost" | "solar"` (rest unchanged: `label, onPress, loading, disabled`). `ButtonRow` unchanged.
  - `ModalHeader { title: string; onClose?: () => void }` — the shared modal title row (defaults `onClose` to `router.back()`).

- [ ] **Step 1: Rewrite Button.tsx.** Structure: outer `Pressable` (no fill) → inner content view. Primary/solar render an `expo-linear-gradient` `<LinearGradient {...heroGradient|solarGradient}>` as the fill (radius `radius.button`, padding `spacing.md + 2` / `spacing.xl`); secondary is a glass view (`colors.surface` + 1px `colors.border`); ghost is bare.
  - Label: `type.bodyStrong`; primary label `colors.onFill`, solar `colors.onSolar`, secondary/ghost `colors.text`. Keep the pulsing `ButtonLabel` (drop its `type.label` for `type.bodyStrong` — no more uppercase buttons).
  - Glow: primary `glow(colors.glowViolet)`, solar `glow("rgba(255,157,92,0.35)")` — applied to the Pressable style when not disabled.
  - Press: `transform: [{ scale: pressed ? 0.97 : 1 }]` on the Pressable. No translate. Disabled: opacity 0.45.
- [ ] **Step 2: Write ModalHeader.tsx** — row: `type.screenTitle` title (flex 1, numberOfLines 1) + 34px round glass close button (`colors.surfaceAlt`, `radius.round`, Ionicons `close` 19 `colors.text`), `paddingBottom: spacing.md`. This replaces the hand-rolled headers in edit-details/edit-prompts (swapped in Task 22).
- [ ] **Step 3: Verify** — typecheck + lint PASS.
- [ ] **Step 4: Commit** — `git commit -m "Aurora buttons: gradient primaries, glass secondaries, scale press"`

### Task 7: Card + Sheet

**Files:**
- Rewrite: `apps/mobile/src/components/Card.tsx`
- Create: `apps/mobile/src/components/Sheet.tsx`

**Interfaces:**
- Produces:
  - `Card { style?, flat?, luminous? }` — glass by default; `luminous` adds the 1px hero-gradient edge (hero surfaces ONLY); `flat` = no bg/border (dense lists).
  - `Sheet { visible: boolean; onClose: () => void; title?: string; children }` — THE bottom-sheet chrome.

- [ ] **Step 1: Rewrite Card.tsx**

```tsx
import type { PropsWithChildren } from "react";
import type { ViewStyle } from "react-native";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/theme/useTheme";

interface CardProps extends PropsWithChildren {
  style?: ViewStyle;
  /** No glass fill — for rows inside dense lists. */
  flat?: boolean;
  /** 1px hero-gradient edge. Hero surfaces only (deck card, match sheet, own-profile header). */
  luminous?: boolean;
}

export function Card({ children, style, flat, luminous }: CardProps) {
  const { colors, radius, spacing, heroGradient } = useTheme();
  const inner = (
    <View
      style={[
        {
          backgroundColor: flat ? "transparent" : luminous ? colors.surfaceSolid : colors.surface,
          borderRadius: luminous ? radius.card - 1 : radius.card,
          padding: spacing.lg,
          borderWidth: flat || luminous ? 0 : 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!luminous) return inner;
  return (
    <LinearGradient {...heroGradient} style={{ borderRadius: radius.card, padding: 1 }}>
      {inner}
    </LinearGradient>
  );
}
```

- [ ] **Step 2: Write Sheet.tsx** — RN `Modal transparent animationType="slide" onRequestClose={onClose}`; full-screen Pressable scrim `rgba(10,7,18,0.6)` closing on press; bottom panel: `colors.surfaceSolid`, top radius `radius.sheet`, `paddingTop: spacing.sm`, `paddingHorizontal: spacing.lg`, `paddingBottom: insets.bottom + spacing.lg`; centered 36×4 grab handle (`colors.surfaceAlt`, radius.round); optional `title` as `type.title` + `spacing.md` bottom margin; children below. Panel wrapped in a plain View that stops scrim press propagation.
- [ ] **Step 3: Verify** — typecheck + lint PASS.
- [ ] **Step 4: Commit** — `git commit -m "Glass cards, luminous edges, and one shared Sheet"`

### Task 8: Small components sweep

**Files:**
- Modify: `apps/mobile/src/components/SectionLabel.tsx`, `EmptyState.tsx`, `Skeleton.tsx`, `TextField.tsx`, `Slider.tsx`, `NavRow.tsx`, `PresenceAvatar.tsx`, `Toast.tsx`, `OfflineBanner.tsx`, `VoiceIntroPlayer.tsx`
- Read each file first; they are all <150 lines.

**Interfaces:** all public APIs unchanged.

- [ ] **Step 1: SectionLabel** — `type.label` in `colors.accent`; delete the brand rule segment beside it.
- [ ] **Step 2: EmptyState** — replace the rotated keyline square with a 64px `radius.round` view, bg `colors.brandSoft`, icon in `colors.accentInk`, `glow(colors.glowViolet, 24)`; body text unchanged.
- [ ] **Step 3: Skeleton** — shimmer/base colors to `colors.surfaceAlt` on `colors.surface`; radius to `radius.sm`.
- [ ] **Step 4: TextField** — bg `colors.surface`, 1px `colors.border`, radius `radius.input`, focused border `colors.accent`; drop keyline/plate idioms if present.
- [ ] **Step 5: Slider** — track `colors.surfaceAlt`, fill `colors.accent`, thumb `colors.text`-colored circle, no borders.
- [ ] **Step 6: NavRow** — glass row (transparent bg, pressed `colors.surfaceAlt`), chevron `colors.textMuted`, drop keylines/plates.
- [ ] **Step 7: PresenceAvatar** — presence dot becomes `colors.success` dot + `glow("rgba(74,222,156,0.6)", 8)`; keep the notch geometry.
- [ ] **Step 8: Toast / OfflineBanner / VoiceIntroPlayer** — apply the transformation table (glass surfaces, no plates, token type).
- [ ] **Step 9: Verify** — typecheck + lint PASS.
- [ ] **Step 10: Commit** — `git commit -m "Re-skin the small components to Aurora"`

### Task 9: Tab bar + Logo

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Rewrite: `apps/mobile/src/components/Logo.tsx`

**Interfaces:** `Logo { width?, variant? }` unchanged.

- [ ] **Step 1: Tab bar.** In `screenOptions`:
  - `tabBarStyle`: `{ backgroundColor: colors.surfaceSolid, borderTopWidth: 0, elevation: 0, height: 60 + insets.bottom (use useSafeAreaInsets), paddingTop: 6 }` — full-width bar, solid (glass over content muddies), no border; separation comes from the color step.
  - `tabBarActiveTintColor: colors.text`, inactive `colors.textMuted`.
  - `tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0 }` (no uppercase).
- [ ] **Step 2: Active icon tile.** Replace the raw icon render with a small wrapper component in the same file: active = 34×34 `LinearGradient {...heroGradient}` tile (`borderRadius: radius.sm`, icon `colors.onFill` size 19, `glow(colors.glowViolet, 14)`); inactive = bare icon size 22 in `color` (the tint). Keep the existing `TAB_CONFIG` icon names.
- [ ] **Step 3: Rewrite Logo.tsx** — delete the three offset plates. Single `Text` in `fonts.displayBold`: `"DQ"` mark / `"duoqueue"` wordmark (lowercase now — Unbounded lowercase is distinctive), color `colors.text`, with the `"Q"`/`"queue"` segment in `colors.accent` via nested `<Text>` spans. Keep width-driven sizing math (`mark` ratio 0.52, `wordmark` ratio 0.145 — Unbounded runs wide). Keep accessibility props.
- [ ] **Step 4: Verify** — typecheck + lint PASS. Boot: tab bar shows gradient active tile; splash/loading logo renders new mark.
- [ ] **Step 5: Commit** — `git commit -m "Floating-free tab bar with a glowing active tile; redraw the logo in Unbounded"`

---

## Phase 3 — Screen sweep (mechanical, transformation table applies)

**Sweep procedure for every task in this phase:** for each listed file: read it; apply the transformation table (Global Constraints); replace hand-rolled buttons/sheets/chips with `Button`/`Sheet`/`Chip` ONLY where drop-in (structural rebuilds stay in Phase 4); ensure the screen renders inside `ScreenContainer` OR renders `AuroraBackground`+`GrainOverlay` itself if it has bespoke layout (deck, chat); typecheck + lint; commit.

### Task 10: Auth + welcome + index sweep

**Files:** `apps/mobile/app/(auth)/sign-in.tsx`, `(auth)/sign-up.tsx`, `(auth)/confirm-email.tsx`, `(auth)/age-gate.tsx`, `(auth)/_layout.tsx`, `welcome.tsx`, `index.tsx`

- [ ] **Step 1:** Sweep each file per the procedure. Welcome screen: hero moment — wordmark `Logo variant="wordmark"`, tagline `type.body` muted, primary CTA `Button` primary; this screen may use `AuroraBackground variant="match"` for a denser wash.
- [ ] **Step 2:** Verify (typecheck + lint), boot to welcome/sign-in and eyeball.
- [ ] **Step 3:** Commit — `git commit -m "Sweep auth and welcome to Aurora"`

### Task 11: Onboarding sweep

**Files:** all 11 files under `apps/mobile/app/(onboarding)/` (`display-name, gender, region, languages, platforms, games, playstyles, shows, prompts, discord, _layout`)

- [ ] **Step 1:** Sweep per procedure. These screens are ChipSelect/TextField/Button-heavy, so most of the work landed in Phase 2 — this pass removes local keylines, stat/micro type, hardcoded literals, and any progress-rule bars.
- [ ] **Step 2:** Verify; walk the flow in Expo if practical.
- [ ] **Step 3:** Commit — `git commit -m "Sweep onboarding to Aurora"`

### Task 12: Deck + swipe feature sweep

**Files:** `apps/mobile/app/(tabs)/index.tsx`; in `apps/mobile/src/features/swipe/`: `SwipeCard.tsx`, `LikePassButtons.tsx`, `StandoutCardModal.tsx`, plus any quota/meter/stamp modules found there (`ls` the directory; **exclude** `ProfileDetailContent.tsx` — Task 17 rebuilds it).

- [ ] **Step 1:** Deck card becomes THE luminous hero surface: outer edge = 1px hero gradient (use `Card luminous` or inline `LinearGradient` wrapper at `radius.card`), inner solid `colors.surfaceSolid`, photo window `radius.window`. The overlap-colored frame idiom dies: overlap ink now tints the shared-games chip (`Chip` with `detail`, border/text in `colors.overlap[tier]`) and its word label stays.
- [ ] **Step 2:** LIKE stamp → hero-gradient fill pill, PASS stamp → glass pill (keep rotation/animation). Like button → gradient circle with `glow(colors.glowPink)`; pass → glass circle. Quota/meter surfaces → glass + `colors.accent` fills; Standout accents → solar tone.
- [ ] **Step 3:** Verify; swipe a card in Expo.
- [ ] **Step 4:** Commit — `git commit -m "Sweep the deck to Aurora: luminous card, gradient like"`

### Task 13: Settings + safety + list-modals sweep

**Files:** `apps/mobile/app/(tabs)/settings.tsx`, `settings/appearance.tsx`, `settings/notifications.tsx`, `settings/privacy.tsx`, `settings/account.tsx`, `settings/connections.tsx`, `safety/index.tsx`, `safety/[topic].tsx`, `block-list.tsx`, `hidden-words.tsx`, plus `src/components/ReportModal.tsx`

- [ ] **Step 1:** Sweep per procedure (NavRow/Card/Button did most). `appearance.tsx`: ensure the three preference options read Dark / Light / System with dark listed first (it is the default now). ReportModal: rebuild its chrome on `Sheet` if drop-in (it is a centered modal today — if not drop-in, sweep visuals only and note for Task 20).
- [ ] **Step 2:** Verify; open each settings sub-screen.
- [ ] **Step 3:** Commit — `git commit -m "Sweep settings, safety and list modals to Aurora"`

### Task 14: Monetization + social modals sweep

**Files:** `apps/mobile/app/paywall.tsx`, `admirers.tsx`, `online-now.tsx`, `filters.tsx`, `party/[partyId]/index.tsx`, `party/[partyId]/chat.tsx`, `src/features/party/PartyInvitesBanner.tsx`

- [ ] **Step 1:** Sweep per procedure. Paywall is the SOLAR screen: `ScreenContainer aurora="solar"`, plan cards = `Card` glass with the selected plan on a solar 1px edge (LinearGradient wrapper, `solarGradient`), CTA = `Button variant="solar"`. All old `foil` references migrate to `solarGradient` here. Admirers/online-now rows: glass rows + presence glow. Party screens: sweep only.
- [ ] **Step 2:** Verify; open paywall, admirers, online-now, filters.
- [ ] **Step 3:** Commit — `git commit -m "Sweep monetization and social surfaces; gold means money now"`

---

## Phase 4 — Structural rebuilds

### Task 15: Shared profile section components

**Files:**
- Create: `apps/mobile/src/features/profile/sections/GamesSection.tsx`, `HowIPlaySection.tsx`, `VibeSection.tsx`, `ShowsSection.tsx`, `PromptsSection.tsx`, `MetaLine.tsx`, `index.ts` (barrel)
- Read first: `src/features/swipe/types.ts` (DeckCard type), `(tabs)/profile.tsx`, `src/features/swipe/ProfileDetailContent.tsx` — prop types below must be satisfied by BOTH call sites' existing data; where the two sides differ, the section takes the smaller common shape and the caller adapts.

**Interfaces:**
- Produces (each renders `SectionLabel` + content, no Edit affordances, no icons in labels):

```tsx
export function GamesSection({ games }: { games: { name: string; skillLevel?: string | null; rank?: string | null }[] });
export function HowIPlaySection({ platforms, playstyles }: { platforms: string[]; playstyles: string[] });
export function VibeSection({ vibe }: { vibe: import("@/features/swipe/types").DeckCard["vibe"] });
export function ShowsSection({ shows }: { shows: string[] });
export function PromptsSection({ prompts }: { prompts: { question: string; answer: string }[] });
export function MetaLine({ region, languages, playWindow }: { region?: string | null; languages?: string[] | null; playWindow?: string | null });
```

- [ ] **Step 1:** Implement: Games → wrap of `Chip label={name} detail={rank ?? skillLevel ?? undefined}`; HowIPlay → one wrap mixing platform Chips (default tone) and playstyle Chips (accent tone); Vibe → three read-only bars (track `colors.surfaceAlt`, fill `colors.accent`, `radius.round`, height 6) with end labels in `type.caption` muted + tilt sentence below; Shows → wrap of default Chips; Prompts → one glass `Card` per prompt: question `type.caption` in `colors.accentInk`, answer `type.quote`; MetaLine → single `type.caption` muted line joining non-null parts with ` · `.
- [ ] **Step 2:** Verify — typecheck + lint PASS (components compile standalone; call sites arrive in Tasks 16-17).
- [ ] **Step 3:** Commit — `git commit -m "Shared profile sections: one vocabulary for you and for strangers"`

### Task 16: Own profile rebuild

**Files:**
- Rewrite body of: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/src/features/profile/ProfileCompleteness.tsx`

- [ ] **Step 1:** Keep: banner photo + avatar + EditBadges + skeleton branch + scroll-fade backdrop + all data hooks. Replace the body:
  1. Identity block → `Card luminous`: `Name` in `type.cardName`, `"{age} · {region}"` caption, one primary `Button label="Edit profile"` → `/edit-details` (compact — wrap in a row so it doesn't span full width).
  2. `ProfileCompleteness` → single-line variant: thin progress bar (4px, `colors.accent` on `colors.surfaceAlt`) + one hint sentence; delete its hardcoded font sizes (use `type.caption`); still self-hides at 100%.
  3. Sections, in order, via Task 15 components: Prompts (keep its "Edit" link — prompts edit stays separate), Games, HowIPlay (platforms+playstyles merged), Vibe (NEW — was hidden from owner), `MetaLine` for play window (NEW), Voice intro player (NEW — reuse `VoiceIntroPlayer` with own-profile audio hook if one exists; if only a public-profile hook exists, add the own-audio fetch beside the existing pattern), Shows.
  4. Delete the local `DetailSection` helper and its four Edit links entirely.
- [ ] **Step 2:** Verify — typecheck + lint; open Profile tab: no per-section Edit links, vibe/schedule/voice visible, chips all one style.
- [ ] **Step 3:** Commit — `git commit -m "Rebuild own profile: one edit door, and you finally see what strangers see"`

### Task 17: Other-profile rebuild (ProfileDetailContent)

**Files:**
- Rewrite: `apps/mobile/src/features/swipe/ProfileDetailContent.tsx`
- Delete: `apps/mobile/src/features/swipe/SkillBadge.tsx` (after removing all imports of it)

**Interfaces:**
- `ProfileDetailContent` keeps its current props PLUS `readOnly?: boolean` (default false — Task 18 uses `readOnly` for the matched-profile route; it hides nothing today but reserves the seam; like/pass buttons were never inside this component).

- [ ] **Step 1:** Rebuild top-to-bottom: header photo (keep, scrim stays) → identity row (PresenceAvatar + name `type.cardName` + verified icon) → `MetaLine {region, languages, playWindow}` + verified-accounts caption → voice intro → `GamesSection` (from `topGames`) → `HowIPlaySection` (platforms — NEW, was never rendered — + playstyles) → `VibeSection` → Reputation as `Chip tone="success" label={tag} detail={"×" + count}` wrap under a `SectionLabel` → `ShowsSection` → `PromptsSection`. Every section labeled; zero bare unlabeled text lines except MetaLine.
- [ ] **Step 2:** Loading: render `Skeleton` rows for reputation/voice/linked-accounts while their hooks are pending (no pop-in).
- [ ] **Step 3:** Delete SkillBadge.tsx; fix any remaining importers (`grep -r "SkillBadge" apps/mobile/src`).
- [ ] **Step 4:** Verify — typecheck + lint; open a deck card's full profile.
- [ ] **Step 5:** Commit — `git commit -m "Rebuild the stranger profile on the shared sections; SkillBadge dies"`

### Task 18: Profile route from Matches/Chat

**Files:**
- Create: `apps/mobile/app/profile/[profileId].tsx`
- Create: `apps/mobile/src/features/profile/useProfileCard.ts`
- Modify: `apps/mobile/app/_layout.tsx` (register `profile/[profileId]` with `presentation: "modal"`)
- Read first: `src/features/swipe/useDeck.ts` (or wherever DB rows map → `DeckCard`) — export/reuse that mapper.

**Interfaces:**
- Produces: `useProfileCard(profileId: string)` → react-query `{ data: DeckCard | undefined, isPending, isError }`, query key `["profile-card", profileId]`; route `/profile/[profileId]` rendering `ProfileDetailContent card={data} readOnly` inside `ScreenContainer showClose`.

- [ ] **Step 1:** Find the deck's row→DeckCard mapping; extract/export it (do not duplicate the mapping). `useProfileCard` fetches the single profile from the same source the deck uses (public_profiles view / RPC) for one id and maps it.
- [ ] **Step 2:** Route file: skeleton while pending, `EmptyState` on error, else `ProfileDetailContent`. Register the Stack.Screen as modal in `_layout.tsx`.
- [ ] **Step 3:** Verify — typecheck + lint; deep-open `/profile/<a fake profile id>` in Expo.
- [ ] **Step 4:** Commit — `git commit -m "Profiles are reachable after you match"`

### Task 19: Matches rebuild

**Files:**
- Modify: `apps/mobile/app/(tabs)/matches.tsx` (MatchRow + row wiring; groupMatches/sections stay)

- [ ] **Step 1:** New `MatchRow`: 54px ROUND avatar — ring: 2px `colors.pink` + `glow(colors.glowPink, 10)` when `unread_count > 0`, else 1px `colors.border`; presence via existing data if present. Name `type.bodyStrong` (bold already — no extra unread styling on the name), timestamp `type.caption` muted, one preview line — bold (`type.bodyStrong`) when unread else `type.body` muted. The numeric unread badge is DELETED. Locked: one `Chip tone="solar" label="Locked"` trailing, and the preview shows the real last message (delete the "Locked — upgrade…" preview override).
- [ ] **Step 2:** Avatar becomes its own Pressable → `router.push(\`/profile/\${item.other_profile_id}\`)`; row body still opens chat.
- [ ] **Step 3:** Verify — typecheck + lint; matches list in Expo: unread = glowing ring + bold preview, nothing else.
- [ ] **Step 4:** Commit — `git commit -m "Calm the match rows: one unread signal, one locked signal, profiles a tap away"`

### Task 20: Chat rebuild

**Files:**
- Rewrite (in place, keeping all hooks/data flow): `apps/mobile/app/chat/[matchId].tsx`

- [ ] **Step 1: Sheets.** Rebuild ScheduleModal, FeedbackModal, and the `•••` overflow on `Sheet` (Task 7). Overflow grouping with `SectionLabel`s and Ionicons (18, `colors.textMuted`; danger rows `colors.danger`): "Play together" → Ping I'm free now (`flash`), Invite a third (`people`), Schedule a session (`calendar`), Share my Discord (`logo-discord`); "After the session" → Rate this session (`star`); "Safety" → Report (`flag`), Block (`ban`), Unmatch (`close-circle`) — safety group separated by `spacing.lg` and tinted `colors.danger`.
- [ ] **Step 2: Bubbles.** Mine: `LinearGradient {...heroGradient}` at `opacity 0.9` fill... implement as gradient bubble with `colors.onFill` text; theirs: glass (`colors.surface` + border). Radius 18 with the 6px tail corner (mine bottom-right, theirs bottom-left). Read/Sent stays `type.caption` muted. Hidden-word reveal + DiscordShareBubble: re-skin to glass/accent tokens.
- [ ] **Step 3: Composer.** Glass input (`radius.round`, `colors.surface`, border), send = 40px gradient circle (Ionicons `arrow-up`, `colors.onFill`, `glow(colors.glowViolet, 12)`, disabled → glass). Locked state → ONE compact solar `Card`: caption line + `Button variant="solar" label="Get DuoQueue+"`; delete the old paragraph block.
- [ ] **Step 4: Chrome.** Header name Pressable → `/profile/[other_profile_id]` (id is available from the match data hook). SessionBanner → glass `Card` with `colors.accent` left edge (2px inner view), Confirm/Decline as ghost `Button`s. Screen renders `AuroraBackground` + `GrainOverlay` behind the list (bespoke layout — not ScreenContainer).
- [ ] **Step 5:** Migrate every hand-rolled Pressable to `Button` where drop-in; all literals → tokens.
- [ ] **Step 6:** Verify — typecheck + lint; send a message, open every sheet, check locked state styling in Expo.
- [ ] **Step 7:** Commit — `git commit -m "Rebuild chat: one sheet chrome, grouped actions, gradient bubbles"`

### Task 21: Match moment

**Files:**
- Rewrite: `apps/mobile/app/match/[matchId].tsx`

- [ ] **Step 1:** Layout inside `ScreenContainer aurora="none"` (bespoke background): `AuroraBackground variant="match"` + `GrainOverlay`; two reanimated glow discs (Animated.View, `radius.round`, ~180px, bg `colors.glowPink` / `colors.glowViolet`, blur via opacity stacking) starting at translateX ∓90 and springing to 0 (`withSpring`, damping 14) while scaling 0.8→1 — merging behind the avatar. Avatar (route param photo) 160px with 3px `colors.pink` ring; if the CURRENT user's own avatar is cheaply available from the session store, render both photos side-by-overlap (48px offset); otherwise the single avatar + merged auras carries the idea (do not add a fetch for this).
  - Headline: `"It's a duo!"` in `type.screenTitle` (Unbounded), then `"You and {name} both queued up."` in `type.body` muted.
  - Buttons (from `Button`): primary "Send a message" → existing `router.replace` chat route; ghost "Keep swiping" → `router.back()`. Buttons render immediately (animation is non-blocking decoration; no skip gate needed).
  - All three hardcoded font sizes die; entrance staggers keep (FadeInDown works fine).
- [ ] **Step 2:** Verify — typecheck + lint; trigger via deck like → match in Expo (or temporarily navigate to the route with params).
- [ ] **Step 3:** Commit — `git commit -m "The match moment: two auras become one"`

### Task 22: Edit screens cleanup

**Files:**
- Modify: `apps/mobile/app/edit-details.tsx`, `apps/mobile/app/edit-prompts.tsx`

- [ ] **Step 1: edit-details.** Header → `ModalHeader`. The hand-rolled show-pills (lines ~246-265, `"#fff"` literals) → `Chip onPress` with a trailing `close` icon element. Vibe section un-nests: `SectionLabel "Vibe"` + the three Sliders directly in the scroll (no wrapping Card) + tilt `ChipSelect`. Game cards: keep per-game `Card`, but `flat` inside the list, skill `ChipSelect` + rank `TextField` stay. All inline `fontWeight/fontSize` → `type` scale. Save/Cancel → `ButtonRow`.
- [ ] **Step 2: edit-prompts.** Header → `ModalHeader`. The absolutely-positioned picker overlay → `Sheet` with the question list (rows: `type.body`, pressed `colors.surfaceAlt`, separators `colors.border`). Cards/textareas re-skin via tokens (mostly free from Phase 2).
- [ ] **Step 3:** Verify — typecheck + lint; edit a game, a show, a prompt in Expo.
- [ ] **Step 4:** Commit — `git commit -m "Tame the edit screens: one header, one chip, one sheet"`

---

## Phase 5 — Polish + verification

### Task 23: Light-mode pass + contrast check

**Files:** touched screens as found; possibly `tokens.ts` light values.

- [ ] **Step 1:** Flip to Light in Settings → Appearance. Walk: welcome, sign-in, deck, full profile, own profile, matches, chat (+ sheets), match moment, paywall, settings, edit screens. Fix washed-out/unreadable spots (usual suspects: glass alpha surfaces over white, glow opacities, gradient text contrast).
- [ ] **Step 2:** Contrast audit of the light+dark palette pairs actually used for text (script or manual WCAG calc): `text/textMuted` on `background/surface/surfaceSolid`; `onFill` on `brand`+hero mid-point; `onSolar` on solar mid-point; `brandInk/accentInk` on background; `danger/success/warning/info` where used as text. Required: ≥4.5:1 (normal text), ≥3:1 (18pt+/bold or non-text). Adjust token values, not call sites.
- [ ] **Step 3:** Verify — typecheck + lint; commit — `git commit -m "Daylight pass: light mode earns its keep"`

### Task 24: Shim deletion + grep gates + final verification

**Files:** `apps/mobile/src/theme/tokens.ts`, `useTheme.ts`, stragglers found by grep.

- [ ] **Step 1:** Grep gates — each must return ZERO hits in `apps/mobile` (fix stragglers, don't suppress):

```bash
grep -rn "Archivo\|Bungee\|MartianMono\|martian-mono" apps/mobile/src apps/mobile/app apps/mobile/package.json
grep -rn "shadowLifted\|pressedOffset" apps/mobile/src apps/mobile/app --include="*.tsx" --include="*.ts" | grep -v "theme/tokens.ts" | grep -v "theme/useTheme.ts"
grep -rn "foil" apps/mobile/src apps/mobile/app | grep -v "theme/"
grep -rn "type\.stat\|type\.micro\|type\.marquee" apps/mobile/src apps/mobile/app | grep -v "theme/tokens.ts"
grep -rn "SkillBadge" apps/mobile/src apps/mobile/app
```

- [ ] **Step 2:** Delete from tokens/useTheme: `shadow`, `shadowLifted`, `pressedOffset`, `foil`, the deprecated `type` aliases (`marquee/stat/statSm/micro`), `fonts` compat keys (`black/mono/monoBold/marquee`), `radius.pill`, and `colors.ink` IF `grep -rn "\.ink\b"` (excluding tokens) is clean — anything still referenced gets its call site fixed first. `hairline` may stay only if still used as a border-width token; otherwise delete.
- [ ] **Step 3:** Full verification: `pnpm typecheck && pnpm lint` (root, both packages) → PASS. Boot Expo: dark + light spot-check.
- [ ] **Step 4:** Commit — `git commit -m "Delete the Cartridge shims; Aurora stands alone"`
- [ ] **Step 5:** Report to Cameron for the manual Expo Go pass (spec §8): dark+light, the five reworked areas + deck.

---

## Self-review notes (done at write time)

- Spec coverage: §2 palette/type/shape → Tasks 2-3; §2.4 dark default → Task 4; §3 components → Tasks 5-9; §4 sweep → Tasks 10-14; §5.1-5.5 → Tasks 16, 17, 19, 20, 21; §6.1 → Task 22; §6.2 → Tasks 7+20+22; §6.3 → Task 18; §6.4 → Task 6; §7 kill-list + §8 gates → Task 24; §5.2 shared sections → Task 15; light mode → Task 23.
- Type consistency: `Chip{label,detail,icon,selected,tone,onPress}` used identically in Tasks 5, 15, 17, 19, 20, 22. `Sheet{visible,onClose,title}` in Tasks 7, 20, 22. `AuroraBackground{variant}` in Tasks 3, 10, 20, 21. `useProfileCard` only in Task 18. `glow(color,r?)` matches Task 2 signature everywhere.
- Known judgment calls recorded: tab bar is solid full-width (not floating pill) for keyboard/inset simplicity; InfoChip survives as deprecated wrapper until Task 24 grep proves it dead or migrated.
