import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

import { captionsMarkdown } from "../src/carousel/captions";
import { CARD_COUNT, CARDS, PIECES, WAITLIST_LABEL } from "../src/carousel/plan";
import { assertPhaseConfigured, CTA, PHASE, type Cta } from "../src/config/phase";
import { clips } from "../src/data/clips";
import { webpackOverride } from "../src/lib/webpack-override";
import { syncAssets } from "./sync-assets";

/**
 * `pnpm carousel` ends with out/_carousel/ holding six numbered PNGs and a captions file, and
 * there is no manual step between running it and having an uploadable post.
 *
 * It is a script rather than six CLI calls for the same reason render-day.ts is: the webpack
 * bundle is the expensive part, it is identical for all six cards, and building it once
 * instead of six times is most of the run time.
 *
 * IT DOES NOT TOUCH THE DAY PIPELINE. It selects the composition called `Carousel`, writes
 * into a folder that is not a dated day folder, and never reads or writes state/ledger.json.
 * `pnpm video:day` is unaffected by anything in this file.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, "..");
const ENTRY = path.join(PROJECT, "src", "index.ts");
const PUBLIC_DIR = path.join(PROJECT, "public");
const FOOTAGE_DIR = path.join(PUBLIC_DIR, "footage");
const FONTS_DIR = path.join(PUBLIC_DIR, "fonts");
const NOISE = path.join(PUBLIC_DIR, "noise.png");
const OUT_DIR = path.join(PROJECT, "out", "_carousel");

const COMPOSITION_ID = "Carousel";

// Six font faces load before the first frame can be captured and the default delayRender
// timeout is 28s, which a cold bundle has already failed once. These are local files, so the
// ceiling is never approached in the healthy case; it only stops a slow first frame from
// being mistaken for a hang.
const RENDER_TIMEOUT_MS = 120_000;

/** Paths are printed the way Cameron would type them, from the repo root. */
const rel = (absolute: string): string =>
  path.relative(path.resolve(PROJECT, "..", ".."), absolute).split(path.sep).join("/");

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

/** The label, as a filename. The number in front of it is what the upload picker sorts on;
 * the words after it are what a human recognises the file by. */
const fileFor = (index: number): string => {
  const label = CARDS[index]?.label ?? WAITLIST_LABEL;
  return `${String(index + 1).padStart(2, "0")}-${label.replace(/\s+/g, "-")}.png`;
};

const took = (fromMs: number): string => `${((Date.now() - fromMs) / 1000).toFixed(1)}s`;

const main = async (): Promise<void> => {
  // The call to action, before anything else. Six finished cards with a placeholder link on
  // the last one is the expensive failure this check exists for.
  assertPhaseConfigured();
  const cta: Cta = CTA[PHASE];

  ensureAssets();

  // Every clip the cards draw is cropped footage that is gitignored and filled by hand. A
  // missing file renders the labelled panel instead of the app, which on a video is a visible
  // reminder and on a still is a post that would go up with a grey rectangle in it.
  const missing = [
    ...new Set(Object.values(PIECES).map((piece) => clips[piece.clip].file)),
  ].filter((file) => !fs.existsSync(path.join(FOOTAGE_DIR, file)));
  if (missing.length > 0) {
    throw new Error(
      [
        "The carousel needs footage that is not on this disk:",
        ...missing.map((file) => `  public/footage/${file}`),
        "Run the crops in public/footage/README.md, or sync the folder.",
      ].join("\n"),
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bundleStarted = Date.now();
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR, webpackOverride });
  console.log(`bundled in ${took(bundleStarted)}`);

  const files: string[] = [];
  for (let index = 0; index < CARD_COUNT; index += 1) {
    const inputProps = { index, cta };
    const file = fileFor(index);
    const started = Date.now();

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    });

    await renderStill({
      composition,
      serveUrl,
      output: path.join(OUT_DIR, file),
      frame: 0,
      inputProps,
      imageFormat: "png",
      overwrite: true,
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    });

    files.push(file);
    console.log(`  ${file} in ${took(started)}`);
  }

  const captionsFile = path.join(OUT_DIR, "captions.md");
  fs.writeFileSync(captionsFile, captionsMarkdown(cta, files), "utf8");

  console.log("");
  console.log(rel(OUT_DIR));
  for (const file of files) {
    console.log(`  ${file}`);
  }
  console.log("  captions.md");
};

main().catch((error: unknown) => {
  console.error(`\nrender-carousel: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
