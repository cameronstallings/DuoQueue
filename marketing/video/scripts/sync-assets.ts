import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Walks up from this file rather than from cwd, so the script behaves identically whether it
 * runs as `pnpm assets:sync` inside marketing/video, as `pnpm --dir marketing/video assets:sync`
 * from the repo root, or as a function call from the batch render.
 *
 * (src/lib/webpack-override.ts deliberately does the opposite and anchors on cwd: the Remotion
 * CLI bundles that module to CJS in memory and eval()s it, which empties import.meta. Nothing
 * bundles this one; it only ever runs under tsx.) */
const findRepoRoot = (): string => {
  let dir = here;
  for (;;) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find pnpm-workspace.yaml above ${here}, so the DuoQueue repo root is unknown.`,
      );
    }
    dir = parent;
  }
};

const GOOGLE_FONTS = "node_modules/@expo-google-fonts";

/** Six of the app's eight token faces: Unbounded 700 for hero type, Manrope 500/700/800 for
 * body, calls to action and hooks, Plex Mono 500/600 for the machine voice. The other two
 * (`semibold`, `display`) are real in the app but no video component reaches for them, and
 * every face here is a quarter-megabyte the browser has to decode before frame 0 can be
 * captured.
 *
 * Sources are the repo's own install, never a download: the video is then typographically the
 * same build as the App Store binary, and there is no second copy to drift.
 *
 * `to` is relative to marketing/video/public/, which is gitignored precisely because this
 * script reproduces it in under a second. */
const ASSETS: readonly { from: string; to: string }[] = [
  { from: `${GOOGLE_FONTS}/unbounded/700Bold/Unbounded_700Bold.ttf`, to: "fonts/Unbounded_700Bold.ttf" },
  { from: `${GOOGLE_FONTS}/manrope/500Medium/Manrope_500Medium.ttf`, to: "fonts/Manrope_500Medium.ttf" },
  { from: `${GOOGLE_FONTS}/manrope/700Bold/Manrope_700Bold.ttf`, to: "fonts/Manrope_700Bold.ttf" },
  { from: `${GOOGLE_FONTS}/manrope/800ExtraBold/Manrope_800ExtraBold.ttf`, to: "fonts/Manrope_800ExtraBold.ttf" },
  { from: `${GOOGLE_FONTS}/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf`, to: "fonts/IBMPlexMono_500Medium.ttf" },
  { from: `${GOOGLE_FONTS}/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf`, to: "fonts/IBMPlexMono_600SemiBold.ttf" },
  { from: "apps/mobile/assets/noise.png", to: "noise.png" },
];

/** Throws with the exact missing paths rather than exiting, so the batch render can catch it
 * and say something useful instead of dying inside a child process. */
export const syncAssets = (): void => {
  const repoRoot = findRepoRoot();
  const publicDir = path.resolve(here, "..", "public");

  // Every source is checked before anything is copied, so a failed sync can never leave a
  // public/ that looks complete enough for a render to start and then picks a fallback face.
  const missing = ASSETS.map((asset) => path.join(repoRoot, asset.from)).filter(
    (source) => !fs.existsSync(source),
  );
  if (missing.length > 0) {
    throw new Error(
      [
        "sync-assets: missing source file(s):",
        ...missing.map((source) => `  ${source}`),
        `All of these come from the root install. Run \`pnpm install\` in ${repoRoot} first.`,
      ].join("\n"),
    );
  }

  for (const asset of ASSETS) {
    const source = path.join(repoRoot, asset.from);
    const destination = path.join(publicDir, asset.to);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
    const kb = Math.round(fs.statSync(destination).size / 1024);
    console.log(`  public/${asset.to}  ${kb} KB`);
  }

  console.log(`sync-assets: copied ${ASSETS.length} files into ${publicDir}`);
};

// Runs as a script, but stays importable so the batch render can guarantee the assets exist
// without paying for a second node process.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    syncAssets();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
