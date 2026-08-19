import { loadFont } from "@remotion/fonts";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";
import { fonts } from "@app/theme/tokens";

// Family names are the token values verbatim ("Unbounded_700Bold", "IBMPlexMono_500Medium", ...)
// so a component can write `fontFamily: fonts.mono` and get the same string the app uses.
// Files come from scripts/sync-assets.ts, which copies them out of the repo's own install.
const FACES = [
  { token: "displayBold", family: fonts.displayBold, file: "Unbounded_700Bold.ttf", weight: "700" },
  { token: "extrabold", family: fonts.extrabold, file: "Manrope_800ExtraBold.ttf", weight: "800" },
  { token: "bold", family: fonts.bold, file: "Manrope_700Bold.ttf", weight: "700" },
  { token: "medium", family: fonts.medium, file: "Manrope_500Medium.ttf", weight: "500" },
  { token: "monoSemibold", family: fonts.monoSemibold, file: "IBMPlexMono_600SemiBold.ttf", weight: "600" },
  { token: "mono", family: fonts.mono, file: "IBMPlexMono_500Medium.ttf", weight: "500" },
] as const satisfies readonly {
  token: keyof typeof fonts;
  family: string;
  file: string;
  weight: string;
}[];

export type FontToken = (typeof FACES)[number]["token"];

/** The video's typographic surface, keyed by the app's own token names so that renaming a
 * face in tokens.ts breaks this file rather than silently shipping a fallback.
 *
 * It is six keys, not the app's eight: `semibold` and `display` are real on device but no
 * format calls for them, and sync-assets.ts does not copy them, so leaving them out here
 * turns "face was never loaded" into a type error at the call site instead of a wrong typeface
 * in a finished cut. Adding one means adding it in both places; the `satisfies` below and the
 * one in ASSETS keep the two lists honest. */
export const FONT_FAMILY = {
  displayBold: fonts.displayBold,
  extrabold: fonts.extrabold,
  bold: fonts.bold,
  medium: fonts.medium,
  monoSemibold: fonts.monoSemibold,
  mono: fonts.mono,
} as const satisfies Record<FontToken, string>;

const handle = delayRender("Loading the DuoQueue brand faces");

/** loadFont() opens a delayRender handle of its own per face, so this outer one is not the only
 * thing holding the render back. It exists so the pipeline has a single promise to await and a
 * single name in the timeout message when public/fonts/ is empty (the fix is `pnpm assets:sync`).
 *
 * Skipping the delay entirely is the failure worth naming: Remotion captures frames while the
 * faces are still decoding, the layout comes out right, and the video simply ships in Chromium's
 * fallback sans. That is easy to miss until it is on a store listing. */
export const fontsReady: Promise<void> = Promise.all(
  FACES.map((face) =>
    loadFont({
      family: face.family,
      url: staticFile(`fonts/${face.file}`),
      weight: face.weight,
      style: "normal",
    }),
  ),
)
  .then(() => {
    continueRender(handle);
  })
  .catch((err: unknown) => {
    // Without this branch a rejected load leaves the handle open forever, and the render dies
    // on the delayRender timeout instead: a message that names this handle and says nothing
    // about which face failed or why. That happened once already and cost a render cycle to
    // diagnose. cancelRender fails immediately and carries the real error, which is nearly
    // always a file missing from public/fonts (the fix being `pnpm assets:sync`).
    cancelRender(err instanceof Error ? err : new Error(String(err)));
  });
