import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { CTA } from "./src/config/phase";
import { hooks } from "./src/data/hooks";
import { webpackOverride } from "./src/lib/webpack-override";

const PROJECT = process.cwd();
const hook = hooks.find((h) => h.id === "reframe-001")!;
const inputProps = { hook, cta: CTA.waitlist };

const variant = process.argv[2] ?? "concurrency4";

const run = async () => {
  const serveUrl = await bundle({
    entryPoint: path.join(PROJECT, "src", "index.ts"),
    publicDir: path.join(PROJECT, "public"),
    webpackOverride,
  });
  const composition = await selectComposition({ serveUrl, id: "Post", inputProps });
  console.log("variant:", variant, "frames:", composition.durationInFrames);

  const base = {
    composition,
    serveUrl,
    codec: "h264" as const,
    outputLocation: path.join(PROJECT, "out", `_probe-${variant}.mp4`),
    inputProps,
    overwrite: true,
    onProgress: (p: { renderedFrames: number; encodedFrames: number; progress: number }) => {
      if (p.renderedFrames % 40 === 0 || p.encodedFrames % 100 === 0) {
        console.log(
          `  rendered ${p.renderedFrames} encoded ${p.encodedFrames} progress ${(p.progress * 100).toFixed(0)}%`,
        );
      }
    },
  };

  if (variant === "concurrency4") {
    await renderMedia({
      ...base,
      muted: true,
      enforceAudioTrack: true,
      imageFormat: "jpeg",
      jpegQuality: 90,
      concurrency: 4,
    });
  } else if (variant === "nodefaults") {
    await renderMedia({ ...base });
  } else if (variant === "muted") {
    await renderMedia({ ...base, muted: true, enforceAudioTrack: true });
  } else if (variant === "jpeg") {
    await renderMedia({ ...base, imageFormat: "jpeg", jpegQuality: 90 });
  } else if (variant === "conc4only") {
    await renderMedia({ ...base, concurrency: 4 });
  } else if (variant === "conc4log") {
    await renderMedia({
      ...base,
      concurrency: 4,
      onBrowserLog: (log) => console.log(`  [browser ${log.type}] ${log.text}`),
    });
  } else if (variant === "conc4timeout") {
    await renderMedia({ ...base, concurrency: 4, timeoutInMilliseconds: 300000 });
  } else if (variant === "conc10") {
    await renderMedia({ ...base, concurrency: 10 });
  } else {
    throw new Error(`unknown variant ${variant}`);
  }
  console.log("OK", variant);
};

run().catch((e) => {
  console.error("FAILED", variant, (e as Error).message.split("\n")[0]);
  process.exit(1);
});
