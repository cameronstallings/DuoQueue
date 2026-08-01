# Aurora — full visual restyle + targeted UX simplification

**Date:** 2026-08-01
**Status:** Approved by Cameron (brainstorm session, visual companion)
**Replaces:** the "Cartridge" design system (`apps/mobile/src/theme/tokens.ts` and everything downstream)

## 1. Goal and scope

Cameron's verdict on Cartridge: "too much." Every part of it — the print/cardstock gimmick,
the heavy typography, the warm paper palette, the overall busyness — is retired. The
replacement is **Aurora**: a dark, atmospheric, cleaner gamer look ("Nebula" base, "Aurora
Grain" flavor — chosen over Slate and Carbon directions, then over Constellation and Arcade
Pop flavors). Explicit requirement: it must NOT read as a generic AI-built gradient app —
the signature layer (grain, aurora washes, disciplined glow, Unbounded display type) is
what buys that, and it is not optional.

In scope:

- Full reskin of every screen and component in `apps/mobile` (~40 routes).
- Structural simplification of exactly three areas (user-selected): **own profile +
  profile editing**, **other-user profile view**, **matches + chat**. The swipe deck and
  settings keep their current structure, restyled only.
- Dark becomes the **default** scheme; light mode survives as an option ("Daylight"
  treatment). System-follow remains available.

Out of scope: backend/schema changes, new features beyond the profile-access route noted
in §6.3, onboarding flow changes (reskin only), copy rewrites beyond what redesigned
layouts require.

## 2. Design language

### 2.1 Palette

Dark (default):

| Token | Value | Notes |
|---|---|---|
| `background` | `#14101F` | deep violet-black |
| `surface` | `rgba(255,255,255,0.06)` | "glass" — translucent so aurora washes read through |
| `surfaceSolid` | `#1C1728` | for contexts where translucency stacks badly (modals over modals) |
| `surfaceAlt` | `rgba(255,255,255,0.10)` | pressed/hover glass |
| `border` | `rgba(255,255,255,0.09)` | 1px hairlines on glass |
| `text` | `#F0ECF7` | |
| `textMuted` | `#9C92B8` | |
| `heroA → heroB` | `#FF6EC7 → #8B5CF6` | THE gradient. Primary buttons, active tab glow, own chat bubble, match moment. Nothing else. |
| `accent` | `#A78BFA` | flat violet for links, section labels, selected chip tint |
| `pink` | `#FF6EC7` | sparing highlights (unread glow) |
| `solarA → solarB` | `#FFD98A → #FF9D5C` | premium ONLY (paywall, Power-Up, DuoQueue+, Standouts). Gold ≠ brand, so paid never blurs into brand. |
| `success` | `#4ADE9C` | also presence/"online" glow |
| `danger` | `#FF5C7A` | |
| `warning` | `#FFC864` | |
| `info` | `#7FD4FF` | |
| `onFill` | `#FFFFFF` | text on hero gradient |
| `onSolar` | `#4A2A00` | text on solar gradient |

Light ("Daylight"): lavender-tinted, same hue system, accents darkened for contrast —
`background #F7F4FC`, `surface #FFFFFF`, `border rgba(76,58,130,0.14)`, `text #241A3D`,
`textMuted #6E6390`, hero `#E0479E → #7C3AED`, accent `#7C3AED`, solar text-safe pair.
All text/background pairs must clear WCAG 4.5:1; non-text meaningful elements 3:1.
Overlap/playstyle categorical ink sets are re-derived in Aurora hues at matched
luminance (same anti-rarity-ladder rationale as Cartridge — that logic survives, the
colors change).

### 2.2 Typography

Two families replace Cartridge's four (Archivo, Martian Mono, Bungee die):

- **Unbounded** (`@expo-google-fonts/unbounded`) — 600/700. ONLY for: screen titles,
  person names on cards/profiles, the match moment, the logo wordmark. Wide and gamey;
  sizes run smaller than normal (title 22, cardName 18).
- **Manrope** (`@expo-google-fonts/manrope`) — 500/600/700/800. Everything else.

Scale (approximate, tune in implementation): `screenTitle` Unbounded600 22/28 ·
`cardName` Unbounded600 18/24 · `title` Manrope800 17/23 · `body` Manrope500 15/22 ·
`bodyStrong` Manrope700 15/21 · `caption` Manrope600 13/18 · `label` Manrope800 11/14
+0.09em uppercase (the ONLY uppercase style; used sparingly for section labels).
`fontWeight` never set alongside a named fontFamily (Android bold-synthesis rule — keep
this Cartridge learning).

### 2.3 Shape, depth, texture

- Radii: `chip` 999 (pill returns), `input` 14, `button` 16, `card` 20, `sheet` 28,
  `round` 999.
- **No keylines, no offset plates.** `shadow()`/`shadowLifted()`/`pressedOffset` are
  deleted. Depth channels: (a) glass surface vs background, (b) **glow** —
  colored soft shadow (`boxShadow` blur, zero offset) reserved for meaning: active tab,
  primary button, online presence, unread. Nothing else glows.
- **Luminous edge**: 1px pink→violet gradient border. Hero surfaces only: deck card,
  match sheet, own-profile header card. Implemented as a gradient wrapper view with 1px
  padding.
- **Grain**: `GrainOverlay` — a tiled noise PNG (generated asset, ~128px, transparent)
  at ~4–6% opacity, `pointerEvents="none"`, rendered by `ScreenContainer` over the
  aurora background, under content. Every screen gets it.
- **Aurora washes**: `AuroraBackground` — two soft radial blobs (react-native-svg
  `RadialGradient`; add dependency via `expo install react-native-svg` if absent):
  violet top-left, pink bottom-right, fixed positions. Variants: `default`,
  `match` (blobs animate toward merge), `solar` (gold, paywall only). Background layer
  only; content never sits inside a gradient.
- Motion: springy but quick — `motion` tokens stay numeric (90/140/200/260 can remain);
  press feedback becomes scale 0.97 + glow dim (replacing pressedOffset). Match moment
  is the one long animation (~1.5s, skippable by tap).

### 2.4 Theme architecture

`useTheme()` keeps its shape (screens keep destructuring `colors, spacing, radius,
type…`) with these changes: `shadow`/`shadowLifted`/`pressedOffset`/`foil`/`hairline`
replaced by `glow(color)` helper + `heroGradient`/`solarGradient` descriptors +
`luminousEdge` colors. `foil` is deleted; premium surfaces use solar. Default preference
in `store/theme-store` flips from `"light"`-biased fallback to **dark**: `system`
resolves `null → "dark"`, and the stored default preference becomes `"dark"` for
existing users (one-time migration of the persisted value is acceptable and desired —
Cameron wants dark by default).

## 3. Component system

One idiom per job, shared everywhere:

- **`Chip`** (rebuilt `InfoChip`/`ChipSelect` pair): pill glass chip; selected =
  violet tint + 1px accent border + soft glow; semantic re-tints (online green,
  standout solar). Supports icon and an inline `detail` slot — a game's skill level
  renders inside the same chip ("Valorant · Diamond"), killing `SkillBadge` and the
  reputation-pill one-off (reputation pills become Chips with count detail).
- **`Button`**: primary = hero gradient fill + glow; secondary = glass; ghost = text
  only; solar = premium gold. Press = scale+glow-dim. All hand-rolled Pressable
  buttons in chat/edit screens migrate to `Button`.
- **`Card`**: glass, radius 20, optional `luminous` prop for the gradient edge.
  `flat` prop keeps meaning (no glass, for dense lists).
- **`Sheet`** (NEW, `src/components/Sheet.tsx`): one bottom-sheet chrome — scrim,
  radius-28 top, grab handle, safe-area — replacing the three hand-rolled sheet
  chromes in chat plus edit-prompts' hand-rolled overlay picker.
- **`SectionLabel`**: Manrope800 11 uppercase in `accent`, no rule line.
- **Tab bar**: floating glass bar, active tab = hero-gradient icon tile + glow
  (per the approved mockup).
- **`EmptyState`**: keyline-square iconography replaced with a soft glow orb.
- **`Skeleton`**: stays the loading idiom; shimmer tint moves to violet-on-glass.
- **`ScreenContainer`**: becomes the standard wrapper on ALL screens (today only the
  match screen uses it) and renders AuroraBackground + GrainOverlay + safe areas.
  The three screens that hand-roll `insets.top` status-bar patches stop doing so.
- **Logo/wordmark**: redrawn in Unbounded (text-based is fine); Bungee dies.

## 4. Screen sweep (reskin only)

Every route under `apps/mobile/app/` gets the Aurora pass: token/component swap, remove
hardcoded `fontSize`/`fontWeight`/`#fff`/`borderRadius` literals found in the audit
(worst offenders: chat, match moment, edit screens, ProfileCompleteness). The deck
(swipe) screen and settings screens keep their structure. The deck card becomes the
luminous-edge hero surface; LIKE/PASS stamps, quota meter, action buttons re-skin to
Aurora (LIKE = hero gradient, PASS = glass).

## 5. Structural simplifications (approved scope)

### 5.1 Own profile (`(tabs)/profile.tsx`)

Problems (from audit): four identical `DetailSection` headers with four "Edit" links all
routing to the same screen (+ a fifth for prompts); ~21 bordered icon chips; vibe /
play window / voice intro are editable but never shown to their owner.

Redesign:

- Header: banner + avatar keep, but the identity block becomes a luminous-edge card:
  name (Unbounded), age·region, and **one** "Edit profile" button → `/edit-details`;
  prompts keep their own edit route via their section.
- Completeness: ring around the avatar (replaces the bar module) + a single missing-item
  hint line; still self-hides at 100%.
- Body sections built from the SAME components strangers see (§5.2): Games (unified
  chips with skill detail), Platforms + Playstyle merged into one "How I play" section
  (chips), Shows, **Vibe** (the three axes, read-only), **Schedule** (play window),
  **Voice intro** (player), Prompts (glass cards). One `SectionLabel` each, no icons,
  no per-section Edit links, no rules between sections — spacing does the separation.

### 5.2 Other-user profile (`ProfileDetailContent`)

Problems: four badge idioms in one scroll; five bare unlabeled text lines; own vs
other profile render the same data with disjoint component sets; platforms never shown.

Redesign: rebuild on shared section components used by §5.1 (extract
`src/features/profile/sections/*` used by both). Labeled sections in this order:
identity row (avatar+name+presence+verified) → meta line (region · languages ·
play window) → voice intro → Games → How I play (platforms+playstyles) → Vibe →
Reputation (chips w/ counts) → Shows → Prompts. All chips are `Chip`; loading gets a
skeleton state instead of pop-in.

### 5.3 Matches (`(tabs)/matches.tsx`)

- Rows: presence-ringed round avatar (glass ring; pink glow ring = unread), name,
  one preview line, timestamp. **Unread = glow ring + bold preview only** (numeric
  badge dies). **Locked = single small solar lock chip**, preview text stays the real
  last message (the duplicated "Locked —" preview dies).
- Sections stay (New / Your turn / Their turn) with `SectionLabel`s.
- Row tap → chat (unchanged); avatar tap → profile (§6.3).

### 5.4 Chat (`chat/[matchId].tsx`)

- All three hand-rolled sheets (Schedule, Feedback, overflow) rebuild on `Sheet`;
  edit-prompts' overlay picker also moves to `Sheet` (it's in the same repair family).
- The `•••` sheet: grouped + iconized — "Play together" (Ping now / Invite a third /
  Schedule / Share Discord), "After the session" (Rate), "Safety" (Report / Block /
  Unmatch, danger-tinted, separated).
- Composer: glass input + hero-gradient round send button (`Button` internals);
  locked state becomes one compact solar banner with a single upgrade CTA.
- Bubbles: mine = hero gradient at 85% opacity, theirs = glass; radius 18 with 6px
  tail corner; read/sent stays a micro-caption. Header name becomes tappable →
  profile (§6.3).
- Session banner restyles to a glass card with accent edge; hidden-word reveal and
  Discord share bubble reskin only.

### 5.5 Match moment (`match/[matchId].tsx`)

"It's a duo!" — AuroraBackground `match` variant: pink blob (you) and violet blob
(them) drift together and merge behind the two avatars; Unbounded headline; primary
"Send a message" (hero) + ghost "Keep swiping". Skippable by tap. Uses the type scale
(no hardcoded sizes).

## 6. Cross-cutting fixes riding along

1. **Edit-details** (part of "profile edit" scope): keep single modal route, but
   sections get uniform `SectionLabel` headers, the hand-rolled show-pills become
   `Chip`s, inline typography literals move to the scale, and the Vibe card un-nests
   (sliders sit directly in the section). No new routes.
2. **Shared modal/sheet chrome** everywhere via `Sheet` (kills 4 hand-rolled chromes).
3. **Profile access from Matches/Chat** (approved gap-fix): a lightweight route/modal
   presenting `ProfileDetailContent` for a matched user, opened from match-row avatar
   and chat header name. Read-only (no like/pass buttons in this context).
4. Duplicated hand-rolled modal headers (edit-details, edit-prompts) become one
   `ModalHeader` component.

## 7. What dies (checklist)

Keylines/`hairline` borders as an idiom · offset plate shadows + `pressedOffset` ·
`foil` gradient · Bungee, Archivo, Martian Mono · uppercase-tracked labels outside
`label` · numeric unread badges · `SkillBadge` · reputation pill one-off · four-Edit
profile header pattern · hand-rolled sheet chromes · "gradient = money" rule (now:
hero gradient = brand's one move; solar = money).

## 8. Verification

- `pnpm typecheck` and `pnpm lint` green.
- Grep-gates: no `Archivo|Bungee|MartianMono` imports; no `pressedOffset|shadowLifted|foil` references; no new `#fff`/`fontWeight` literals in screens (excluding tokens).
- Contrast spot-check of the final palette pairs (dark + light) against WCAG 4.5:1 / 3:1.
- Manual Expo Go pass by Cameron (dark + light, the five reworked areas + deck).

## 9. Rollout

Single branch (`ui-overhaul`), phased commits: (1) tokens+fonts+infra, (2) components,
(3) screen sweep, (4) structural work, (5) light-mode polish + verification. The app
must build and run after each phase — during the sweep, temporary compat shims in
tokens (e.g. `shadow()` returning `{}`) are acceptable between phases 1 and 3 so
unmigrated screens keep compiling, and are deleted by phase 5.
