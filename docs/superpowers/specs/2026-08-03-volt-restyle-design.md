# Volt Restyle — Design Spec

**Date:** 2026-08-03
**Status:** Approved by Cameron (visual companion, "Volt rev.2")
**Supersedes:** the Aurora visual identity (tokens + surface language only — Aurora's *structural* work all stays)

## Why

Cameron identified that Aurora's identity — dark violet `#14101F`, glass (white-alpha) surfaces, pink→violet hero gradient, glow-as-depth, pill-outlined chips — has become the canonical "AI-generated app" look and reads as AI slop to consumers. Diagnosis confirmed the offending elements are specifically: **the purple/pink colorway, the glass + glow treatment, and pill-shaped outlines**. Fonts (Unbounded + Manrope), film grain, layout, and motion were explicitly NOT flagged.

Four directions were mocked on the deck screen (Hardware / Editorial / Clubhouse / Acid Utility). Cameron chose **D — Acid Utility**, then approved the expanded system ("Volt") with one revision: no bright chartreuse fills in light mode.

## The Volt identity in one paragraph

Off-black with a faint green warmth. Solid panels separated by 1px seams — nothing translucent, nothing glowing. One interactive accent: volt chartreuse. Amber is money. IBM Plex Mono is the machine voice for metadata. Sharp corners (3/6/8/16), circles only for avatars and dots. Faint graticule grid + film grain for atmosphere. Unbounded still speaks names; Manrope still carries body text.

## Non-goals (unchanged)

- All layout/structure: bento profile, deck, matches rows, chat, standouts rail, gallery drag-reorder, sheets/modals, settings
- Motion timings and choreography (stagger cascades, parallax, overscroll pull) — re-skinned, not re-timed
- Fonts Unbounded + Manrope (Plex Mono is added, nothing removed)
- Film grain concept (opacity reduced; asset unchanged)
- Backend, DB, edge functions, RevenueCat — zero server-side changes
- Voice intros stay dormant/removed from UI

## Tokens — `apps/mobile/src/theme/tokens.ts`

### Dark ("Volt Dark", default scheme)

| Token | Value | Notes |
|---|---|---|
| background | `#0A0B09` | near-black, green-warm |
| surface | `#12140F` | solid card (replaces white-alpha glass) |
| surfaceAlt | `#1A1D15` | raised/input |
| surfaceSolid | `#12140F` | same as surface now (glass distinction gone) |
| border | `#232720` | 1px seams |
| text | `#EDF1E6` | |
| textMuted | `#98A18A` | |
| volt | `#CDFF3D` | THE accent (replaces brand/accent/pink/hero*) |
| voltDim | `#94BC2C` | pressed/secondary accent, "SENT" ticks |
| voltSoft | `rgba(205,255,61,0.10)` | soft fills ("2 in common") |
| onVolt | `#0A0B09` | text on volt fills |
| amber | `#FFB627` | money/premium ONLY (replaces solarA/B) |
| onAmber | `#201400` | |
| amberSoft | `rgba(255,182,39,0.12)` | Locked-chip fill family |
| danger | `#FF5A48` | "alarm" |
| dangerDark | `#D8321F` | fill variant (white text passes) |
| success | `#3FD68C` | |
| warning | `#FFB627` | merges with amber hue family |
| info | `#6EC8FF` | |
| onFill | `#FFFFFF` | |
| p1Line | `#CDFF3D` | you |
| p2Line | `#F2F6EA` | them (ink-white) |

Removed tokens: `heroA/heroB`, `pink`, `brand/brandInk/brandDark/brandSoft`, `accent/accentInk/accentSoft`, `solarA/solarB/onSolar`, all `glow*`. Removed helpers: `heroGradient()`, `solarGradient()`, `glow()`. `SCRIM_RGB` → `"6,8,4"`.

### Light ("Paper")

Rule: **inks fill, chartreuse marks.** Raw volt never appears larger than a chip; filled buttons use ink colors with paper-white text.

| Token | Value | Notes |
|---|---|---|
| background | `#F2F4EB` | engineering paper |
| surface | `#FFFFFF` | |
| surfaceAlt | `#E7EBDB` | |
| border | `#C9CFBB` | |
| text | `#161A0F` | |
| textMuted | `#5C6450` | |
| volt | `#4A6B00` | olive INK — the accent role on paper |
| voltDim | `#3B5600` | |
| voltSoft | `rgba(205,255,61,0.35)` | micro-fills, text must be `#2A3600`-class dark |
| onVolt | `#F7F9F0` | text on olive fills |
| voltRaw | `#CDFF3D` | small marks only (ticks/underlines); never a button fill |
| amber | `#8F5E00` | money ink |
| onAmber | `#FBF6EA` | |
| danger | `#C22E20` | |
| success | `#17784C` | |
| info | `#16688F` | |

(Dark scheme gets `voltRaw = volt` for API parity.)

Paper tokens not tabled above follow the same logic: `onFill #FFFFFF`, `dangerDark = danger` (parity, as Aurora), `warning = amber`, `successFill`/`warningFill` at ~0.14 alpha of their ink, `p1Line = volt` (olive), `p2Line = text` ink. The WCAG audit script is the authority on final values in both schemes.

### Categorical inks (word label always accompanies; re-hued to Volt family)

- overlap dark: none `#8A927E` · one `#93B45C` · two `#B7DD3F` · many `#FFB627`
- overlap light: none `#66705C` · one `#4E7018` · two `#5A7A00` · many `#8F5E00`
- playstyle dark: casual `#A8B096` · intermediate `#8FC46B` · competitive `#7FB7D9` · ranked_grinder `#E0A33E`
- playstyle light: casual `#5E6650` · intermediate `#3E6B1E` · competitive `#2F5E80` · ranked_grinder `#8A5E10`

All light-mode values are starting points; the scripted WCAG audit is the authority and may darken them.

### Shape

`radius`: chip 3 · sm 4 · input 6 · button 6 · window 8 · md 8 · card 8 · lg 8 · sheet 16 · round 999 (avatars + dots ONLY — no pill-shaped controls or chips anywhere).

### Type

- Add IBM Plex Mono (`@expo-google-fonts/ibm-plex-mono`, 500 + 600): new `fonts.mono`, `fonts.monoSemibold`.
- `type.label` moves from Manrope ExtraBold to Plex Mono 600, 10–11px, letterSpacing 1.2, uppercase — the machine voice.
- New `type.tick`: Plex Mono 500, 9px, letterSpacing 0.8 — timestamps, statuses (ONLINE, SENT), counters, index marks.
- Everything else (screenTitle/cardName/title/quote/body/bodyStrong/caption) unchanged.

### Motion

Timings unchanged (`instant/quick/base/deliberate`). Glow-pulse animations are replaced by opacity/border ticks at the same timings.

## Depth & emphasis rules (replaces glass + glow)

1. Panels are solid `surface` with 1px `border` seams. No translucency, no backdrop blur.
2. Emphasis channels, in order: 2px volt edge-bar → volt border → inverted (volt/amber) fill → mono tick label. Never glow, never shadow-as-accent.
3. Unread/attention: volt left edge-bar + 6px volt dot (replaces glow-ring).
4. Elevation (sheets/toasts): flat surface + seam + scrim behind; a plain black shadow at low opacity is allowed for separation on sheets only, never colored.

## Component treatments

- **Button**: primary = volt fill/onVolt (dark) · olive fill/onVolt (light); secondary = seam outline + textMuted; danger = alarm outline, `dangerDark` fill for confirm states; premium = amber fill (dark) / amber-ink fill (light). Radius 6. Size variants unchanged.
- **Chip** (games/vibes/prompts/filters): radius 3, Plex Mono uppercase 9.5–10px, 1px seam outline + `textMuted`-family ink. Shared/selected = volt border + volt text. Tonal variant (playstyle etc.) = `surfaceAlt` fill, categorical ink, no border. Locked = `amberSoft`-family fill `#241A06` + amber border `#3D2E0B` + amber text + mono "LOCKED". Soft-fill variant (overlap "N in common") = voltSoft fill, volt text (dark) / dark-olive text (light).
- **Tab bar**: solid `#0E100C` (dark) / surface (light), top seam; labels Plex Mono 8.5px; active = volt icon+label, inactive `#5E6654`. Active tab tile treatment (34×28 tile) becomes a volt underline bar instead.
- **Deck card**: solid surface, seam border, radius 8; mono index mark ("NO.0XX") top-right of photo; overlap line as mono `>> N GAMES IN COMMON` in volt.
- **Chat**: own bubble `#202817` solid; theirs `colors.surface` (`#12140F` shipped) + seam. No gradient fills. Timestamps/status in `type.tick` (voltDim for own "SENT/SENDING", textMuted for theirs). Spring-in entrance + haptics unchanged.
- **Match moment**: replaces merging aura discs — the matched profile's avatar slides in, volt brackets `[ ]` close around it, single volt flash, "DUO LOCKED" in mono, letterspaced. Same timings/haptics as current moment.
- **AuroraBackground → GraticuleBackground**: full-screen faint grid, 24px cell, 1px lines `rgba(205,255,61,0.03–0.04)` dark / `rgba(74,107,0,0.05)` light, plus sparse crosshair ticks at intersections (~0.06 alpha). Drift animation retired (static; grain supplies life). Same component API/placement so screens swap cleanly.
- **GrainOverlay**: kept, opacity reduced ~30%.
- **Toasts/banners**: solid surface + seam + 2px status-colored edge-bar (volt/success/alarm/amber).
- **Inputs**: surfaceAlt fill, seam border, radius 6; focus = volt border (olive on paper).
- **Standouts rail, gallery, sheets, settings, admin queue chips**: same rules applied; no per-component surprises. Initial-letter fallbacks: surfaceAlt circle + volt letter.
- **Empty states**: mono bracket motifs (`[ NO ONE IN QUEUE ]`) replace soft-glow art.

## App icon & splash

Regenerate via `scripts/generate-app-icons.mjs`: volt double-chevron "»" (queue-forward mark) on `#0A0B09`, subtle grain, no gradient. Splash matches. (The merging-auras icon is Aurora-era and reads slop-adjacent.)

## Verification

1. `pnpm typecheck` + `pnpm lint` green.
2. Re-run the scripted WCAG audit (the Aurora task-23 approach) over every text/fill pair in BOTH schemes; darken tokens as needed — audit output is the authority over the tables above. Known intentional exceptions: none. Endpoint rule from Aurora (gradient endpoints) is moot — no gradients remain.
3. Grep-verify zero remaining references: `heroGradient|solarGradient|glow\(|glowViolet|glowPink|glowSolar|heroA|heroB|solarA|brandSoft|accentInk` etc.
4. Manual device pass (dark + paper) by Cameron — same checklist style as Aurora's.

## Risks / notes

- Acid utility is the trendiest of the four directions; it will age faster than Hardware/Editorial. Accepted trade-off (Cameron picked it knowingly — noted on the option card).
- Chartreuse is unusable as a text color on paper; the "inks fill, chartreuse marks" rule is load-bearing for light mode. Any new light-mode component must follow it.
- `p2Line` near-white: check every place p1/p2 lines render on light backgrounds; on paper p2 becomes `#161A0F` ink.
- Plex Mono adds one font package; verify Expo font loading count/perf is fine (7 total faces → 9).
