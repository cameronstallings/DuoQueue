import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import { assertPhaseConfigured, CTA, PHASE, type Cta } from "../src/config/phase";
import { clips } from "../src/data/clips";
import { FPS } from "../src/lib/scale";
import { webpackOverride } from "../src/lib/webpack-override";
import { ANGLES, compositionFor, fileFor } from "../src/pro/angles";
import { reelCaptionsMarkdown, type ReelRow } from "../src/pro/captions";
import { FRAGMENTS, type FragName } from "../src/pro/media";
import { coverFrame } from "../src/pro/cover";
import { PRO, type ProScript } from "../src/pro/script";
import { shotsFor } from "../src/pro/shots";
import { proDuration } from "../src/pro/timing";
import { ANGLE_SHEETS, SHEETS } from "../src/static/sheets";

/**
 * `pnpm angles` ends with out/_reels/ holding five MP4s and a captions file, and out/_static/
 * holding three more sheets beside the four that are already there.
 *
 * =====================================================================================
 * WHAT THIS SCRIPT IS ALLOWED NEAR
 * =====================================================================================
 *
 * It is a sibling of render-static.ts and render-carousel.ts and it takes the same shape for the
 * same reason: the webpack bundle is the expensive part, it is identical for all seven outputs,
 * and building it once instead of seven times is most of the run time. It also means seven files
 * cannot be rendered from different revisions of the source by accident.
 *
 * IT DOES NOT TOUCH THE DAY PIPELINE. It selects compositions by name, writes into out/_reels/ and
 * out/_static/, and never reads or writes state/ledger.json.
 *
 * IT DOES NOT TOUCH THE LIVE ASSETS. out/_directions/pro-a-light.mp4 and its three siblings, the
 * carousel, and out/_static/{feed,story}-{light,dark}.png are campaign assets that are already
 * out; nothing here writes a path that could collide with one. The three sheets it does write are
 * named `feed-<angle>-light.png`, which is a name the existing renderer cannot produce.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, "..");
const ENTRY = path.join(PROJECT, "src", "index.ts");
const PUBLIC_DIR = path.join(PROJECT, "public");
const FOOTAGE_DIR = path.join(PUBLIC_DIR, "footage");
const FONTS_DIR = path.join(PUBLIC_DIR, "fonts");
const NOISE = path.join(PUBLIC_DIR, "noise.png");
const REELS_DIR = path.join(PROJECT, "out", "_reels");
const STATIC_DIR = path.join(PROJECT, "out", "_static");

/**
 * Six font faces load before the first frame can be captured and the bare CLI's default
 * delayRender timeout is 28s, which a cold bundle has already failed once. These are local files,
 * so the ceiling is never approached in the healthy case; it only stops a slow first frame from
 * being mistaken for a hang.
 */
const RENDER_TIMEOUT_MS = 120_000;
const CONCURRENCY = 4;
const JPEG_QUALITY = 90;

/** The one theme these seven files are cut in. `pro-a-light` is the approved direction and the
 * light half is the one Cameron chose out of eleven; there is no dark half of this batch, because
 * a dark half exists to be compared and the comparison is over. */
const THEME = "light" as const;

/**
 * THE FIVE FILMS THIS SCRIPT WRITES, AND WHY THE FIFTH IS NOT AN ANGLE.
 *
 * `reel-nostalgia.mp4` is `pro-001`, the approved film, rendered out of the SAME `Pro-A-Light`
 * composition the four angles use and therefore carrying the same beat-one retime. It is here so
 * that all five films Cameron has are in one folder on one clock, and for exactly one other
 * reason: `pnpm measure` reads every MP4 in out/_reels, so the film the batch is judged against
 * gets measured through the same filter as the batch rather than quoted from a previous run.
 *
 * IT IS NOT A POST AND IT DOES NOT GET A CAPTION BLOCK. The version of this film that went out is
 * out/_directions/pro-a-light.mp4, which this script has never written and still does not: nothing
 * below names that path, so the posted asset stays byte-identical. `captionsForReel` would throw on
 * `pro-001` anyway, because there is no COPY row for it and writing one would be writing a caption
 * for a post nobody is making.
 */
interface Film {
  script: ProScript;
  /** The composition id, which for the four angles is a name of their own and for the approved
   * film is the direction it was cut in. */
  id: string;
  /** The basename on disk, without an extension. */
  base: string;
  /** Whether the film gets a row in captions.md. False for exactly one of the five. */
  captioned: boolean;
}

const FILMS: Film[] = [
  ...ANGLES.map((script) => ({
    script,
    id: compositionFor(script.id),
    base: fileFor(script.id),
    captioned: true,
  })),
  { script: PRO, id: "Pro-A-Light", base: "reel-nostalgia", captioned: false },
];

/**
 * The cover frame is DERIVED PER FILM, in ../src/pro/cover.ts, and is no longer frame 20.
 *
 * Frame 20 was inherited from the day pipeline and it is the wrong frame for a reel that has to
 * survive a profile grid. It sits before the type exists - the first word of a statement lands on
 * frame 34 - so every cover in the first pass of this batch was a wordless picture, and because
 * frame 20 is inside the opening OBJECT beat, which the shot plan and not the words decide, two
 * pairs of them were byte-identical files. See the file for the measurements.
 */

const rel = (absolute: string): string =>
  path.relative(path.resolve(PROJECT, "..", ".."), absolute).split(path.sep).join("/");

const took = (fromMs: number): string => `${((Date.now() - fromMs) / 1000).toFixed(1)}s`;

/** Fonts and the grain tile are gitignored and reproduced from the repo's own install in under a
 * second, so a missing one is a sync away and never a reason to stop. */
const ensureAssets = async (): Promise<void> => {
  const fontsPresent =
    fs.existsSync(FONTS_DIR) && fs.readdirSync(FONTS_DIR).some((file) => file.endsWith(".ttf"));
  if (fontsPresent && fs.existsSync(NOISE)) {
    return;
  }
  console.log("public/fonts or public/noise.png is missing. Syncing assets.");
  const { syncAssets } = await import("./sync-assets");
  syncAssets();
};

/**
 * Every fragment these seven files draw, read off the shot plans and the sheets rather than off a
 * second hand-kept list. A missing crop does not fail a render, it draws the labelled panel
 * instead of the app, which on a finished reel is a grey rectangle nobody notices until it is up.
 *
 * ONLY THE LIGHT HALF IS CHECKED, because only the light half is read: every composition here is
 * ProALight or a light sheet. Demanding the dark half as well would block a deliverable on footage
 * no frame of it contains.
 */
const wantedFragments = (): FragName[] => {
  const wanted = new Set<FragName>(["screen", "play"]);
  for (const { script } of FILMS) {
    const shots = shotsFor(script.id);
    for (const frag of [...(shots.pair ?? []), ...shots.close]) {
      wanted.add(frag);
    }
  }
  for (const name of ANGLE_SHEETS) {
    for (const piece of SHEETS[name].object) {
      wanted.add(piece.piece);
    }
  }
  return [...wanted];
};

const assertFootage = (): void => {
  const missing = [...new Set(wantedFragments().map((frag) => clips[FRAGMENTS[frag][THEME]].file))]
    .filter((file) => !fs.existsSync(path.join(FOOTAGE_DIR, file)))
    .sort();
  if (missing.length > 0) {
    throw new Error(
      [
        "This batch needs footage that is not on this disk:",
        ...missing.map((file) => `  public/footage/${file}`),
        "Run the crops in public/footage/README.md, or sync the folder.",
      ].join("\n"),
    );
  }
};

/** A single-line progress bar, so a seven-render batch does not print four hundred lines. */
const progress = (label: string) => {
  let last = -1;
  return {
    report: (fraction: number): void => {
      const percent = Math.floor(fraction * 100);
      if (percent > last) {
        last = percent;
        process.stdout.write(`\r  ${label} ${String(percent).padStart(3)}%`);
      }
    },
    done: (note: string): void => {
      process.stdout.write(`\r  ${label} ${note}\n`);
    },
  };
};

/**
 * The two markdown files, which are derived from the source and not from the render.
 *
 * They are written on every run AND reachable on their own with `--captions`, because a caption
 * edit does not change a frame and four re-renders to pick up one sentence is four minutes spent
 * proving nothing. The frame counts come from `proDuration`, which is derived from the measured
 * read, so the table is right whether or not the files on disk are current.
 */
const writeMarkdown = (cta: Cta, rows: readonly ReelRow[]): void => {
  fs.mkdirSync(REELS_DIR, { recursive: true });
  fs.mkdirSync(STATIC_DIR, { recursive: true });

  fs.writeFileSync(path.join(REELS_DIR, "captions.md"), reelCaptionsMarkdown(cta, rows), "utf8");

  fs.writeFileSync(
    path.join(STATIC_DIR, "angles.md"),
    `${[
      "# The three angle sheets",
      "",
      "1080x1350, light theme, the same design as `feed-light.png`: the statement is the only",
      "variable. See src/static/sheets.ts for why these three angles and not the fourth.",
      "",
      "| file | says | accent |",
      "| --- | --- | --- |",
      ...ANGLE_SHEETS.map(
        (name) =>
          `| feed-${name}-light.png | ${SHEETS[name].statement.join(" ")} | ${SHEETS[name].key} |`,
      ),
      "",
      `Under every one of them: ${cta.line} / ${cta.url}, and A GAMING APP / 18+ / PLATONIC.`,
      "",
      "The four sheets already in this folder are a separate deliverable and are unchanged. These",
      "three are feed only: a story sheet is the placement that reaches the waitlist in one tap and",
      "it needs the link sticker set up by hand, which `captions.md` in this folder covers.",
    ].join("\n")}\n`,
    "utf8",
  );
};

/** The rows as the SOURCE describes them, used by `--captions` and as the check the render is
 * compared against. */
const plannedRows = (): ReelRow[] =>
  ANGLES.map((script) => {
    const frames = proDuration(script);
    return { file: `${fileFor(script.id)}.mp4`, script, frames, seconds: frames / FPS };
  });

const main = async (): Promise<void> => {
  // The call to action, before anything else. Seven finished files with a placeholder link on them
  // is the expensive failure this check exists for.
  assertPhaseConfigured();
  const cta: Cta = CTA[PHASE];

  const args = process.argv.slice(2);
  const coversOnly = args.includes("--covers");

  if (args.includes("--captions")) {
    writeMarkdown(cta, plannedRows());
    console.log(`${rel(path.join(REELS_DIR, "captions.md"))} and ${rel(path.join(STATIC_DIR, "angles.md"))} rewritten. No frames rendered.`);
    return;
  }

  await ensureAssets();
  assertFootage();

  fs.mkdirSync(REELS_DIR, { recursive: true });
  fs.mkdirSync(STATIC_DIR, { recursive: true });

  const bundleStarted = Date.now();
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR, webpackOverride });
  console.log(`bundled in ${took(bundleStarted)}`);

  const rows: ReelRow[] = [];
  /** The films that are written but not captioned. See FILMS. */
  const extra: ReelRow[] = [];

  for (const { script, id, base, captioned } of FILMS) {
    const inputProps = { script, cta };
    const started = Date.now();

    const composition = await selectComposition({
      serveUrl,
      id,
      inputProps,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    });

    if (!coversOnly) {
      const bar = progress(`${base}.mp4`);
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: path.join(REELS_DIR, `${base}.mp4`),
        inputProps,
        // The voiceover and its bed are the only sound in the container: every OffthreadVideo in
        // this project sets `muted` on the element, so no frame of gameplay audio can reach the
        // mix. enforceAudioTrack stays because a file with no audio stream at all occasionally
        // trips the platforms' upload validators.
        muted: false,
        enforceAudioTrack: true,
        // remotion.config.ts is read only by the CLI and Studio, so the settings that matter to
        // the output are repeated here rather than inherited.
        imageFormat: "jpeg",
        jpegQuality: JPEG_QUALITY,
        concurrency: CONCURRENCY,
        overwrite: true,
        timeoutInMilliseconds: RENDER_TIMEOUT_MS,
        onProgress: ({ progress: fraction }) => {
          bar.report(fraction);
        },
      });
      bar.done(`${String(composition.durationInFrames)}f in ${took(started)}`);
    }

    await renderStill({
      composition,
      serveUrl,
      output: path.join(REELS_DIR, `${base}-cover.png`),
      frame: coverFrame(script),
      inputProps,
      imageFormat: "png",
      overwrite: true,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    });

    const row = {
      file: `${base}.mp4`,
      script,
      frames: composition.durationInFrames,
      seconds: composition.durationInFrames / composition.fps,
    };
    if (captioned) {
      rows.push(row);
    } else {
      extra.push(row);
    }
  }

  for (const name of coversOnly ? [] : ANGLE_SHEETS) {
    const inputProps = { size: "feed" as const, theme: THEME, cta, sheet: name };
    const file = `feed-${name}-light.png`;
    const started = Date.now();

    const composition = await selectComposition({
      serveUrl,
      id: "Static",
      inputProps,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    });

    await renderStill({
      composition,
      serveUrl,
      output: path.join(STATIC_DIR, file),
      frame: 0,
      inputProps,
      imageFormat: "png",
      overwrite: true,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    });
    console.log(`  ${file} in ${took(started)}`);
  }

  if (coversOnly) {
    console.log("");
    console.log(`${rel(REELS_DIR)}  covers only, no film and no sheet re-rendered`);
    for (const { script, base } of FILMS) {
      console.log(`  ${base}-cover.png  f${String(coverFrame(script))}`);
    }
    return;
  }

  writeMarkdown(cta, rows);

  console.log("");
  console.log(rel(REELS_DIR));
  for (const row of [...rows, ...extra]) {
    console.log(`  ${row.file}  ${String(row.frames)}f  ${row.seconds.toFixed(2)}s`);
  }
  console.log("  captions.md");
  console.log(rel(STATIC_DIR));
  for (const name of ANGLE_SHEETS) {
    console.log(`  feed-${name}-light.png`);
  }
  console.log("  angles.md");

  // A last look at the clock, from the composition rather than from the file, so a mismatch
  // between what was asked for and what was rendered is caught here rather than in ffprobe.
  for (const row of [...rows, ...extra]) {
    const expected = proDuration(row.script);
    if (row.frames !== expected) {
      throw new Error(
        `${row.file} rendered ${String(row.frames)} frames and its read derives ${String(expected)}.`,
      );
    }
  }
};

main().catch((error: unknown) => {
  console.error(`\nrender-angles: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
