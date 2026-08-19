# DuoQueue video pipeline

A local Remotion project that renders the daily short-form marketing videos: three vertical
MP4s per day plus cover frames and per-platform captions, in the real Volt identity.

Plan and spec:

- `docs/superpowers/plans/2026-08-18-remotion-pipeline.md` (the implementation spec for this
  directory; it is the authority on every decision here)
- `docs/superpowers/specs/2026-08-18-launch-marketing-design.md` section 2

## This project is deliberately outside the pnpm workspace

`pnpm-workspace.yaml` globs only `apps/*` and `packages/*`, so nothing here is a workspace
member. That is on purpose:

- CI (`.github/workflows/security.yml`) runs `pnpm install --frozen-lockfile`,
  `pnpm audit --audit-level high`, `pnpm typecheck` and `pnpm lint` on every push. As a member,
  every push would install Remotion's platform binaries on Ubuntu in three jobs to typecheck a
  marketing tool, and a moderate advisory anywhere in Remotion's transitive tree would block
  work on a shipping iOS app.
- The repo root sets `node-linker=hoisted`, so workspace dependencies land in one flat
  `node_modules` that Metro resolves from. Remotion, webpack and a second React tree do not
  belong in the tree an approved Expo app builds against.

The cost is that root `pnpm typecheck` and `pnpm lint` do not cover this code. That is what
`pnpm video:verify` is for, and it must be green before any commit that touches this directory.

## Every install here needs `--ignore-workspace`

Without the flag, pnpm walks up, finds `pnpm-workspace.yaml`, and installs the ROOT workspace
instead: it mutates the root `node_modules` and installs nothing here. A local `.npmrc` with
`ignore-workspace=true` does not prevent this; only the CLI flag does.

```
pnpm video:install                                     # from the repo root, flag included
pnpm --dir marketing/video add --ignore-workspace <pkg>
```

After any manual `pnpm add` in this directory, check that `git diff --stat pnpm-lock.yaml` at
the repo root is empty. If it is not, the flag was dropped: `git checkout pnpm-lock.yaml`, run
`pnpm install` at the root, and redo the command with the flag.

`package.json` carries its own `"packageManager": "pnpm@10.33.0"` because `--ignore-workspace`
stops corepack from honoring the root pin.

## Commands (all from the repo root)

| Command | What it does |
| --- | --- |
| `pnpm video:install` | Installs this project's dependencies, workspace-safely |
| `pnpm video:studio` | Opens Remotion Studio to preview and scrub compositions |
| `pnpm video:day` | Renders the day's three videos, covers, captions and manifest |
| `pnpm video:verify` | typecheck + lint + content validation. Required before committing |

## Layout

```
public/            fonts/, footage/ and noise.png are synced or supplied, all gitignored
src/components/    DOM ports of the app's primitives, plus shared video furniture
src/formats/       one component per format: reframe, pain, demo, spec
src/data/          hooks.ts (the queue) and clips.ts (footage in and out points)
src/config/        phase (waitlist or launched) and caption templates
src/lib/           scale, fonts, selection, ledger, webpack override
scripts/           render-day, render-stills, sync-assets, validate-content
state/             rendered.json, the committed ledger of what has shipped
types/             the react-native TYPE stub, see types/react-native.d.ts
```

## Footage

`public/footage/` holds one MP4 per usable moment, named for what it shows, and
`src/data/clips.ts` trims each one. Both are gitignored: they are large, they change whenever
they are re-cut, and everything rendered from them is reproducible.

Twelve clips are cut from a single 2:08 screen recording of the app. The thirteenth,
`broll-gameplay.mp4`, is gameplay b-roll for the `pain` format and has not been recorded yet.
Until it lands, `pain` posts render a labelled missing-clip panel instead of black, and
`pnpm video:verify` prints a warning for each of the seven hooks that want it. That is the
designed state, not a failure.

`public/footage/README.md` is the manifest: every clip, its in and out points in the source
recording, what it shows, the exact ffmpeg line, and what to record next. Read it before
touching footage.

Re-recording the app is a two file job. Cut the new clips to the same names, then re-check the
timecodes in `src/data/clips.ts`. Nothing else in this project knows a file name or a
stopwatch reading.

One rule is worth knowing before writing a timecode: `OffthreadVideo` renders **nothing** past
its trimmed range. A clip shorter than the slot that plays it does not loop and does not
freeze on its last frame; it leaves an empty frame with the hook line floating on it. Every
clip must be at least as long as the longest slot that asks for it.

## Rules this project holds itself to

- One source of truth for the identity. Colors, radii, spacing, motion and the type scale are
  imported from `apps/mobile/src/theme/tokens.ts`; the brand mark comes from
  `apps/mobile/src/theme/logo-geometry.ts`. No hex color, font-family string, radius or spacing
  literal may appear under `src/`.
- Nothing under `src/` may import `react-native`, `react-native-svg`, `@expo/vector-icons`,
  `expo-*`, or anything from the app other than those two theme modules. eslint enforces it.
- No em dash in any string that reaches a frame, a caption file, a manifest or the console.
- No copy may imply dating. The app is a platonic gaming-partner app. The banned words are
  allowed only inside a denial, because "no, this is not a dating app" is the strongest hook
  there is.

## Status

Renders. `Post` switches on a hook's format and produces a finished 1080x1920 video for any of
the four, and the app footage is cut and timed. Two things are outstanding: `render-day` and
its ledger (so `pnpm video:day` is not wired up yet), and the gameplay b-roll, without which
the `pain` format shows its placeholder panel.
