import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

import { captionsMarkdown, fileFor } from "../src/carousels/captions";
import { LUMA_BAND, SHIPPED_LUMA } from "../src/carousels/ground";
import { SETS } from "../src/carousels/sets";
import { assertPhaseConfigured, CTA, PHASE, type Cta } from "../src/config/phase";
import { clips } from "../src/data/clips";
import { webpackOverride } from "../src/lib/webpack-override";
import { FRAGMENTS } from "../src/pro/media";
import { findTool } from "./build-audio";
import { syncAssets } from "./sync-assets";

/**
 * `pnpm carousels` ends with out/_carousels/ holding ten directories of numbered PNGs and one
 * captions file, and there is no manual step between running it and having ten uploadable posts.
 *
 * =====================================================================================
 * IT CANNOT TOUCH THE SHIPPED SET, AND THAT IS STRUCTURAL RATHER THAN CAREFUL
 * =====================================================================================
 *
 * out/_carousel/ is a live asset. This script writes into out/_carousels/, selects a composition
 * called `Carousels` rather than `Carousel`, and imports nothing out of src/carousel/ except
 * types and constants. `pnpm carousel` is a different script over a different plan and its six
 * files are not readable, writable or reachable from here.
 *
 * =====================================================================================
 * THE TWO GATES IT RUNS, BECAUSE BOTH FAILURES HAVE HAPPENED BEFORE
 * =====================================================================================
 *
 * THE SIGNATURE IS PROVED, NOT ASSERTED. The last card of every set is the same card, and the
 * cheap way to believe that is to look at two of them. This hashes all ten and fails if they are
 * not one hash, which is the only statement of "byte identical" worth making.
 *
 * THE LUMA IS MEASURED OFF THE FILES, IN TWO CLASSES. The shipped six run 196.5 to 211.2 with a
 * mean of 201.6, and that is printed beside the batch's own numbers so "match the family" is a
 * comparison a run performs rather than a sentence somebody remembers. The bands are per class,
 * because five of these forty-nine cards are bare paper and type and no card in the shipped six
 * is: see LUMA_BAND in src/carousels/ground.ts for both ranges and where they come from.
 *
 * It is a WARNING and not an error. A card outside its band is a judgement about how much product
 * is on it, and the person who has to make that judgement is the one reading the table.
 *
 * The measurement is skipped rather than fatal when ffmpeg is absent, because a missing encoder
 * is a reason to not have a number and never a reason to not have the ten posts.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, "..");
const ENTRY = path.join(PROJECT, "src", "index.ts");
const PUBLIC_DIR = path.join(PROJECT, "public");
const FOOTAGE_DIR = path.join(PUBLIC_DIR, "footage");
const FONTS_DIR = path.join(PUBLIC_DIR, "fonts");
const NOISE = path.join(PUBLIC_DIR, "noise.png");
const OUT_DIR = path.join(PROJECT, "out", "_carousels");

const COMPOSITION_ID = "Carousels";

/** Six font faces load before the first frame can be captured and the default delayRender timeout
 * is 28s, which a cold bundle has already failed once. These are local files, so the ceiling is
 * never approached in the healthy case; it only stops a slow first frame being read as a hang. */
const RENDER_TIMEOUT_MS = 120_000;

/** Paths are printed the way Cameron would type them, from the repo root. */
const rel = (absolute: string): string =>
  path.relative(path.resolve(PROJECT, "..", ".."), absolute).split(path.sep).join("/");

/** Fonts and the grain tile are gitignored and reproduced from the repo's own install in under a
 * second, so a missing one is a sync away and never a reason to stop. */
const ensureAssets = (): void => {
  const fontsPresent =
    fs.existsSync(FONTS_DIR) && fs.readdirSync(FONTS_DIR).some((file) => file.endsWith(".ttf"));
  if (fontsPresent && fs.existsSync(NOISE)) {
    return;
  }
  console.log("public/fonts or public/noise.png is missing. Syncing assets.");
  syncAssets();
};

/**
 * Every clip the ten draw is cropped footage that is gitignored and filled by hand. A missing file
 * renders the labelled panel instead of the app, which on a still is a post that would go up with
 * a grey rectangle in it. The list is derived from the sets rather than restated, so a set that
 * starts using an eighth piece is checked without anybody remembering to add it here.
 */
const assertFootage = (): void => {
  const wanted = new Set<string>();
  for (const set of SETS) {
    for (const card of set.cards) {
      for (const piece of card.pieces ?? []) {
        wanted.add(clips[FRAGMENTS[piece.piece].dark].file);
      }
    }
  }
  const missing = [...wanted]
    .sort()
    .filter((file) => !fs.existsSync(path.join(FOOTAGE_DIR, file)));
  if (missing.length > 0) {
    throw new Error(
      [
        "The carousels need footage that is not on this disk:",
        ...missing.map((file) => `  public/footage/${file}`),
        "Run the crops in public/footage/README.md, or sync the folder.",
      ].join("\n"),
    );
  }
};

const took = (fromMs: number): string => `${((Date.now() - fromMs) / 1000).toFixed(1)}s`;

const sha256 = (file: string): string =>
  createHash("sha256").update(fs.readFileSync(file)).digest("hex");

/** signalstats YAVG on a single frame, through exactly the same filter scripts/measure-out.ts
 * puts a frame of film through, so the two numbers are comparable. */
const lumaOf = (ffmpeg: string, file: string): number | null => {
  const result = spawnSync(
    ffmpeg,
    [
      "-hide_banner",
      "-nostdin",
      "-v",
      "error",
      "-i",
      file,
      "-vf",
      "signalstats,metadata=print:file=-",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const out = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const found = /lavfi\.signalstats\.YAVG=([\d.]+)/.exec(out);
  return found === null ? null : Number(found[1]);
};

interface Rendered {
  set: string;
  file: string;
  absolute: string;
  last: boolean;
  /** Bare paper and type, which is a different luma class from a card with an object on it. */
  bare: boolean;
}

const main = async (): Promise<void> => {
  // The call to action, before anything else. Forty-nine finished cards with a placeholder link
  // on ten of them is the expensive failure this check exists for.
  assertPhaseConfigured();
  const cta: Cta = CTA[PHASE];

  ensureAssets();
  assertFootage();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bundleStarted = Date.now();
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR, webpackOverride });
  console.log(`bundled in ${took(bundleStarted)}`);
  console.log("");

  const rendered: Rendered[] = [];

  for (const set of SETS) {
    const dir = path.join(OUT_DIR, set.name);
    fs.mkdirSync(dir, { recursive: true });
    const total = set.cards.length + 1;
    const started = Date.now();

    for (let index = 0; index < total; index += 1) {
      const inputProps = { set: set.name, index, cta };
      const file = fileFor(set, index);
      const absolute = path.join(dir, file);

      const composition = await selectComposition({
        serveUrl,
        id: COMPOSITION_ID,
        inputProps,
        timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      });

      await renderStill({
        composition,
        serveUrl,
        output: absolute,
        frame: 0,
        inputProps,
        imageFormat: "png",
        overwrite: true,
        timeoutInMilliseconds: RENDER_TIMEOUT_MS,
      });

      rendered.push({
        set: set.name,
        file,
        absolute,
        last: index === total - 1,
        bare: (set.cards[index]?.pieces ?? []).length === 0,
      });
    }

    console.log(`  ${set.name.padEnd(12)} ${String(total)} cards in ${took(started)}`);
  }

  const captionsFile = path.join(OUT_DIR, "captions.md");
  fs.writeFileSync(captionsFile, captionsMarkdown(cta), "utf8");

  // ---- The signature ----
  const signatures = rendered.filter((row) => row.last);
  const hashes = new Map<string, string[]>();
  for (const row of signatures) {
    const digest = sha256(row.absolute);
    hashes.set(digest, [...(hashes.get(digest) ?? []), row.set]);
  }
  console.log("");
  if (hashes.size === 1) {
    const [digest] = [...hashes.keys()];
    console.log(
      `the waitlist card is byte identical across all ${String(signatures.length)} sets: sha256 ${String(digest).slice(0, 16)}`,
    );
  } else {
    console.error("");
    console.error("THE SIGNATURE CARD IS NOT ONE FILE. It has to be. Groups:");
    for (const [digest, names] of hashes) {
      console.error(`  ${digest.slice(0, 16)}  ${names.join(", ")}`);
    }
    throw new Error("The last card of every set must be byte identical.");
  }

  // ---- The luma ----
  let ffmpeg: string | null = null;
  try {
    ffmpeg = findTool("ffmpeg");
  } catch {
    ffmpeg = null;
  }

  if (ffmpeg === null) {
    console.log("");
    console.log("ffmpeg is not on PATH, so the luma table is skipped. pnpm measure prints it.");
  } else {
    console.log("");
    console.log(
      `luma, signalstats YAVG. The shipped six run ${String(SHIPPED_LUMA.min)} to ${String(SHIPPED_LUMA.max)}, mean ${String(SHIPPED_LUMA.mean)}.`,
    );
    console.log(
      `A card with an object on it belongs in ${String(LUMA_BAND.object.floor)}-${String(LUMA_BAND.object.ceiling)}; a card of bare paper and type in ${String(LUMA_BAND.bare.floor)}-${String(LUMA_BAND.bare.ceiling)}.`,
    );
    console.log("");
    const flags: string[] = [];
    const all: number[] = [];
    for (const set of SETS) {
      const rows = rendered.filter((row) => row.set === set.name);
      const values = rows.map((row) => ({
        row,
        luma: lumaOf(ffmpeg, row.absolute) ?? Number.NaN,
      }));
      for (const { row, luma } of values) {
        all.push(luma);
        // The signature is bare paper and a lockup, so it is measured against the bare band.
        const band = row.bare || row.last ? LUMA_BAND.bare : LUMA_BAND.object;
        if (luma < band.floor || luma > band.ceiling) {
          flags.push(
            `  ${row.set}/${row.file} is ${luma.toFixed(1)}, outside ${String(band.floor)}-${String(band.ceiling)} for a ${row.bare || row.last ? "bare" : "object"} card.`,
          );
        }
      }
      const mean = values.reduce((sum, entry) => sum + entry.luma, 0) / values.length;
      console.log(
        `  ${set.name.padEnd(12)} ${values.map((entry) => entry.luma.toFixed(1).padStart(6)).join("")}   mean ${mean.toFixed(1)}`,
      );
    }
    console.log("");
    console.log(
      `  batch        ${all.length} cards, ${Math.min(...all).toFixed(1)} to ${Math.max(...all).toFixed(1)}, mean ${(all.reduce((sum, value) => sum + value, 0) / all.length).toFixed(1)}`,
    );
    if (flags.length > 0) {
      console.log("");
      for (const flag of flags) {
        console.log(flag);
      }
    }
  }

  console.log("");
  console.log(rel(OUT_DIR));
  for (const set of SETS) {
    console.log(`  ${set.name}/`);
    for (const row of rendered.filter((entry) => entry.set === set.name)) {
      console.log(`    ${row.file}`);
    }
  }
  console.log("  captions.md");
};

main().catch((error: unknown) => {
  console.error(`\nrender-carousels: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
