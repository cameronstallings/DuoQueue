# Remotion Video Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended)
> or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** A local, one-command generator that produces 3 distinct MP4s per day plus per-platform
captions and cover frames into a dated folder, in the real Volt identity, per section 2 of
`docs/superpowers/specs/2026-08-18-launch-marketing-design.md`.

**Architecture:** A standalone (deliberately non-workspace) Remotion project at `marketing/video/`.
It imports the app's real `tokens.ts` and a newly extracted logo-geometry module so the palette,
type scale and brand mark have one source of truth, and it faithfully ports the four app components
it needs (Chip, Card, SectionLabel, EmptyState idiom) to DOM because those cannot be imported. One
`Post` composition takes a discriminated-union `Hook` as props and switches to one of four format
components; `calculateMetadata` derives duration from the hook. A batch script picks the day's three
hooks off a queue with format rotation, bundles once, and renders MP4 + cover PNG + captions.md +
manifest.json.

**Tech stack:** Remotion 4 (React 19, TypeScript, its own Rust compositor for decode/encode),
`@remotion/fonts`, `@remotion/layout-utils`, tsx. No ffmpeg on PATH is required and none is added.

---

## What was verified before writing this (read this before you disagree with anything below)

These were checked against the actual repo and machine on 2026-08-18. Several of them contradict
the spec's optimism, and two of them will silently damage the repo if you get them wrong.

1. **`pnpm install` inside a non-workspace subdirectory of this repo installs the ROOT workspace and
   nothing local.** Probed with a throwaway `package.json` at `.tmp-probe/video/`: pnpm walked up,
   found `pnpm-workspace.yaml`, printed `Scope: all 3 workspace projects`, and mutated the root
   `node_modules` (`+20 -98`). A local `.npmrc` containing `ignore-workspace=true` did **not**
   prevent it. Adding `--ignore-workspace` as a CLI flag **did**: it created a local `node_modules`
   and a local `pnpm-lock.yaml` and left the root alone. Every install/add in `marketing/video` must
   carry that flag. It is encoded in root scripts in Task 1 so it cannot be forgotten.
   (Root `pnpm-lock.yaml` was verified unchanged afterward, and `pnpm typecheck`, `pnpm lint` and
   `pnpm audit:contrast` were all re-run green. Baseline: contrast audit reports
   `PASS - all 56 pair-checks`.)
2. **With `--ignore-workspace`, corepack stopped honoring the root `packageManager` pin** and ran
   pnpm 11.15.1 instead of the pinned 10.33.0. Fix: `marketing/video/package.json` carries its own
   `"packageManager": "pnpm@10.33.0"`.
3. **`pnpm --dir <non-member-dir> run <script>` works from the repo root**, with cwd set to that
   directory. Verified. This is how the one-command entry point works.
4. **`apps/mobile/src/theme/tokens.ts` is importable by a browser bundle as-is.** Its only
   react-native reference is `import type { TextStyle } from "react-native"`, which esbuild erases.
   Nothing else in the file imports anything. This is the single most useful fact in the plan: the
   video palette, radii, spacing, motion timings and type scale are literally the app's, not a copy,
   and `pnpm audit:contrast` (which parses that file's source text with regexes, not by importing
   it) keeps governing them.
5. **`apps/mobile/src/components/Logo.tsx` is NOT importable.** It imports `react-native`,
   `react-native-svg`, and `@/theme/useTheme`, which pulls `useColorScheme` from react-native and a
   zustand store. `react-native-web` is not installed anywhere in this repo (checked). See "Spec
   correction 1" below.
6. **The brand mark geometry already exists in three places** and they agree numerically:
   `Logo.tsx`, `scripts/generate-app-icons.mjs` (`ringGeometry`/`ringsMark`), and precomputed
   literals baked into `site/index.html` by `scripts/build-site.mjs` (cx 660.992, r 215.04,
   stroke-width 98.9184, nub cx 842.425508224487). A fourth copy is not acceptable; Task 4 extracts
   one module and Logo.tsx consumes it.
7. **CI is `.github/workflows/security.yml`**: on every push it runs `pnpm install --frozen-lockfile`,
   `pnpm audit --audit-level high`, `pnpm typecheck`, `pnpm lint`. This is the decisive reason the
   Remotion project stays out of the workspace (see Decision 1).
8. **`.npmrc` sets `node-linker=hoisted`**, so every workspace dependency lands in one flat root
   `node_modules` that Metro resolves from.
9. **Fonts are on disk** at `node_modules/@expo-google-fonts/{ibm-plex-mono,manrope,unbounded}/<weight>/<Name>.ttf`,
   e.g. `unbounded/700Bold/Unbounded_700Bold.ttf` (371 KB). `apps/mobile/assets/noise.png` (14 KB)
   is the film-grain tile.
10. **No ffmpeg on PATH** (confirmed). No puppeteer or playwright in the repo either.
11. **There is no App Store URL anywhere in the repo.** The app is approved but unreleased, so the
    numeric App Store id does not exist yet. The post-release CTA therefore cannot be hardcoded now;
    see Decision 6.

---

## Spec corrections

**Correction 1: "It can import the app's real code ... `Logo.tsx`, the Volt tokens, the actual Chip
and Card components" is half true, and the half that is false must not be attempted.**

`tokens.ts` imports cleanly (fact 4). Everything else does not:

| File | Blocking imports |
| --- | --- |
| `Logo.tsx` | `react-native`, `react-native-svg`, `@/theme/useTheme` -> zustand store |
| `Chip.tsx` | `react-native` (`Pressable`, `StyleSheet`, `Text`, `View`), `useTheme` |
| `Card.tsx` | `react-native` (`View`), `useTheme` |
| `EmptyState.tsx` | `react-native`, `@expo/vector-icons` (Ionicons, its own icon font) |
| `SwipeCard.tsx` | plus `expo-image`, `expo-linear-gradient`, `react-native-gesture-handler`, `react-native-reanimated` |

Making these run in Remotion's Chromium means adding `react-native-web` plus a web build of
`react-native-svg`, plus shims for expo-image, expo-linear-gradient, reanimated, gesture-handler and
the Ionicons font. Because `.npmrc` sets `node-linker=hoisted`, those packages would land in the
same flat `node_modules` Metro resolves from, for an app that was approved by Apple yesterday and is
one button press from release. That trade is not worth making for a marketing tool.

**What is done instead**, which preserves the actual goal (the videos use the real palette, the real
mark, the real type scale) at a fraction of the risk:

- `tokens.ts` is imported directly. Zero duplication of colors, radii, spacing, motion, type.
- The logo geometry is extracted to `apps/mobile/src/theme/logo-geometry.ts`, a file with no
  imports at all. `Logo.tsx` consumes it (a mechanical refactor, verified numerically), and the
  video project's DOM `<Mark/>` consumes the same module. The mark is provably identical, not
  imitated.
- Chip, Card, SectionLabel and the `[ TICK ]` bracket idiom are ported to DOM. Each is 20 to 40
  lines, each carries a header comment naming the app file it mirrors, and each takes its values
  from the imported tokens rather than from literals. Nothing in the video project may contain a hex
  color.

Update the spec's section 2 wording if it is ever revised. The pitch for Remotion over ffmpeg still
holds; the "same components" claim needs to become "same tokens, same mark geometry, ported
components".

**Correction 2: "Bundles ffmpeg" needs a caveat.** Remotion 4 replaced the bundled ffmpeg binary
with its own Rust compositor. It still encodes H.264/AAC and decodes HEVC/MOV without ffmpeg on
PATH, which is what the spec actually needs, but do not plan on invoking an ffmpeg CLI through
Remotion. Any transcoding must happen through a Remotion render (Task 9 provides one).

**Correction 3: Remotion's license is not unconditionally free.** It is free for individuals and for
companies of 3 people or fewer. Cameron is solo, so this is fine today, and it is the only reason
this satisfies the spec's "no paid tooling" constraint. If DuoQueue ever becomes a company with 4 or
more people, a company license is required. Recorded here so it is not a surprise later.

**Correction 4: the spec is silent on audio, and audio is a real decision.** See Decision 7.

---

## Decisions the spec left open

**Decision 1: the project lives at `marketing/video/`, outside the pnpm workspace.**

`pnpm-workspace.yaml` globs `apps/*` and `packages/*`, so `marketing/video` is not a member and root
`pnpm install`, `pnpm -r`, and CI never see it.

Why not `apps/video` or `packages/video`:

- CI (`security.yml`) would install Remotion's platform binaries on Ubuntu on every push, in three
  separate jobs, to typecheck a marketing tool.
- `pnpm audit --audit-level high` gates that CI. It would start covering Remotion's transitive tree
  (webpack, babel, and friends). A moderate-to-high advisory in a local-only render tool would then
  block product work on a shipping iOS app. That is a bad coupling to create on purpose.
- `node-linker=hoisted` means Remotion, webpack, react-dom and a second React tree land in the flat
  root `node_modules` that Metro resolves from.

The cost is real and is paid explicitly: `pnpm typecheck` and `pnpm lint` from the root do **not**
cover video code. So `marketing/video` gets its own `verify` script (tsc + eslint + content
validation) that must be green before any commit touching it, and the root gets thin passthrough
scripts so there is still one command to type.

Why `marketing/video/` and not `video/`: the spec has three more workstreams that produce local
tooling (daily reminder, measurement queries, waitlist). `marketing/` is the namespace for
launch tooling; `marketing/video/` is this one's room in it. It does not claim the namespace or
create anything the other workstreams must adopt.

**Decision 2: footage lives in `marketing/video/public/footage/`, gitignored, and is cut by a
manifest rather than by a video editor.**

Remotion's `staticFile()` resolves from the project's `public/` directory, so that is where the
files have to be. They are gitignored because a 60-second screen recording plus 4 minutes of
gameplay is hundreds of megabytes and git is the wrong place for it.

Cameron drops files in with fixed names. `src/data/clips.ts` names in and out points into those
files, so one 60-second recording becomes eight named clips (`deck-swipe`, `deck-swipe-slow`,
`match-moment`, `chat-tonight`, ...) without any cutting. `<OffthreadVideo trimBefore/trimAfter>`
does the trimming at render time. This matters more than it looks: it means re-recording the app
footage later only requires re-checking the timecodes in one file, not re-editing anything.

`<OffthreadVideo>` and not `<Video>`: iPhone screen recordings are HEVC in a `.mov` container, which
Chromium's `<video>` element will not decode. `<OffthreadVideo>` extracts frames through Remotion's
own compositor, which will.

**Decision 3: hooks are authored as a typed array in `src/data/hooks.ts`, one object per video.**

Adding a video is appending an object; there is no other step. The array is a discriminated union on
`format`, so TypeScript tells Cameron exactly which fields a `pain` hook needs versus a `spec` one,
and `pnpm validate` enforces the rules a type cannot (uniqueness, em dashes, dating language, line
budgets, clip existence). Captions are authored as one line per hook and expanded per platform by a
shared template in `src/config/captions.ts`, so a new video costs one caption line, not three.

**Decision 4: one command is `pnpm video:day` from the repo root.**

It shells into the project (`pnpm --dir marketing/video render-day`, verified working in fact 3).
Everything else (bundle, selection, rotation, ledger, MP4s, covers, captions, manifest) happens
inside that one script.

**Decision 5: the day's three come off a ledger with format rotation, not from the date.**

`state/rendered.json` (committed, tiny) records which hook ids have shipped and where the format
cycle stands. Selection walks the cycle `reframe -> pain -> spec -> demo`, taking the lowest-index
unrendered hook of each format and refusing to put two of the same format in one day. If a first
pass cannot fill three slots it does a second pass ignoring the same-format rule and prints a
warning, because failing to produce videos on posting day is worse than a slightly repetitive day.
If it still cannot fill three, it fails loudly and tells Cameron to add hooks. Rationale for
date-derived selection being rejected: it silently re-renders or skips when a day is missed, and
days will be missed.

`demo` sits last in the cycle deliberately. The spec calls it "lowest reach, highest intent", so it
should appear roughly once per four videos rather than a quarter of every day.

**Decision 6: the post-release CTA is a configured string, and rendering with it unset is a hard
error.**

There is no App Store URL in the repo (fact 11) because the app has not been released. So
`src/config/phase.ts` reads `PHASE` (`waitlist` | `launched`, default `waitlist`) and, when
`launched`, requires `APP_STORE_URL` in `marketing/video/.env`. If it is missing or does not look
like an App Store link, `render-day` aborts before bundling. Rendering three videos with a wrong or
placeholder URL burned into the end card is the expensive failure here, so it fails early and loudly
instead.

The end card shows the URL as text in IBM Plex Mono, not Apple's "Download on the App Store" badge.
Two reasons: the badge is Apple's artwork with its own usage guidelines and would have to be
downloaded from Apple's Marketing Resources and committed, and a foreign badge inside a Volt frame
looks like a foreign badge inside a Volt frame.

**Decision 7: every rendered video is silent, with a silent audio track present.**

`renderMedia({ muted: true, enforceAudioTrack: true })`. Gameplay B-roll carries game music and
in-game voice, which is a copyright and a moderation problem on all three platforms. Muting removes
it. `enforceAudioTrack` keeps a valid AAC track in the container, because a video with no audio
stream at all occasionally trips upload validators. Cameron adds trending audio in the Instagram or
TikTok composer at upload time, which is both free and better for reach than anything that could be
baked in.

**Decision 8: 1080x1920 at 30fps, H.264.**

30 and not 60 because frame extraction from footage is the dominant render cost and 60 doubles it
for no benefit on a feed video. Safe area is `top 260 / bottom 520 / sides 96` in composition
pixels, sized for TikTok's right rail and caption block, which is the most intrusive of the three.
A `SafeArea` dev overlay renders those bounds when `DEV_GUIDES=1`.

**Decision 9: the video type scale is the app's scale times `1080 / 393`, except for hook lines.**

`393` is the iPhone logical width the app is designed against, so `S = 2.748` maps app chrome
one-to-one: a `type.chipText` chip on video is exactly the size it is in the app relative to the
screen. Hook lines are the deliberate exception. `type.screenTitle` at 22pt scales to 60px, which is
correct for a subtitle and far too small for a thumb-stopping hook, so hooks use their own display
scale (hero 108 / sub 64 / item 52 at 1080 wide) and are auto-fit with `fitText` from
`@remotion/layout-utils` so a long line shrinks instead of overflowing. This is the one place the
video departs from the app scale, and it is on purpose.

---

## Global constraints

- Spec is the authority: `docs/superpowers/specs/2026-08-18-launch-marketing-design.md`.
- **No hex colors, no font-family strings, no radii and no spacing literals anywhere under
  `marketing/video/src`.** Everything comes from the imported `tokens.ts`. This is checkable and is
  checked (Task 12).
- No em dash (U+2014) in any string that reaches a rendered frame, a caption file, a manifest, or
  the console. En dashes in numeric ranges are fine, matching commit 4cec21b. Enforced by
  `pnpm validate`.
- No copy anywhere may imply dating. Enforced by `pnpm validate` with a rule that permits the banned
  terms only inside a denial (see Task 5), because "no this isn't a dating app" is the single
  strongest hook in the spec and must remain sayable.
- `marketing/video/src` may never import `react-native`, `react-native-svg`, `@expo/vector-icons`,
  `expo-*`, or anything under `apps/mobile/src` other than `theme/tokens.ts` and
  `theme/logo-geometry.ts`. Enforced by eslint `no-restricted-imports` (Task 1).
- Every `pnpm install` or `pnpm add` inside `marketing/video` carries `--ignore-workspace`. See fact 1.
- After any task that touches `apps/mobile/` (only Task 4 does): `pnpm typecheck && pnpm lint &&
  pnpm audit:contrast` from the repo root, all green, before committing.
- After any task that touches `marketing/video/`: `pnpm video:verify` green before committing.
- Root `pnpm-lock.yaml` must be byte-identical at the end of this plan as at the start.
  `git diff --stat pnpm-lock.yaml` is empty.
- All `@remotion/*` packages and `remotion` must sit at the identical version. Remotion errors at
  runtime if they drift. `pnpm --dir marketing/video exec remotion versions` is the check.
- Do not touch: the database, edge functions, `apps/mobile/app/**`, `scripts/build-site.mjs`,
  `scripts/generate-app-icons.mjs`, `site/`, or `.github/workflows/`.

## Cameron's one-time inputs (start these first, they have human latency)

- [ ] **One clean 60-second screen recording of the app.** iPhone, portrait, screen recording via
  Control Center. Cover, in this order, pausing about 2 seconds on each: the deck with two or three
  swipes, a match moment, opening a chat, typing and sending "when are you on tonight", and the
  profile. Do not rush; the manifest cuts it later. Save as
  `marketing/video/public/footage/app-60s.mov`.
- [ ] **3 to 4 minutes of gameplay B-roll**, portrait or landscape (landscape gets center-cropped),
  showing solo queue going badly: a lost round, a teammate leaving, an empty comms moment. Save as
  `marketing/video/public/footage/broll-gameplay.mp4`.
- [ ] **First-run network step:** the first render downloads Chrome Headless Shell (roughly 150 MB)
  into Remotion's cache. Run `pnpm --dir marketing/video exec remotion browser ensure` once,
  deliberately, so it does not surprise you mid-render.

The pipeline is buildable and testable before any of this exists: missing clips render as a labelled
placeholder panel (Task 6), and the `spec` format needs no footage at all.

---

### Task 1: Scaffold the standalone project

**Files:**
- Create: `marketing/video/package.json`
- Create: `marketing/video/.npmrc`
- Create: `marketing/video/tsconfig.json`
- Create: `marketing/video/types/react-native.d.ts`
- Create: `marketing/video/eslint.config.mjs`
- Create: `marketing/video/README.md`
- Modify: `.gitignore` (append a marketing/video block)
- Modify: `package.json` (root: add four passthrough scripts)

**Interfaces produced:** the root scripts `video:install`, `video:studio`, `video:day`,
`video:verify`. Every later task assumes these exist.

- [ ] **Step 1: create the directory skeleton**

```
marketing/video/
  public/            (fonts/ and footage/ are generated or supplied, both gitignored)
  src/
    components/
    formats/
    data/
    config/
    lib/
  scripts/
  state/
  types/
```

- [ ] **Step 2: `marketing/video/package.json`**

```json
{
  "name": "@duoqueue/video",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "packageManager": "pnpm@10.33.0",
  "scripts": {
    "studio": "remotion studio src/index.ts",
    "render-day": "tsx scripts/render-day.ts",
    "stills": "tsx scripts/render-stills.ts",
    "assets:sync": "tsx scripts/sync-assets.ts",
    "validate": "tsx scripts/validate-content.ts",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "verify": "pnpm typecheck && pnpm lint && pnpm validate"
  }
}
```

The `packageManager` pin is not optional. Without it, `--ignore-workspace` caused corepack to fall
through to a different pnpm major (fact 2).

- [ ] **Step 3: `marketing/video/.npmrc`**

```
# This project is deliberately NOT a pnpm workspace member (see the plan's Decision 1).
# node-linker=hoisted matches the repo root so webpack resolution behaves the same way.
# NOTE: ignore-workspace does NOT work from this file. It must be passed as a CLI flag:
#   pnpm install --ignore-workspace
# Without the flag, pnpm walks up, finds pnpm-workspace.yaml, and reinstalls the ROOT
# workspace instead, installing nothing here. Verified 2026-08-18.
node-linker=hoisted
```

- [ ] **Step 4: `marketing/video/types/react-native.d.ts`**

`tokens.ts` has exactly one external reference, `import type { TextStyle } from "react-native"`.
Rather than let TypeScript resolve that by walking up into the root `node_modules` (an invisible
dependency on the app's install being present), declare the minimum locally and map it:

```ts
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
```

- [ ] **Step 5: `marketing/video/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "react-native": ["./types/react-native.d.ts"],
      "@app/*": ["../../apps/mobile/src/*"],
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "scripts", "types", "remotion.config.ts"]
}
```

Extending the repo's `tsconfig.base.json` is intentional: the video project holds the same
`strict` + `noUncheckedIndexedAccess` bar as the app. `lib` and `jsx` are overridden because the
base has no DOM.

- [ ] **Step 6: `marketing/video/eslint.config.mjs`**

Flat config, `typescript-eslint` recommended, plus the guard that keeps the bundle clean:

```js
{
  rules: {
    "no-restricted-imports": ["error", {
      patterns: [
        { group: ["react-native", "react-native/*", "react-native-svg", "@expo/vector-icons", "expo-*"],
          message: "The video project renders in Chromium. See Spec correction 1 in the plan." },
        { group: ["@app/*", "!@app/theme/tokens", "!@app/theme/logo-geometry"],
          message: "Only tokens.ts and logo-geometry.ts may be imported from the app." },
      ],
    }],
  },
}
```

- [ ] **Step 7: append to root `.gitignore`**

```
# Remotion video pipeline (marketing/video) - generated or supplied, never committed
marketing/video/out/
marketing/video/public/fonts/
marketing/video/public/footage/
marketing/video/public/noise.png
marketing/video/.env
```

`node_modules/` is already covered by the existing bare pattern. `marketing/video/state/` is
deliberately NOT ignored; the ledger is committed.

- [ ] **Step 8: add root passthrough scripts to `package.json`**

```json
"video:install": "pnpm --dir marketing/video install --ignore-workspace",
"video:studio":  "pnpm --dir marketing/video studio",
"video:day":     "pnpm --dir marketing/video render-day",
"video:verify":  "pnpm --dir marketing/video verify"
```

These are inert with respect to `pnpm -r`, which only runs scripts in workspace members.

**Verify before moving on:**
1. `git status --porcelain` shows only the intended new and modified files.
2. `git diff --stat pnpm-lock.yaml` is empty.
3. `pnpm typecheck && pnpm lint && pnpm audit:contrast` from the root, all green, contrast still
   reports 56 pair-checks passing.

---

### Task 2: Install Remotion and prove one frame renders

**Files:**
- Create: `marketing/video/src/index.ts`, `src/Root.tsx`, `src/compositions/Smoke.tsx`
- Create: `marketing/video/remotion.config.ts`
- Create: `marketing/video/src/lib/webpack-override.ts`
- Generated: `marketing/video/pnpm-lock.yaml`

- [ ] **Step 1: install**

```
pnpm video:install
pnpm --dir marketing/video add --ignore-workspace remotion @remotion/cli @remotion/bundler @remotion/renderer @remotion/fonts @remotion/layout-utils
pnpm --dir marketing/video add --ignore-workspace react@19.1.0 react-dom@19.1.0
pnpm --dir marketing/video add --ignore-workspace -D typescript@~5.9.3 tsx@^4.19.2 @types/node@^22 @types/react@~19.1.17 @types/react-dom@~19.1.0 eslint@^9 typescript-eslint@^8
```

React is pinned to 19.1.0 to match `apps/mobile` exactly, so there is never a question about which
React the two trees are on.

Expected: a new `marketing/video/pnpm-lock.yaml` and `marketing/video/node_modules`.
**Immediately check `git diff --stat pnpm-lock.yaml` at the root is still empty.** If it is not, the
`--ignore-workspace` flag was dropped from one of these commands; `git checkout pnpm-lock.yaml`,
re-run `pnpm install` at the root, and redo the step.

- [ ] **Step 2: `src/lib/webpack-override.ts`**

The webpack override must live in its own module because `remotion.config.ts` is read **only by the
CLI and Studio**, never by programmatic renders. The batch script passes the same function to
`bundle({ webpackOverride })`. Getting this wrong produces the classic symptom of "works in Studio,
fails in the render".

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { WebpackOverrideFn } from "@remotion/bundler";

const dir = path.dirname(fileURLToPath(import.meta.url));

/** Mirrors the `paths` entries in tsconfig.json. tsconfig paths are a typecheck-time
 * concept; webpack needs to be told separately or the alias resolves at compile time and
 * fails at bundle time. */
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      "@app": path.resolve(dir, "../../../../apps/mobile/src"),
      "@": path.resolve(dir, ".."),
    },
  },
});
```

Note the four `..` segments: this file compiles from `src/lib/`, so the app source is four levels up.
Assert it rather than trusting it (Step 5).

- [ ] **Step 3: `remotion.config.ts`**

```ts
import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./src/lib/webpack-override";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(90);
Config.setCodec("h264");
Config.overrideWebpackConfig(webpackOverride);
```

- [ ] **Step 4: a smoke composition**

`src/compositions/Smoke.tsx` renders `<AbsoluteFill>` filled with `darkColors.background`
imported from `@app/theme/tokens`, and one centered `<div>` in `darkColors.volt`. Register it in
`Root.tsx` at 1080x1920, 30fps, 60 frames. `src/index.ts` is `registerRoot(RemotionRoot)`.

- [ ] **Step 5: render it**

```
pnpm --dir marketing/video exec remotion browser ensure
pnpm --dir marketing/video exec remotion render src/index.ts Smoke out/_smoke.mp4
```

**Verify before moving on:**
1. `pnpm --dir marketing/video exec remotion versions` reports every `@remotion/*` package on one
   identical version.
2. `out/_smoke.mp4` exists, is 2 seconds, and is 1080x1920.
3. The frame is `#0A0B09` with a `#CDFF3D` block. If those colors are right, the `@app` alias and
   the type-only-erasure of react-native both work, which is the whole load-bearing assumption of
   this plan. If webpack instead reports it cannot resolve `@app/theme/tokens`, fix the `..` depth
   in Step 2 before continuing.
4. Root `pnpm-lock.yaml` still unchanged.

---

### Task 3: Fonts and grain

**Files:**
- Create: `marketing/video/scripts/sync-assets.ts`
- Create: `marketing/video/src/lib/fonts.ts`

- [ ] **Step 1: `scripts/sync-assets.ts`**

Copies from the repo's existing `node_modules` into `public/`, creating directories as needed, and
prints what it copied:

| Source | Destination |
| --- | --- |
| `node_modules/@expo-google-fonts/unbounded/700Bold/Unbounded_700Bold.ttf` | `public/fonts/` |
| `node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf` | `public/fonts/` |
| `node_modules/@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf` | `public/fonts/` |
| `node_modules/@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf` | `public/fonts/` |
| `node_modules/@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf` | `public/fonts/` |
| `apps/mobile/assets/noise.png` | `public/noise.png` |

Five faces, roughly 1.2 MB, which is why they are copied on demand and gitignored rather than
committed. The script resolves the repo root by walking up until it finds `pnpm-workspace.yaml`, so
it does not care where it is invoked from. It exits non-zero with the exact missing path if a source
file is absent (which means the root `pnpm install` has not been run).

- [ ] **Step 2: `src/lib/fonts.ts`**

```ts
import { loadFont } from "@remotion/fonts";
import { staticFile, delayRender, continueRender } from "remotion";
import { fonts } from "@app/theme/tokens";

// Family names are the token values verbatim ("Unbounded_700Bold", "IBMPlexMono_500Medium", ...)
// so a component can write `fontFamily: fonts.mono` and get the same string the app uses.
```

Load all five with `loadFont({ family, url: staticFile("fonts/<file>.ttf"), weight, style })`, wrap
the combined promise in `delayRender()` / `continueRender()` at module scope, and export a
`FONT_FAMILY` map keyed by the `fonts` token names. Every component imports from here.

The `delayRender` wrapper is what stops Remotion from capturing frames before the faces are ready. A
render that produces the right layout in the wrong typeface almost always means this was skipped.

- [ ] **Step 3: prove it**

Extend the Smoke composition temporarily with one line in each of the five faces, render a still,
and compare against the app: `pnpm --dir marketing/video exec remotion still src/index.ts Smoke out/_fonts.png`.

**Verify before moving on:** the still shows five visibly distinct faces, Unbounded is the wide
geometric one and IBM Plex Mono is monospaced. A fallback sans in any row means the font load
silently failed; check the browser console in `pnpm video:studio` for the actual URL that 404'd.

---

### Task 4: The brand bridge (this task touches the app)

The only task that modifies `apps/mobile/`. Keep it mechanical and verify numerically.

**Files:**
- Create: `apps/mobile/src/theme/logo-geometry.ts`
- Modify: `apps/mobile/src/components/Logo.tsx`
- Create: `marketing/video/src/components/Mark.tsx`
- Create: `marketing/video/src/components/Lockup.tsx`
- Create: `marketing/video/src/lib/scale.ts`
- Create: `marketing/video/src/components/{Chip,Card,SectionLabel,Tick}.tsx`

- [ ] **Step 1: extract `apps/mobile/src/theme/logo-geometry.ts`**

Move, verbatim, the module-level constants currently at `Logo.tsx:22-55`: `CANVAS`, `R`, `W`, `D`,
`NUDGE`, `CY`, `CXA`, `CXB`, `NUB_DIST`, `NUB`, `SEG_S`, `SEG_E`, `SEG_PATH`, `PAD`, `VB_X`, `VB_Y`,
`VB_W`, `VB_H`, `LOGO_MARK_ASPECT`, and the `mix()` helper. Export all of them. The file must have
**zero imports** so both a React Native tree and a browser bundle can use it. Carry the existing
explanatory comments across unchanged, and add a header noting the three other places the same
geometry appears (`scripts/generate-app-icons.mjs`, the literals `scripts/build-site.mjs` bakes into
`site/index.html`, and now the video project's `Mark.tsx`).

- [ ] **Step 2: rewire `Logo.tsx`**

Replace the moved block with `import { ... } from "@/theme/logo-geometry";` and re-export
`LOGO_MARK_ASPECT` from there so the existing public surface is unchanged. Nothing else in
`Logo.tsx` changes. Seven files import `Logo`; none import anything else from it (verified:
`app/(auth)/{age-gate,confirm-email,sign-in,sign-up}.tsx`, `app/paywall.tsx`, `app/welcome.tsx`,
`app/_layout.tsx`).

- [ ] **Step 3: assert the geometry did not move**

These are the values the current code computes. Check the extracted module against them:

```
R      215.04
W      98.9184
D      322.56
CXA    338.432
CXB    660.992
CY     512
NUB    { cx: 842.425508224487, cy: 693.433508224487, r: 55.394304000000005 }
VB_X   69.93280000000001
VB_Y   243.50080000000003
VB_W   859.5583999999999
VB_H   536.9984
LOGO_MARK_ASPECT  0.624737539648266
SEG_PATH  "M 583.6133027625533 712.6358363150401 A 215.04 215.04 0 0 1 452.25814711396214 563.6950699714191"
```

`CXA`, `CXB`, `R`, `W` and the NUB values also match the literals already baked into
`site/index.html` lines 130 to 132, which is independent corroboration.

Run: `pnpm --dir marketing/video exec tsx -e "import * as g from '../../apps/mobile/src/theme/logo-geometry'; console.log(JSON.stringify(g,null,1))"`
and diff by eye against the table.

- [ ] **Step 4: root gates**

`pnpm typecheck && pnpm lint && pnpm audit:contrast`. All three green, contrast still 56 of 56.
This is the checkpoint that proves the app was not disturbed. Commit here, separately from the
video work, so the app-side change is revertible on its own.

- [ ] **Step 5: `src/lib/scale.ts`**

```ts
export const VIDEO_W = 1080;
export const VIDEO_H = 1920;
export const FPS = 30;
/** iPhone logical width the app is designed against. App chrome multiplied by this is the
 * same size on video, relative to the frame, as it is on a phone. */
const APP_W = 393;
export const S = VIDEO_W / APP_W;               // 2.7481
export const px = (n: number) => Math.round(n * S);
/** Hook lines are the deliberate exception to the app scale. See Decision 9. */
export const display = { hero: 108, sub: 64, item: 52 } as const;
export const SAFE = { top: 260, bottom: 520, side: 96 } as const;
```

- [ ] **Step 6: `Mark.tsx` and `Lockup.tsx`**

`Mark.tsx` is the DOM twin of `LogoMark`: the same four SVG elements in the same order (Q circle,
nub, O circle, the repainted crossing segment), same viewBox, colors from
`darkColors.text` / `mix(text, background, 0.58)` using the extracted `mix`. `Lockup.tsx` stacks the
mark over the wordmark, wordmark in `fonts.displayBold` with the same `fontSize = width * 0.145` and
`letterSpacing = fontSize * 0.02` ratios `Logo.tsx` uses.

- [ ] **Step 7: port the four primitives**

`Chip.tsx`, `Card.tsx`, `SectionLabel.tsx`, `Tick.tsx` (the `[ STATUS ]` bracket idiom lifted from
`EmptyState.tsx`). Each gets a header comment: `/** DOM port of apps/mobile/src/components/X.tsx.
Keep in sync. Values come from tokens; no literals. */`. Chip keeps the tone union
(`default | volt | success | amber | danger | soft`), `radius.chip` (3), `borderWidth: 1`,
`type.chipText` and the same padding arithmetic (`spacing.xs + 1` / `spacing.sm + 1`), all through
`px()`. Drop the interaction props; a video has no press states.

**Verify before moving on:** render a `BrandSheet` still showing the mark at three sizes, the
lockup, one chip of each tone, a card, a section label and a tick. Open
`apps/mobile` in Expo alongside it and compare. The mark must be pixel-identical in shape; the
chips must match in weight and letterspacing.

---

### Task 5: Content model, data files, and the validator

**Files:**
- Create: `marketing/video/src/data/hooks.ts`, `src/data/clips.ts`
- Create: `marketing/video/src/config/{phase.ts,captions.ts}`
- Create: `marketing/video/src/types.ts`
- Create: `marketing/video/scripts/validate-content.ts`
- Create: `marketing/video/.env.example`

- [ ] **Step 1: `src/types.ts`**

```ts
export type Format = "reframe" | "pain" | "demo" | "spec";
export type ClipName = keyof typeof import("./data/clips").clips;

interface HookBase {
  /** kebab, `<format>-<3 digits>`, permanent: the ledger keys off it. */
  id: string;
  /** Seconds. calculateMetadata turns this into durationInFrames. */
  seconds: number;
  /** One line. The per-platform captions are expanded from it. */
  caption: string;
  /** Rare per-platform override. */
  captionOverrides?: Partial<Record<"instagram" | "tiktok" | "youtube", string>>;
}

export interface ReframeHook extends HookBase { format: "reframe"; clip: ClipName; beatOne: string; beatTwo: string }
export interface PainHook    extends HookBase { format: "pain";    clip: ClipName; lines: string[] }
export interface DemoHook    extends HookBase { format: "demo";    steps: { clip: ClipName; label: string }[] }
export interface SpecHook    extends HookBase { format: "spec";    title: string; items: string[] }
export type Hook = ReframeHook | PainHook | DemoHook | SpecHook;
```

The union is the whole authoring ergonomic: typing `format: "pain"` makes the editor demand `lines`
and `clip` and refuse `items`.

- [ ] **Step 2: `src/data/clips.ts`**

```ts
export const clips = {
  "deck-swipe":    { file: "app-60s.mov", from: 2.0,  to: 7.5 },
  "deck-swipe-slow": { file: "app-60s.mov", from: 7.5, to: 12.0 },
  "match-moment":  { file: "app-60s.mov", from: 14.0, to: 18.5 },
  "chat-open":     { file: "app-60s.mov", from: 20.0, to: 24.0 },
  "chat-tonight":  { file: "app-60s.mov", from: 24.0, to: 29.5 },
  "profile":       { file: "app-60s.mov", from: 31.0, to: 35.0 },
  "broll-loss":    { file: "broll-gameplay.mp4", from: 12.0, to: 20.0 },
  "broll-quiet":   { file: "broll-gameplay.mp4", from: 45.0, to: 53.0 },
  "broll-teamfight": { file: "broll-gameplay.mp4", from: 88.0, to: 96.0 },
} as const;
```

Timecodes are placeholders until Cameron's recording exists. Correcting them is Task 9 and is the
only place they live.

- [ ] **Step 3: `src/data/hooks.ts`**

Seed the queue with at least 24 hooks, which is eight days of posting, weighted
`reframe 7 / pain 7 / spec 7 / demo 3` to match the cycle. Seed content comes from the spec's own
examples and the site's approved language (`site/index.html` line 146: "It's platonic, not dating.
You're matching on games, schedules, and vibe"). Examples:

```ts
{ id: "reframe-001", format: "reframe", seconds: 9, clip: "deck-swipe",
  beatOne: "no this isn't a dating app",
  beatTwo: "it's for finding people to actually play with",
  caption: "swiping, but for your next duo" },

{ id: "pain-001", format: "pain", seconds: 8, clip: "broll-quiet",
  lines: ["your duo quit the game", "3 months ago", "you still queue alone"],
  caption: "solo queue is a choice you stopped making on purpose" },

{ id: "spec-001", format: "spec", seconds: 11, title: "what this is",
  items: ["match on games, not looks", "18+ only", "no gender filters", "platonic, not dating"],
  caption: "the whole pitch in four lines" },

{ id: "demo-001", format: "demo", seconds: 15,
  steps: [{ clip: "deck-swipe", label: "01 / DECK" }, { clip: "match-moment", label: "02 / MATCH" },
          { clip: "chat-tonight", label: "03 / CHAT" }],
  caption: "fifteen seconds of the whole thing" },
```

- [ ] **Step 4: `src/config/phase.ts`**

```ts
export type Phase = "waitlist" | "launched";
export const PHASE: Phase = (process.env.PHASE as Phase) ?? "waitlist";
export const CTA = {
  waitlist: { line: "join the waitlist", url: "duoqueue.io" },
  launched: { line: "free on the App Store", url: process.env.APP_STORE_URL ?? "" },
} as const;
```

Plus `assertPhaseConfigured()` which throws when `PHASE === "launched"` and `APP_STORE_URL` is
empty or does not start with `https://apps.apple.com/`. `render-day` calls it before bundling
(Decision 6). Because the composition itself runs in the browser and cannot read `process.env`, the
resolved CTA object is passed into the composition as part of `inputProps`, never read at render
time inside a component.

`.env.example` documents both variables and is committed; `.env` is gitignored.

- [ ] **Step 5: `src/config/captions.ts`**

One template per platform, expanding a hook's single `caption` line:

- Instagram: caption line, blank line, CTA line with the phase URL, blank line, 5 hashtags.
- TikTok: caption line, CTA, 4 hashtags inline.
- YouTube: `title` derived from the caption line, hard-truncated to 100 characters at a word
  boundary; `description` is caption + CTA + hashtags.

Hashtags are a constant in this file, so retuning them is one edit and never a per-hook chore.

- [ ] **Step 6: `scripts/validate-content.ts`**

Exit non-zero, listing every violation with hook id and field:

1. `id` matches `^(reframe|pain|demo|spec)-\d{3}$`, unique, and its prefix matches its `format`.
2. No U+2014 in any string field on any hook, in the caption templates, or in the CTA strings.
3. Dating guard: if a field matches `/\b(dating|date night|hookup|hook ?up|romantic|romance|flirt|singles)\b/i`
   then that same string must also match `/\b(not|no|isn'?t|never)\b/i`. "no this isn't a dating
   app" passes; "meet singles" fails. This encodes the actual requirement, which is that the word
   may only ever appear inside a denial.
4. Every `ClipName` referenced exists in `clips.ts`, and every clip's `to` is greater than its `from`.
5. `seconds` is between 6 and 20 for reframe/pain/spec and between 12 and 20 for demo.
6. Soft warning when a hook line exceeds 28 characters, since it will be shrunk by `fitText` and may
   get small. Warning, not error: `fitText` handles it correctly and the budget is a taste guide.
7. Every clip file referenced by a hook exists under `public/footage/`. **Warning** for reframe,
   pain and spec (they render a placeholder). **Error** for demo, which is nothing but footage.

**Verify before moving on:** `pnpm --dir marketing/video validate` passes on the seed data. Then
temporarily add a hook with `"meet singles tonight"` and confirm it fails with a readable message,
and one with an em dash and confirm the same. Remove both.

---

### Task 6: Shared video furniture

**Files:**
- Create: `marketing/video/src/components/{Stage,HookLine,EndCard,Clip,SafeArea}.tsx`

- [ ] **Step 1: `Stage.tsx`** wraps every format: `<AbsoluteFill>` at
  `darkColors.background`, the graticule (a DOM port of `GraticuleBackground.tsx`: a 24px grid of
  `rgba(205,255,61,0.035)` hairlines with 96px crosshair ticks, expressed as two repeating CSS
  `linear-gradient`/`radial-gradient` layers rather than an SVG pattern, since CSS is cheaper per
  frame), then `public/noise.png` tiled with `background-repeat: repeat` at `opacity: 0.035`, then
  children. Scale both patterns by `S` so a 24px app grid is a 66px video grid and reads at the same
  density.

- [ ] **Step 2: `HookLine.tsx`** renders one line of hook text. Props: `text`, `size`
  (`hero | sub | item`), `tone` (`ink | volt`), `delayFrames`. Uses `fitText` from
  `@remotion/layout-utils` against `VIDEO_W - SAFE.side * 2` to pick the largest size at or below the
  requested one that fits, then animates in with `spring({ fps, frame: frame - delayFrames,
  config: { damping: 200 } })` driving `translateY` from `px(12)` and opacity from 0.
  No glow, no blur, no scale bounce. The app's `motion` tokens set the timing feel:
  `motion.base` (200ms) is 6 frames at 30fps, so `durationInFrames: 6` on the spring.

- [ ] **Step 3: `EndCard.tsx`** is the shared ending for all four formats. Full-bleed `Stage`,
  `Lockup` at `width: 420`, then the phase CTA line in `fonts.bold` at `display.sub`, then the URL
  in `fonts.monoSemibold` at `px(type.label.fontSize)` with `letterSpacing: 1.2 * S`, uppercase, in
  `darkColors.volt`. Below it a `Tick` reading `[ 18+ / IOS / US ]`. It takes the resolved CTA as a
  prop; it never reads `process.env`. Duration: 2.5 seconds, which is the last 75 frames of every
  composition.

- [ ] **Step 4: `Clip.tsx`** wraps `<OffthreadVideo>`:

```tsx
<OffthreadVideo
  src={staticFile(`footage/${clip.file}`)}
  trimBefore={Math.round(clip.from * FPS)}
  trimAfter={Math.round(clip.to * FPS)}
  muted
  style={{ width: "100%", height: "100%", objectFit: "cover" }}
/>
```

`trimBefore`/`trimAfter` are the current prop names; older Remotion calls them `startFrom`/`endAt`.
If the installed version rejects them, use the older pair, and note it in the file.

When the file is missing from `public/footage/`, render a placeholder instead: a `surfaceAlt` panel
with a `Tick` reading `[ MISSING CLIP ]` and the clip name in mono. This is what makes the whole
pipeline testable before Cameron records anything, and it makes a missing file obvious in the output
rather than a black rectangle.

Every `Clip` gets a scrim over it so overlay text stays legible: a bottom-weighted linear gradient
from `rgba(6,8,4,0)` to `rgba(6,8,4,0.82)`, using the `SCRIM_RGB` token (`6,8,4`, the green-black,
not pure black) exported by `tokens.ts`.

- [ ] **Step 5: `SafeArea.tsx`** draws the `SAFE` bounds as 1px volt hairlines when
`process.env.DEV_GUIDES === "1"` and renders null otherwise. Bundled but inert in real renders.

**Verify:** a still of `EndCard` in both phases (`PHASE=waitlist` and `PHASE=launched
APP_STORE_URL=https://apps.apple.com/us/app/id0000000000`) shows the two different CTAs and nothing
else changes.

---

### Task 7: The four formats

**Files:**
- Create: `marketing/video/src/formats/{Reframe,Pain,Demo,Spec}.tsx`

Each takes its own hook type and composes Task 6's pieces. All four end with `<EndCard>` in the
final 75 frames.

- [ ] **Step 1: `Reframe.tsx`** Full-bleed `Clip` for the whole body. `beatOne` enters at frame 12
  in `display.hero`, holds, then at 40% of the body duration it cuts to `beatTwo` with a hard swap
  (no crossfade: the surprise is the point and a dissolve softens it). A `Tick` reading
  `[ NOT WHAT YOU THINK ]` sits above `beatOne`. Text block bottom-anchored above `SAFE.bottom`.

- [ ] **Step 2: `Pain.tsx`** Full-bleed `Clip` of gameplay B-roll. `lines` reveal one at a time,
  stacked and staggered by 18 frames, previous lines dimming to `textMuted` as the next arrives, so
  the whole list is readable at the end. Left-aligned inside the safe box.

- [ ] **Step 3: `Demo.tsx`** A `<Series>` of the hook's `steps`, each an equal share of the body
  duration, each a `Clip` with its mono `label` pinned top-left under `SAFE.top` in a `Chip` with
  `tone="volt"`. A 4-frame hard cut between steps. No captions over the footage; the app's own UI is
  the message.

- [ ] **Step 4: `Spec.tsx`** No footage. `Stage`, `SectionLabel` with the hook's `title`, then the
  `items` as rows: each is a `Tick` bracket index (`[ 01 ]`, `[ 02 ]`) in `voltDim` plus the item
  text in `fonts.bold` at `display.item`, staggered 14 frames, each with a 1px `border` seam above it
  in `darkColors.border`. This is the format that must look most like the app, because it is pure
  interface with no footage to carry it.

**Verify:** `pnpm --dir marketing/video stills` (Task 12 adds the script; a manual `remotion still`
per format is fine for now) produces one PNG per format at the midpoint. Check: no text crosses the
`SAFE` bounds with `DEV_GUIDES=1`, no hex literal anywhere in `src/formats/`, and the spec-list card
is indistinguishable in styling from a screenshot of the app's settings list.

---

### Task 8: The single composition

**Files:**
- Create: `marketing/video/src/compositions/Post.tsx`
- Modify: `marketing/video/src/Root.tsx`
- Delete: `marketing/video/src/compositions/Smoke.tsx`

- [ ] **Step 1: `Post.tsx`** takes `{ hook: Hook; cta: Cta }`, switches on `hook.format`, and
  renders the matching format component. This is the spec's "one composition plus an array of hook
  objects renders the whole queue", literally.

- [ ] **Step 2: register it** in `Root.tsx`:

```tsx
<Composition
  id="Post"
  component={Post}
  width={VIDEO_W} height={VIDEO_H} fps={FPS}
  durationInFrames={300}
  defaultProps={{ hook: hooks[0]!, cta: CTA.waitlist }}
  calculateMetadata={({ props }) => ({
    durationInFrames: Math.round(props.hook.seconds * FPS) + END_CARD_FRAMES,
  })}
/>
```

`calculateMetadata` is what makes per-hook durations work without a composition per length.
`END_CARD_FRAMES` is 75.

- [ ] **Step 3: register four preview compositions** (`Preview-Reframe`, `Preview-Pain`,
  `Preview-Demo`, `Preview-Spec`), each the same component with `defaultProps` pointing at a
  representative hook. These exist only so Studio has clickable entries and Cameron never has to
  hand-type props while iterating. They are excluded from batch rendering by their `Preview-` prefix.

**Verify:** `pnpm video:studio` opens, all five compositions are listed, each preview scrubs without
errors, and the timeline length differs per hook (proving `calculateMetadata` fires).

---

### Task 9: Footage intake

**Files:**
- Modify: `marketing/video/src/data/clips.ts` (real timecodes)
- Create: `marketing/video/src/compositions/Normalize.tsx` (fallback only)
- Modify: `marketing/video/README.md`

- [ ] **Step 1:** put Cameron's two files in `public/footage/` under the exact names in `clips.ts`.

- [ ] **Step 2: find the real timecodes.** In `pnpm video:studio`, open `Preview-Demo` and scrub;
  the timeline shows the footage frame by frame. Read the in and out points off it and write seconds
  into `clips.ts`. Prefer clips of 4 to 8 seconds; a clip shorter than its slot loops, which looks
  wrong.

- [ ] **Step 3: verify decoding.** If Studio shows black frames or the render errors on the `.mov`,
  the HEVC path is the suspect. Fallback: `Normalize.tsx` is a composition that renders one source
  file through `OffthreadVideo` at 1080x1920 with `objectFit: cover`, rendered to
  `public/footage/<name>-normalized.mp4` via `remotion render`. That transcodes to H.264 using
  Remotion's own compositor, with no ffmpeg on PATH. Point `clips.ts` at the normalized file and
  carry on. It is a fallback, not the default, because it costs an extra encode of everything.

- [ ] **Step 4: document the intake** in the README: file names, what to record, and the fact that
  re-recording only requires re-checking timecodes in one file.

**Verify:** `pnpm --dir marketing/video validate` reports zero missing-clip warnings, and a
`Preview-Demo` still shows real app UI rather than the `[ MISSING CLIP ]` placeholder.

---

### Task 10: The daily batch

**Files:**
- Create: `marketing/video/scripts/render-day.ts`
- Create: `marketing/video/src/lib/{select.ts,ledger.ts}`
- Create: `marketing/video/state/rendered.json` (committed, seeded `{"renderedIds":[],"cyclePos":0}`)

- [ ] **Step 1: `src/lib/select.ts`** implements Decision 5:

```
FORMAT_CYCLE = ["reframe", "pain", "spec", "demo"]

pass 1: walk the cycle from ledger.cyclePos, at most 40 steps.
        take the lowest-index hook of that format that is not in renderedIds
        and whose format is not already picked today. stop at 3.
pass 2: if fewer than 3, repeat allowing repeat formats, and warn.
fail:   if still fewer than 3, exit 1 with the per-format remaining counts and
        "add hooks to src/data/hooks.ts".
```

Returns the picks and the advanced `cyclePos`. Pure function, no I/O, so it is trivially checkable
by calling it with a synthetic ledger.

- [ ] **Step 2: `src/lib/ledger.ts`** reads and writes `state/rendered.json`. It only writes after
  every render in the batch has succeeded, so a crash halfway does not consume hooks. Two-space JSON
  with a trailing newline so its diffs stay readable.

- [ ] **Step 3: `scripts/render-day.ts`**

Flags: `--date YYYY-MM-DD` (default today, local time), `--count N` (default 3), `--only <id>`
(re-render a single hook, does not touch the ledger), `--dry-run` (print the plan and exit),
`--force` (overwrite an existing day folder).

Order of operations, each failing before anything expensive happens:

1. `assertPhaseConfigured()`.
2. Run the same validation as `pnpm validate`; abort on any error.
3. Ensure `public/fonts/` and `public/noise.png` exist; run `sync-assets` automatically if not.
4. Select the day's hooks. Abort if any picked `demo` hook has missing footage.
5. Refuse to overwrite an existing `out/<date>/` unless `--force`.
6. `bundle({ entryPoint: "src/index.ts", webpackOverride })` **once** for the whole batch. This is
   the expensive step, roughly 30 to 60 seconds cold, and doing it once instead of three times is
   the main reason this is a script rather than three CLI calls.
7. Per hook: `selectComposition({ serveUrl, id: "Post", inputProps })` then
   `renderMedia({ serveUrl, composition, codec: "h264", outputLocation, inputProps, muted: true,
   enforceAudioTrack: true, jpegQuality: 90, concurrency: 4, onProgress })`, then `renderStill` at
   the composition's frame 20 for the cover.
8. Write `captions.md` and `manifest.json`.
9. Commit the ledger update.
10. Print the output folder path and a one-line summary per video.

Output layout:

```
marketing/video/out/2026-08-19/
  01-reframe-001.mp4
  01-reframe-001-cover.png
  02-pain-004.mp4
  02-pain-004-cover.png
  03-spec-002.mp4
  03-spec-002-cover.png
  captions.md
  manifest.json
```

The numeric prefix is posting order, not hook identity, so the folder sorts the way Cameron works
through it.

- [ ] **Step 4: `manifest.json`** is the machine-readable contract the daily-reminder workstream
  (spec section 3) consumes. Keep it stable:

```json
{
  "date": "2026-08-19",
  "phase": "waitlist",
  "generatedAt": "2026-08-19T09:02:11.000Z",
  "videos": [
    { "slot": 1, "id": "reframe-001", "format": "reframe",
      "file": "01-reframe-001.mp4", "cover": "01-reframe-001-cover.png",
      "seconds": 11.5, "caption": "swiping, but for your next duo" }
  ]
}
```

**Verify:** `pnpm video:day --dry-run` prints three picks of three different formats. Then
`pnpm video:day` produces the folder above. Play each MP4: 1080x1920, correct duration, silent, end
card correct for the phase. Run `pnpm video:day` a second time on the same date: it must refuse
without `--force`. Run it with `--date` set to tomorrow: it must pick three **different** hooks,
proving the ledger works.

---

### Task 11: Captions

**Files:**
- Create: `marketing/video/src/lib/captions.ts`

- [ ] **Step 1:** expand each picked hook through the Task 5 templates and write `captions.md`. ASCII
  only, no em dashes, since Cameron reads this file every day. Shape:

```
# Day 2026-08-19  (phase: waitlist)

## 1. reframe-001
file:  01-reframe-001.mp4
cover: 01-reframe-001-cover.png

### Instagram Reels
<paste block>

### TikTok
<paste block>

### YouTube Shorts
TITLE (max 100): <title>
DESCRIPTION:
<paste block>
```

Three blocks per video, each independently selectable, because the workflow is: open the file, copy
one block, switch app, paste. Anything that requires editing after pasting is a daily tax.

- [ ] **Step 2:** assert the YouTube title is 100 characters or fewer and truncates at a word
  boundary. This is a hard platform limit and silently truncating mid-word looks careless.

**Verify:** the generated `captions.md` for a real day contains three videos and nine blocks, no
placeholder text, the correct phase URL in every CTA, and no em dash (`grep -cP '\x{2014}' captions.md` returns 0).

---

### Task 12: Verification harness and documentation

**Files:**
- Create: `marketing/video/scripts/render-stills.ts`
- Create: `marketing/video/scripts/check-literals.ts`
- Modify: `marketing/video/package.json` (`verify` includes the literal check)
- Modify: `marketing/video/README.md`

- [ ] **Step 1: `check-literals.ts`** greps `src/**/*.tsx?` for `#[0-9A-Fa-f]{3,8}` outside comments,
  for `rgba(` calls that are not `SCRIM_RGB`-derived, and for the literal strings `"Unbounded`,
  `"Manrope`, `"IBMPlexMono`. Any hit is an error naming file and line. This is what actually keeps
  "the videos use the real tokens" true six months from now, when the temptation to hardcode one
  color is at its highest.

- [ ] **Step 2: `render-stills.ts`** renders one still per format at its midpoint into
  `out/_stills/` with `DEV_GUIDES=1`, for a fast visual regression check that does not require a
  full encode. Roughly 20 seconds versus several minutes.

- [ ] **Step 3: README** covering, in order: what this is and why it is outside the workspace, the
  `--ignore-workspace` requirement with the reason, how to add a hook (one paragraph, one code
  block), how to re-cut clips, how to switch phase at release, how to run a day, where output goes,
  and the four failure modes with their fixes (missing fonts, missing footage, version drift across
  `@remotion/*`, phase unconfigured).

- [ ] **Step 4: full end to end.** `pnpm video:verify`, then `pnpm video:day`, then root
  `pnpm typecheck && pnpm lint && pnpm audit:contrast`, then `git status` and confirm nothing under
  `out/`, `public/fonts/`, or `public/footage/` is staged and root `pnpm-lock.yaml` is unchanged.

---

## Acceptance criteria

- One command from the repo root, `pnpm video:day`, writes three MP4s, three cover PNGs,
  `captions.md` and `manifest.json` into `marketing/video/out/<today>/`, with no manual step between
  invoking it and having uploadable files.
- The three are different formats, are never repeats of previously rendered hooks, and the run is
  resumable and idempotent per date.
- Every color, radius, spacing value, motion duration and font family in the output traces to
  `apps/mobile/src/theme/tokens.ts`, enforced by `check-literals`.
- The brand mark in the video is generated from the same geometry module the app's `Logo.tsx` uses.
- `PHASE=launched APP_STORE_URL=... pnpm video:day` produces the same videos with the App Store end
  card, with no code change. `PHASE=launched` without the URL refuses to render.
- `pnpm typecheck`, `pnpm lint` and `pnpm audit:contrast` from the repo root are green and the root
  `pnpm-lock.yaml` is unchanged.
- Adding a video to the queue is appending one object to `src/data/hooks.ts`.

## Risks

1. **`--ignore-workspace` gets forgotten during a later `pnpm add`,** which reinstalls the root
   workspace and mutates `node_modules` under a shipping app. Mitigated by the root `video:install`
   script, the `.npmrc` comment, and the README, but it stays the sharpest edge in this design.
   After any manual `pnpm add` in `marketing/video`, check `git diff --stat pnpm-lock.yaml` at the
   root.
2. **Remotion's webpack may refuse to compile TypeScript from outside the project root**
   (`../../apps/mobile/src/theme/tokens.ts`). Its default rule has no `include` restriction so it
   should work, and Task 2 Step 5 is specifically designed to catch it on day one. If it does fail,
   the fallback is a small codegen step in `sync-assets.ts` that copies `tokens.ts` and
   `logo-geometry.ts` into `src/generated/` and fails the build when the copies drift from source,
   which keeps one source of truth at the cost of a generated file.
3. **Render time on a laptop is unmeasured.** Frame extraction from HEVC dominates. If a day's batch
   exceeds about ten minutes, the levers in order are: lower `concurrency` if it is thrashing, run
   the `Normalize` fallback once to get H.264 sources, and only then consider dropping to 24fps.
4. **Silent videos may underperform** relative to ones with audio. The mitigation is procedural, not
   technical: Cameron adds trending audio in the platform composer, which is also where the reach
   benefit actually comes from.
5. **The seed hooks are unvalidated copy.** They come from the spec's examples and the site's
   approved language, but nobody has watched them. Expect the first week to be a rewrite of
   `hooks.ts` rather than a change to the pipeline, which is exactly the split this design is for.
6. **The spec's open question about which genre or vibe to lead with is not resolved here** and does
   not need to be. It lives entirely in `hooks.ts` strings. Whichever wedge gets chosen is an edit to
   one data file.
7. **Remotion's licence changes if the company grows past three people** (Spec correction 3).
</content>
</invoke>
