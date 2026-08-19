import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

import { captionsFor } from "../src/config/captions";
import { assertPhaseConfigured, CTA, PHASE, type Cta, type Phase } from "../src/config/phase";
import { clips } from "../src/data/clips";
import { hooks } from "../src/data/hooks";
import { readLedger, writeLedger, type Ledger } from "../src/lib/ledger";
import { FORMAT_CYCLE, selectDay, unrenderedByFormat } from "../src/lib/select";
import { webpackOverride } from "../src/lib/webpack-override";
import type { ClipName, Format, Hook } from "../src/types";
import { syncAssets } from "./sync-assets";
import { reportContent } from "./validate-content";

/**
 * The one command. `pnpm video:day` from the repo root ends with a dated folder of MP4s,
 * cover frames, captions and a manifest, and there is no manual step between running it and
 * having uploadable files.
 *
 * It is a script rather than three CLI calls for one reason above all others: the webpack
 * bundle is the expensive part, it is identical for all three videos, and doing it once
 * instead of three times is most of the run time. Everything else here is ordering, so that
 * each way a day can fail does so before anything expensive has happened.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, "..");
const ENTRY = path.join(PROJECT, "src", "index.ts");
const PUBLIC_DIR = path.join(PROJECT, "public");
const FOOTAGE_DIR = path.join(PUBLIC_DIR, "footage");
const FONTS_DIR = path.join(PUBLIC_DIR, "fonts");
const NOISE = path.join(PUBLIC_DIR, "noise.png");
const OUT_DIR = path.join(PROJECT, "out");

/** The composition every post is. The `Preview-` ones in Root.tsx exist for Studio and are
 * never rendered here, which is what the prefix is for. */
const COMPOSITION_ID = "Post";

/** Two thirds of a second in. Late enough that the first hook line has sprung in, early
 * enough that it is still the opening beat, which is what a cover frame has to promise. */
const COVER_FRAME = 20;

const CONCURRENCY = 4;
const JPEG_QUALITY = 90;

// ---- Flags ----

interface Options {
  date: string;
  count: number;
  only: string | null;
  dryRun: boolean;
  force: boolean;
}

const USAGE = [
  "Usage: pnpm video:day [flags]",
  "",
  "  --date YYYY-MM-DD   which day folder to write. Default today, local time.",
  "  --count N           how many videos. Default 3.",
  "  --only <hook-id>    re-render one hook. Does not touch the ledger.",
  "  --dry-run           print the plan and stop.",
  "  --force             overwrite an existing day folder.",
].join("\n");

/** Local time, not toISOString(): the folder is named for the day Cameron is posting on, and
 * west of Greenwich after 5pm UTC those are different days. */
const today = (): string => {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Round trips through Date, so 2026-02-31 is rejected rather than quietly becoming March. */
const isRealDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
  );
};

const parseOptions = (argv: string[]): Options => {
  const options: Options = { date: today(), count: 3, only: null, dryRun: false, force: false };

  const valueOf = (flag: string, index: number): string => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${flag} needs a value.\n\n${USAGE}`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]!;
    switch (flag) {
      case "--date":
        options.date = valueOf(flag, index);
        index += 1;
        break;
      case "--count":
        options.count = Number(valueOf(flag, index));
        index += 1;
        break;
      case "--only":
        options.only = valueOf(flag, index);
        index += 1;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--help":
      case "-h":
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        // Unknown flags are fatal rather than ignored: a mistyped --forse that renders a day
        // and then refuses to overwrite it has cost more than it saved.
        throw new Error(`Unknown flag "${flag}".\n\n${USAGE}`);
    }
  }

  if (!isRealDate(options.date)) {
    throw new Error(`--date "${options.date}" is not a real YYYY-MM-DD date.`);
  }
  if (!Number.isInteger(options.count) || options.count < 1) {
    throw new Error(`--count must be a whole number of at least 1, and is "${options.count}".`);
  }

  return options;
};

// ---- Footage ----

const clipsOf = (hook: Hook): ClipName[] => {
  switch (hook.format) {
    case "reframe":
    case "pain":
      return [hook.clip];
    case "demo":
      return hook.steps.map((step) => step.clip);
    case "spec":
      return [];
  }
};

/** The files a hook needs that are not on this disk. Clip.tsx draws a labelled panel for
 * each one, so this is about whether that is acceptable, not about whether it will crash. */
const missingFilesFor = (hook: Hook): string[] => {
  const files = new Set(clipsOf(hook).map((name) => clips[name].file));
  return [...files].filter((file) => !fs.existsSync(path.join(FOOTAGE_DIR, file)));
};

/** Fonts and the grain tile are gitignored and reproduced from the repo's own install in
 * under a second, so a missing one is a sync away and never a reason to stop. */
const ensureAssets = (): void => {
  const fontsPresent =
    fs.existsSync(FONTS_DIR) && fs.readdirSync(FONTS_DIR).some((file) => file.endsWith(".ttf"));
  if (fontsPresent && fs.existsSync(NOISE)) {
    return;
  }
  console.log("public/fonts or public/noise.png is missing. Syncing assets.");
  syncAssets();
};

// ---- The day folder ----

interface Video {
  slot: number;
  id: string;
  format: Format;
  file: string;
  cover: string;
  /** The finished video, end card included, which is what a scheduler needs to know. */
  seconds: number;
  caption: string;
}

interface Manifest {
  date: string;
  phase: Phase;
  generatedAt: string;
  videos: Video[];
}

/** Paths in output are written the way Cameron would type them, from the repo root. An
 * absolute path in a summary line reads like a machine detail. */
const rel = (absolute: string): string =>
  path.relative(path.resolve(PROJECT, "..", ".."), absolute).split(path.sep).join("/");

const baseName = (slot: number, id: string): string => `${String(slot).padStart(2, "0")}-${id}`;

const manifestPath = (dayDir: string): string => path.join(dayDir, "manifest.json");

const readManifest = (dayDir: string): Manifest | null => {
  const file = manifestPath(dayDir);
  if (!fs.existsSync(file)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Manifest;
  } catch (cause) {
    throw new Error(
      `${rel(file)} is not valid JSON (${(cause as Error).message}). Delete the folder, or re-run the day with --force.`,
    );
  }
};

/** Everything this script writes, so `--force` can clear a day without taking anything
 * Cameron put in the folder himself with it. */
const isGenerated = (name: string): boolean =>
  name.endsWith(".mp4") ||
  name.endsWith(".png") ||
  name === "captions.md" ||
  name === "manifest.json";

const clearDay = (dayDir: string): void => {
  if (!fs.existsSync(dayDir)) {
    return;
  }
  // A previous run with different picks leaves files this run will not overwrite, and a
  // folder holding a video the manifest does not list is a video that gets posted by mistake.
  for (const name of fs.readdirSync(dayDir).filter(isGenerated)) {
    fs.rmSync(path.join(dayDir, name));
  }
};

// ---- Captions ----

/**
 * Three blocks per video, each independently selectable, because the workflow is: open the
 * file, copy one block, switch app, paste. Anything that needs editing after pasting is a
 * daily tax.
 *
 * Task 11 of the plan moves this into src/lib/captions.ts and adds the title-length
 * assertion. It is here now so that a day produces every file it is supposed to.
 */
const captionsMarkdown = (
  date: string,
  cta: Cta,
  entries: readonly { video: Video; hook: Hook }[],
): string => {
  const sections = entries.map(({ video, hook }) => {
    const captions = captionsFor(hook, cta);
    return [
      `## ${video.slot}. ${video.id}`,
      `file:  ${video.file}`,
      `cover: ${video.cover}`,
      "",
      "### Instagram Reels",
      captions.instagram,
      "",
      "### TikTok",
      captions.tiktok,
      "",
      "### YouTube Shorts",
      `TITLE (max 100): ${captions.youtube.title}`,
      "DESCRIPTION:",
      captions.youtube.description,
    ].join("\n");
  });

  return `${[`# Day ${date}  (phase: ${PHASE})`, ...sections].join("\n\n")}\n`;
};

// ---- Progress ----

interface Progress {
  report: (fraction: number) => void;
  done: () => void;
}

/** One line per render rather than a scrolling log. Remotion reports fractional progress
 * many times a second, and a terminal is the only place that is readable, so a non-tty (a
 * redirect, a log file) gets quarter marks instead. */
const progressReporter = (label: string): Progress => {
  let shown = -1;
  const tty = process.stdout.isTTY === true;
  return {
    report: (fraction: number): void => {
      const percent = Math.max(0, Math.min(100, Math.round(fraction * 100)));
      if (percent === shown) {
        return;
      }
      shown = percent;
      if (tty) {
        process.stdout.write(`\r  ${label} ${String(percent).padStart(3)}%`);
      } else if (percent % 25 === 0) {
        console.log(`  ${label} ${percent}%`);
      }
    },
    done: (): void => {
      if (tty) {
        process.stdout.write("\n");
      }
    },
  };
};

const took = (fromMs: number): string => `${((Date.now() - fromMs) / 1000).toFixed(1)}s`;

// ---- The batch ----

interface Plan {
  entries: { slot: number; hook: Hook }[];
  /** null for --only, which re-renders without consuming a hook. */
  nextLedger: Ledger | null;
  repeatedFormats: boolean;
}

const hookById = (id: string): Hook => {
  const found = hooks.find((hook) => hook.id === id);
  if (!found) {
    throw new Error(`"${id}" is not a hook id in src/data/hooks.ts.`);
  }
  return found;
};

const planOnly = (id: string, dayDir: string): Plan => {
  const hook = hookById(id);
  const existing = readManifest(dayDir);
  // Reuse the slot the video already has, so a re-render replaces the file it is a re-render
  // of instead of appearing beside it under a second number.
  const previous = existing?.videos.find((video) => video.id === hook.id);
  const slot =
    previous?.slot ?? Math.max(0, ...(existing?.videos.map((video) => video.slot) ?? [])) + 1;
  return { entries: [{ slot, hook }], nextLedger: null, repeatedFormats: false };
};

const planDay = (options: Options, ledger: Ledger): Plan => {
  const selection = selectDay(hooks, ledger, options.count);
  return {
    entries: selection.picks.map((hook, index) => ({ slot: index + 1, hook })),
    nextLedger: {
      renderedIds: [...ledger.renderedIds, ...selection.picks.map((hook) => hook.id)],
      cyclePos: selection.cyclePos,
    },
    repeatedFormats: selection.repeatedFormats,
  };
};

const main = async (): Promise<void> => {
  const options = parseOptions(process.argv.slice(2));

  // 1. The call to action, before anything else. Three finished videos with a placeholder
  //    App Store link on the end card is the expensive failure this check exists for.
  assertPhaseConfigured();
  const cta: Cta = CTA[PHASE];

  // 2. Exactly what `pnpm validate` checks, in process. A batch that renders copy the
  //    validator would have rejected is a batch that gets posted.
  if (reportContent() > 0) {
    throw new Error("Content validation failed. Nothing was rendered.");
  }

  // 3.
  ensureAssets();

  // 4.
  const ledger = readLedger();
  const dayDir = path.join(OUT_DIR, options.date);
  const plan = options.only ? planOnly(options.only, dayDir) : planDay(options, ledger);

  if (plan.repeatedFormats) {
    console.log(
      "WARNING: the queue could not fill this day with different formats, so one is repeated.",
    );
  }

  const blocked: string[] = [];
  for (const { hook } of plan.entries) {
    const missing = missingFilesFor(hook);
    if (missing.length === 0) {
      continue;
    }
    const files = missing.map((file) => `public/footage/${file}`).join(", ");
    if (hook.format === "demo") {
      // A demo is nothing but footage. The other formats draw the labelled panel, which is a
      // usable draft and a visible reminder; a demo would be three panels and no product.
      blocked.push(`${hook.id} needs ${files}`);
    } else {
      console.log(`WARNING: ${hook.id} renders the missing-clip panel. It needs ${files}.`);
    }
  }
  if (blocked.length > 0) {
    throw new Error(
      [
        "A demo hook was picked whose footage is not on this disk:",
        ...blocked.map((line) => `  ${line}`),
        "Record it into public/footage/, or render fewer videos with --count.",
      ].join("\n"),
    );
  }

  // 5.
  const dayExists = fs.existsSync(dayDir) && fs.readdirSync(dayDir).length > 0;
  if (dayExists && !options.only && !options.force && !options.dryRun) {
    throw new Error(
      `${rel(dayDir)} already exists. Re-run with --force to overwrite it, or use --date for another day.`,
    );
  }

  // The plan is printed the same way whether or not this is a dry run, so what --dry-run
  // shows is what the real run does rather than a second description of it.
  const remaining = unrenderedByFormat(hooks, ledger);
  console.log("");
  console.log(`day       ${options.date}${options.only ? "  (--only, ledger untouched)" : ""}`);
  console.log(`phase     ${PHASE}  ->  ${cta.line}: ${cta.url}`);
  console.log(`out       ${rel(dayDir)}`);
  console.log(
    `queue     ${FORMAT_CYCLE.map((format) => `${format} ${remaining[format]}`).join(", ")} unrendered`,
  );
  for (const { slot, hook } of plan.entries) {
    const number = String(slot).padStart(2, "0");
    console.log(`  ${number}  ${hook.format.padEnd(7)}  ${hook.id}  ${hook.seconds}s  "${hook.caption}"`);
  }
  console.log("");

  if (options.dryRun) {
    if (dayExists && !options.only && !options.force) {
      console.log(`${rel(dayDir)} already exists, so a real run would need --force.`);
    }
    console.log("--dry-run: nothing rendered.");
    return;
  }

  if (options.force && !options.only) {
    clearDay(dayDir);
  }
  fs.mkdirSync(dayDir, { recursive: true });

  // 6. Once for the whole batch. This is the slow step, roughly a minute cold, and doing it
  //    per video is the only version of this script that is measurably worse.
  const bundleStarted = Date.now();
  const bundling = progressReporter("bundle");
  const serveUrl = await bundle({
    entryPoint: ENTRY,
    publicDir: PUBLIC_DIR,
    webpackOverride,
    onProgress: (percent) => bundling.report(percent / 100),
  });
  bundling.done();
  console.log(`bundled in ${took(bundleStarted)}`);

  // 7.
  const videos: Video[] = [];
  for (const { slot, hook } of plan.entries) {
    const base = baseName(slot, hook.id);
    const inputProps = { hook, cta };
    const started = Date.now();

    // Not getCompositions(): selectComposition resolves calculateMetadata against these exact
    // inputProps, which is where a hook's `seconds` becomes a duration. Rendering against the
    // registered default would give every video the same length.
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });

    const rendering = progressReporter(`${base}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: path.join(dayDir, `${base}.mp4`),
      inputProps,
      // Decision 7: gameplay b-roll carries game music and in-game voice, which is a
      // copyright and a moderation problem on all three platforms. enforceAudioTrack keeps a
      // valid silent AAC track in the container, because a file with no audio stream at all
      // occasionally trips upload validators. Trending audio is added in the composer.
      muted: true,
      enforceAudioTrack: true,
      // remotion.config.ts is read only by the CLI and Studio, so the settings that matter to
      // the output are repeated here rather than inherited.
      imageFormat: "jpeg",
      jpegQuality: JPEG_QUALITY,
      concurrency: CONCURRENCY,
      overwrite: true,
      onProgress: ({ progress }) => rendering.report(progress),
    });
    rendering.done();

    await renderStill({
      composition,
      serveUrl,
      output: path.join(dayDir, `${base}-cover.png`),
      frame: COVER_FRAME,
      inputProps,
      imageFormat: "png",
      overwrite: true,
    });

    videos.push({
      slot,
      id: hook.id,
      format: hook.format,
      file: `${base}.mp4`,
      cover: `${base}-cover.png`,
      seconds: composition.durationInFrames / composition.fps,
      caption: hook.caption,
    });
    console.log(`  ${base}.mp4 and its cover in ${took(started)}`);
  }

  // 8. A --only run rebuilds both files around the video it replaced, so the folder never
  //    describes itself wrongly. Rows it did not render keep their own duration, because
  //    those files were not re-encoded.
  const untouched = options.only
    ? (readManifest(dayDir)?.videos ?? []).filter(
        (video) => !videos.some((rendered) => rendered.id === video.id),
      )
    : [];
  const rows = [...untouched, ...videos].sort((a, b) => a.slot - b.slot);

  const manifest: Manifest = {
    date: options.date,
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    videos: rows,
  };
  fs.writeFileSync(manifestPath(dayDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  fs.writeFileSync(
    path.join(dayDir, "captions.md"),
    captionsMarkdown(
      options.date,
      cta,
      rows.map((video) => ({ video, hook: hookById(video.id) })),
    ),
    "utf8",
  );

  // 9. Last, and only now. A crash above costs the renders that finished and nothing else:
  //    the same hooks come up again on the next run, which is the recoverable failure.
  if (plan.nextLedger) {
    writeLedger(plan.nextLedger);
  }

  // 10.
  console.log("");
  console.log(rel(dayDir));
  for (const video of rows) {
    console.log(
      `  ${video.file.padEnd(24)} ${video.seconds.toFixed(1)}s  ${video.format.padEnd(7)} "${video.caption}"`,
    );
  }
  console.log("  captions.md and manifest.json");
};

main().catch((error: unknown) => {
  console.error(`\nrender-day: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
