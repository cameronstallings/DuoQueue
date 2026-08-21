import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

import { assertPhaseConfigured, CTA, PHASE, type Cta } from "../src/config/phase";
import { clips } from "../src/data/clips";
import { webpackOverride } from "../src/lib/webpack-override";
import { FRAGMENTS } from "../src/pro/media";
import type { AppTheme } from "../src/pro/theme";
import { captionsMarkdown, type SheetRow } from "../src/static/captions";
import { SIZES, type SizeName } from "../src/static/ground";
import { OBJECT } from "../src/static/plan";
import { syncAssets } from "./sync-assets";

/**
 * `pnpm static` ends with out/_static/ holding four PNGs and a captions file, and there is no
 * manual step between running it and having an uploadable post.
 *
 * It is a script rather than four CLI calls for the same reason render-carousel.ts is: the
 * webpack bundle is the expensive part, it is identical for all four sheets, and building it once
 * instead of four times is most of the run time. It also means the four files cannot be rendered
 * from different revisions of the source by accident.
 *
 * IT DOES NOT TOUCH THE DAY PIPELINE OR THE CAROUSEL. It selects the composition called `Static`,
 * writes into out/_static/, and never reads or writes state/ledger.json.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, "..");
const ENTRY = path.join(PROJECT, "src", "index.ts");
const PUBLIC_DIR = path.join(PROJECT, "public");
const FOOTAGE_DIR = path.join(PUBLIC_DIR, "footage");
const FONTS_DIR = path.join(PUBLIC_DIR, "fonts");
const NOISE = path.join(PUBLIC_DIR, "noise.png");
const OUT_DIR = path.join(PROJECT, "out", "_static");

const COMPOSITION_ID = "Static";

// Six font faces load before the first frame can be captured and the bare CLI's default
// delayRender timeout is 28s, which a cold bundle has already failed once. These are local files,
// so the ceiling is never approached in the healthy case; it only stops a slow first frame from
// being mistaken for a hang.
const RENDER_TIMEOUT_MS = 120_000;

const THEMES = ["light", "dark"] as const satisfies readonly AppTheme[];

/** Where each file goes, for the captions table. */
const PLACEMENT: Record<SizeName, string> = {
  feed: "Instagram / TikTok feed",
  story: "Instagram story, with the link sticker",
};

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
 * Every clip the sheets draw is cropped footage that is gitignored and filled by hand, and a
 * missing one renders the labelled panel instead of the app: on a video that is a visible
 * reminder, on a still it is a post that would go up with a grey rectangle in it.
 *
 * BOTH halves of the fragment table are checked, because this deliverable is a pair. Reading the
 * list off the object plan rather than off a second hand-kept list is what stops this check from
 * passing while a sheet renders the missing-footage panel.
 */
const assertFootage = (): void => {
  const wanted = new Set<string>();
  for (const piece of OBJECT) {
    for (const theme of THEMES) {
      wanted.add(clips[FRAGMENTS[piece.piece][theme]].file);
    }
  }
  const missing = [...wanted].filter((file) => !fs.existsSync(path.join(FOOTAGE_DIR, file)));
  if (missing.length > 0) {
    throw new Error(
      [
        "The static ads need footage that is not on this disk:",
        ...missing.map((file) => `  public/footage/${file}`),
        "Run the crops in public/footage/README.md, or sync the folder.",
      ].join("\n"),
    );
  }
};

const took = (fromMs: number): string => `${((Date.now() - fromMs) / 1000).toFixed(1)}s`;

const main = async (): Promise<void> => {
  // The call to action, before anything else. Four finished sheets with a placeholder link on
  // them is the expensive failure this check exists for.
  assertPhaseConfigured();
  const cta: Cta = CTA[PHASE];

  ensureAssets();
  assertFootage();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const bundleStarted = Date.now();
  const serveUrl = await bundle({ entryPoint: ENTRY, publicDir: PUBLIC_DIR, webpackOverride });
  console.log(`bundled in ${took(bundleStarted)}`);

  const rows: SheetRow[] = [];
  for (const size of SIZES) {
    for (const theme of THEMES) {
      const inputProps = { size, theme, cta };
      const file = `${size}-${theme}.png`;
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

      rows.push({ file, size, theme, where: PLACEMENT[size] });
      console.log(`  ${file} in ${took(started)}`);
    }
  }

  const captionsFile = path.join(OUT_DIR, "captions.md");
  fs.writeFileSync(captionsFile, captionsMarkdown(cta, rows), "utf8");

  console.log("");
  console.log(rel(OUT_DIR));
  for (const row of rows) {
    console.log(`  ${row.file}`);
  }
  console.log("  captions.md");
};

main().catch((error: unknown) => {
  console.error(`\nrender-static: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
