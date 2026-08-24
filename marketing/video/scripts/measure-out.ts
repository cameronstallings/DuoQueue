import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MIX_TARGET } from "../src/audio/mix";
import { findTool } from "./build-audio";

/**
 * `pnpm measure` prints what actually came out of the renderer, off the files rather than off the
 * source that made them.
 *
 * =====================================================================================
 * THE THREE NUMBERS, AND WHY EACH ONE IS HERE
 * =====================================================================================
 *
 * MEAN LUMA, as ffmpeg's signalstats YAVG averaged over sampled frames. This is the gate that has
 * already earned its place: a batch of this campaign once came back at 19, which is a film that
 * rendered essentially black, and the number caught it before it went anywhere. The measured
 * references are Uber at 194 and ClickUp at 223, and this campaign's own approved file is printed
 * beside every row so the comparison is against the thing Cameron actually chose rather than
 * against two reels from somebody else's brand.
 *
 * RUNTIME, in frames and seconds, off the container. `render-angles.ts` already asserts the
 * rendered frame count against the one the read derives; this reads the finished file, which is
 * the only thing that can catch a container that disagrees with the renderer.
 *
 * LOUDNESS, as loudnorm's own analysis, which is the same measurement `build-audio.ts` records
 * into src/audio/timings.generated.ts. Measuring the MP4 rather than the WAV is the point: the
 * WAV was measured before the muxer touched it, and the file that goes up is this one.
 *
 * A STILL GETS THE LUMA COLUMN ONLY, because a PNG has no clock and no sound. It is measured
 * through exactly the same filter as a frame of film.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, "..");
const OUT = path.join(PROJECT, "out");

/** Every Nth frame. 5 at 30fps is six samples a second, which is far more than a mean needs and
 * cheap enough that nobody is tempted to skip the check. */
const EVERY = 5;

/** The approved direction, printed beside the batch on every run. It is not an assertion, it is
 * the only honest reference: the band 194-223 comes from two reels of somebody else's brand on
 * somebody else's ground, and this campaign's own light ground sits above the top of it. */
const REFERENCE = path.join(OUT, "_directions", "pro-a-light.mp4");

const FFMPEG = findTool("ffmpeg");
const FFPROBE = findTool("ffprobe");

const run = (file: string, args: string[]): string => {
  const result = spawnSync(file, args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (result.error) {
    throw result.error;
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
};

interface Clock {
  frames: number;
  seconds: number;
  fps: number;
}

const clockOf = (file: string): Clock => {
  const out = run(FFPROBE, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=nb_frames,r_frame_rate",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1",
    file,
  ]);
  const frames = Number(/nb_frames=(\d+)/.exec(out)?.[1] ?? "0");
  const seconds = Number(/duration=([\d.]+)/.exec(out)?.[1] ?? "0");
  const rate = /r_frame_rate=(\d+)\/(\d+)/.exec(out);
  const fps = rate === null ? 0 : Number(rate[1]) / Number(rate[2]);
  return { frames, seconds, fps };
};

interface Luma {
  mean: number;
  samples: number;
  min: number;
  max: number;
}

/**
 * signalstats YAVG, averaged. The select is what makes it "sampled"; without it this reads every
 * frame, which gives the same answer to within a fifth of a unit and takes five times as long.
 */
const lumaOf = (file: string, every: number): Luma => {
  const filter =
    every > 1
      ? `select='not(mod(n\\,${String(every)}))',signalstats,metadata=print:file=-`
      : "signalstats,metadata=print:file=-";
  const out = run(FFMPEG, ["-hide_banner", "-nostdin", "-v", "error", "-i", file, "-an", "-vf", filter, "-f", "null", "-"]);
  const values = [...out.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)].map((match) =>
    Number(match[1]),
  );
  if (values.length === 0) {
    throw new Error(`signalstats returned nothing for ${file}`);
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    mean: total / values.length,
    samples: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

interface Loudness {
  lufs: number;
  truePeak: number;
  lra: number;
}

/** loudnorm's own analysis of the finished container, which is the same measurement the mix was
 * normalised against and recorded with. */
const loudnessOf = (file: string): Loudness | null => {
  const out = run(FFMPEG, [
    "-hide_banner",
    "-nostdin",
    "-v",
    "info",
    "-i",
    file,
    "-af",
    "loudnorm=print_format=json",
    "-f",
    "null",
    "-",
  ]);
  const json = /\{[^{}]*"input_i"[\s\S]*?\}/.exec(out);
  if (json === null) {
    return null;
  }
  const parsed = JSON.parse(json[0]) as Record<string, string>;
  return {
    lufs: Number(parsed.input_i),
    truePeak: Number(parsed.input_tp),
    lra: Number(parsed.input_lra),
  };
};

const pad = (text: string, width: number): string => text.padEnd(width);
const num = (value: number, digits: number, width: number): string =>
  value.toFixed(digits).padStart(width);

const videosIn = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".mp4"))
        .sort()
        .map((file) => path.join(dir, file))
    : [];

const stillsIn = (dir: string, match: RegExp): string[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((file) => match.test(file))
        .sort()
        .map((file) => path.join(dir, file))
    : [];

const main = (): void => {
  const args = process.argv.slice(2);
  const explicit = args.filter((arg) => !arg.startsWith("--"));

  const videos =
    explicit.length > 0
      ? explicit.filter((file) => file.endsWith(".mp4"))
      : videosIn(path.join(OUT, "_reels"));
  /**
   * The covers are measured beside the sheets, because a cover is a still that ships. It is also
   * the only still in this batch a stranger is guaranteed to see: the reel autoplays or it does
   * not, but the cover sits in the profile grid either way.
   */
  const stills =
    explicit.length > 0
      ? explicit.filter((file) => file.endsWith(".png"))
      : [
          ...stillsIn(path.join(OUT, "_static"), /^feed-.*-light\.png$/),
          ...stillsIn(path.join(OUT, "_reels"), /^reel-.*-cover\.png$/),
        ];

  const reference = fs.existsSync(REFERENCE) && !explicit.includes(REFERENCE) ? REFERENCE : null;

  console.log(`ffmpeg   ${FFMPEG}`);
  console.log(`sampling every ${String(EVERY)} frames`);
  console.log("");

  if (videos.length > 0 || reference !== null) {
    console.log(
      `${pad("file", 26)}${pad("frames", 8)}${pad("seconds", 9)}${pad("luma", 8)}${pad("min", 7)}${pad("max", 7)}${pad("LUFS", 8)}${pad("dBTP", 8)}LRA`,
    );
    for (const file of [...(reference === null ? [] : [REFERENCE]), ...videos]) {
      const clock = clockOf(file);
      const luma = lumaOf(file, EVERY);
      const loud = loudnessOf(file);
      const name = path.basename(file) + (file === REFERENCE ? "  (reference)" : "");
      console.log(
        pad(name, 26) +
          pad(String(clock.frames), 8) +
          pad(clock.seconds.toFixed(2), 9) +
          pad(luma.mean.toFixed(1), 8) +
          pad(luma.min.toFixed(0), 7) +
          pad(luma.max.toFixed(0), 7) +
          (loud === null
            ? pad("-", 8) + pad("-", 8) + "-"
            : num(loud.lufs, 1, 6) + "  " + num(loud.truePeak, 1, 6) + "  " + loud.lra.toFixed(1)),
      );
      if (loud !== null) {
        const band = Math.abs(loud.lufs - MIX_TARGET.lufs) > 1;
        const peak = loud.truePeak > -1;
        if (band || peak) {
          console.log(
            `  ${band ? `LOUDNESS is ${loud.lufs.toFixed(1)} against a target of ${String(MIX_TARGET.lufs)}. ` : ""}${peak ? `TRUE PEAK is ${loud.truePeak.toFixed(1)} dBTP, over the -1 ceiling.` : ""}`,
          );
        }
      }
    }
    console.log("");
  }

  if (stills.length > 0) {
    console.log(`${pad("still", 26)}luma`);
    for (const file of stills) {
      const luma = lumaOf(file, 1);
      console.log(pad(path.basename(file), 26) + luma.mean.toFixed(1));
    }
    console.log("");
  }

  console.log("Mean luma is signalstats YAVG averaged over the sampled frames. The two measured");
  console.log("references are Uber 194 and ClickUp 223, on their own grounds; this campaign's own");
  console.log("approved file is the row marked (reference) and is the number a new reel has to");
  console.log("look like, because it is the one that was chosen out of eleven.");
};

main();
