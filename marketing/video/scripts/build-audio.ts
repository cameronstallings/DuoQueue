import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BED_FADE,
  BED_GAIN_DB,
  CARVE_BANDS,
  DUCK,
  MIX_TARGET,
  VOICE_CHAIN,
  VOICE_TARGET_LUFS,
} from "../src/audio/mix";
import type { AudioLine, MixLoudness, PostAudio } from "../src/audio/timings";
import { GAP_FRAMES, LEAD_IN_FRAMES, voPlanFor, type VoPlan } from "../src/audio/vo";
import { hooks } from "../src/data/hooks";
import { KINETIC_NATIVE } from "../src/kinetic-native/script";
import { voPlanForKineticNative } from "../src/kinetic-native/vo";
import { postDuration } from "../src/lib/duration";
import { FPS } from "../src/lib/scale";

/**
 * THE AUDIO PATH. `pnpm video:audio` from the repo root ends with a finished, loudness
 * verified mix per post and a committed table of when every line is actually said.
 *
 * The doctrine's rule for this build is that AUDIO IS THE CLOCK: the voiceover is generated
 * first and the visuals are cut to it, never the other way round. That rule is only worth
 * anything if the clock is measured rather than assumed, so nothing here estimates a
 * duration. Every phrase is synthesised on its own and measured with ffprobe; every mix is
 * measured with ffmpeg loudnorm after it has been written, and the numbers that come back are
 * what land in the committed table.
 *
 * THE ORDER, and each step is placed so that a way this can fail does so before the expensive
 * part:
 *
 *   1. find ffmpeg, ffprobe and the TTS command, and print which was found where
 *   2. derive the read from the post's own copy (src/audio/vo.ts), so the two cannot drift
 *   3. synthesise each phrase, or take it from the cache
 *   4. measure each phrase and lay the track out
 *   5. anchor the voice to a known loudness with a static gain
 *   6. carve and duck the bed under it, then sum
 *   7. two pass linear loudnorm to -14 LUFS, then MEASURE THE RESULT and record it
 *   8. rewrite src/audio/timings.generated.ts
 *
 * THE CACHE is per phrase, keyed on the text, the voice, the speed and a model tag. A hook
 * whose second line is edited re-synthesises that one line and reuses the rest, and
 * re-rendering a day never re-runs TTS at all. `--force` bypasses it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(here, "..");
const REPO = path.resolve(PROJECT, "..", "..");
const PUBLIC_DIR = path.join(PROJECT, "public");
const AUDIO_DIR = path.join(PUBLIC_DIR, "audio");
const MIX_DIR = path.join(AUDIO_DIR, "mix");
const BED = path.join(AUDIO_DIR, "bed-01.mp3");
/** Outside public/, because only the finished mix needs to be a static asset. Every phrase
 * WAV in here would otherwise land in the bundler's manifest for no reason at all. */
const CACHE_DIR = path.join(PROJECT, ".audio-cache");
/** What has been measured so far, so `--only` can rewrite one post's row without blanking
 * every other post's clock. The generated module is emitted from this, never parsed back. */
const STORE = path.join(CACHE_DIR, "timings.json");
const WORK_DIR = path.join(PROJECT, "out", "_audio");
const GENERATED = path.join(PROJECT, "src", "audio", "timings.generated.ts");

/** Part of every cache key, and the only thing that invalidates the whole cache. Bump it when
 * the voice model or the CLI changes in a way that changes the samples. */
const MODEL_TAG = "kokoro-82m-hyperframes-0.8.4";
const SPEED = 1;

const rel = (absolute: string): string => path.relative(REPO, absolute).split(path.sep).join("/");

// ---- Tools ----

/** The WinGet install on this machine. ffmpeg 9.0 is not on the default PATH here, and a
 * script that only works when somebody remembered to export it is a script that fails in the
 * morning. PATH first, this second, FFMPEG_DIR overriding both. */
const FFMPEG_FALLBACK = path.join(
  os.homedir(),
  "AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin",
);

const exeName = (tool: string): string => (process.platform === "win32" ? `${tool}.exe` : tool);

const onPath = (tool: string): string | null => {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, exeName(tool));
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const findTool = (tool: string): string => {
  const override = process.env.FFMPEG_DIR;
  if (override !== undefined && override !== "") {
    const candidate = path.join(override, exeName(tool));
    if (!fs.existsSync(candidate)) {
      throw new Error(`FFMPEG_DIR is ${override} but ${exeName(tool)} is not in it.`);
    }
    return candidate;
  }
  const found = onPath(tool) ?? path.join(FFMPEG_FALLBACK, exeName(tool));
  if (!fs.existsSync(found)) {
    throw new Error(
      `${tool} is not on PATH and not at ${FFMPEG_FALLBACK}. Install ffmpeg, or point FFMPEG_DIR at the directory holding it.`,
    );
  }
  return found;
};

interface Ran {
  status: number;
  stdout: string;
  stderr: string;
}

const run = (file: string, args: string[]): Ran => {
  const result = spawnSync(file, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error) {
    throw result.error;
  }
  return { status: result.status ?? -1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

let FFMPEG = "";
let FFPROBE = "";

const ffmpeg = (args: string[], what: string): string => {
  const ran = run(FFMPEG, ["-hide_banner", "-nostdin", "-y", ...args]);
  if (ran.status !== 0) {
    throw new Error(
      `ffmpeg failed while ${what} (exit ${String(ran.status)}):\n${ran.stderr.slice(-4000)}`,
    );
  }
  return ran.stderr;
};

/** Seconds, off the stream, to the microsecond. Every position in the finished table is a sum
 * of these, so this is the measurement the whole clock stands on. */
const durationOf = (file: string): number => {
  const ran = run(FFPROBE, [
    "-v", "error",
    "-select_streams", "a:0",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  const seconds = Number(ran.stdout.trim());
  if (ran.status !== 0 || !Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`ffprobe could not measure ${rel(file)}:\n${ran.stderr.slice(-2000)}`);
  }
  return seconds;
};

// ---- Loudness ----

interface Measured {
  inputI: number;
  inputTp: number;
  inputLra: number;
  inputThresh: number;
  targetOffset: number;
}

const numberField = (blob: Record<string, unknown>, key: string): number => {
  const value = Number(blob[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`loudnorm reported no usable ${key} (got ${String(blob[key])}).`);
  }
  return value;
};

const loudnormArgs = (extra: string[]): string =>
  [
    `loudnorm=I=${String(MIX_TARGET.lufs)}`,
    `TP=${String(MIX_TARGET.truePeakDb)}`,
    `LRA=${String(MIX_TARGET.lra)}`,
    ...extra,
  ].join(":");

/** loudnorm's analysis pass. It writes its JSON to stderr after everything else it has to
 * say, so the last brace block in the stream is the one to read. */
const measure = (file: string): Measured => {
  const stderr = ffmpeg(
    ["-i", file, "-af", loudnormArgs(["print_format=json"]), "-f", "null", "-"],
    `measuring ${rel(file)}`,
  );
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`loudnorm printed no JSON for ${rel(file)}:\n${stderr.slice(-2000)}`);
  }
  const blob = JSON.parse(stderr.slice(start, end + 1)) as Record<string, unknown>;
  return {
    inputI: numberField(blob, "input_i"),
    inputTp: numberField(blob, "input_tp"),
    inputLra: numberField(blob, "input_lra"),
    inputThresh: numberField(blob, "input_thresh"),
    targetOffset: numberField(blob, "target_offset"),
  };
};

/**
 * The summary the brief asks to see quoted, read back off the FINISHED file.
 *
 * Not taken from the mastering pass's own report. That pass prints what it INTENDED, and the
 * only number worth printing is the one that is actually in the WAV. Measuring the output as
 * a fresh input is the difference between a claim and a check.
 */
const verify = (file: string): { loudness: MixLoudness; summary: string } => {
  const stderr = ffmpeg(
    ["-i", file, "-af", loudnormArgs(["print_format=summary"]), "-f", "null", "-"],
    `verifying ${rel(file)}`,
  );
  const lines = stderr
    .split(/\r?\n/)
    .filter((line) => /^\s*Input (Integrated|True Peak|LRA|Threshold):/.test(line));
  const field = (label: string): number => {
    const line = lines.find((candidate) => candidate.includes(`Input ${label}:`));
    const value = Number(
      line?.replace(/^[^:]*:/, "").replace(/LUFS|dBTP|LU/g, "").trim(),
    );
    if (!Number.isFinite(value)) {
      throw new Error(`loudnorm's summary for ${rel(file)} had no Input ${label}.`);
    }
    return value;
  };
  return {
    loudness: {
      integratedLufs: field("Integrated"),
      truePeakDb: field("True Peak"),
      lra: field("LRA"),
    },
    summary: lines.map((line) => line.trim()).join("\n    "),
  };
};

// ---- TTS ----

/** `npx.cmd` is a batch file and Node refuses to spawn one without a shell, so this path goes
 * through cmd.exe. The phrase itself is written to a .txt file rather than passed as an
 * argument, which the CLI supports and which takes every quoting question off the table. */
const ttsCommand = (): string[] => {
  const override = process.env.HYPERFRAMES_CMD;
  if (override !== undefined && override !== "") {
    return override.split(" ");
  }
  return [process.platform === "win32" ? "npx.cmd" : "npx", "--yes", "hyperframes@latest"];
};

const PYTHON_FALLBACK = path.join(
  os.homedir(),
  "AppData/Local/Programs/Python/Python312/python.exe",
);

/** The CLI runs Kokoro in a Python 3.12 and will not find one by itself on this machine. */
const ttsPython = (): string => {
  const set = process.env.HYPERFRAMES_PYTHON;
  if (set !== undefined && set !== "" && fs.existsSync(set)) {
    return set;
  }
  if (fs.existsSync(PYTHON_FALLBACK)) {
    return PYTHON_FALLBACK;
  }
  throw new Error(
    `HYPERFRAMES_PYTHON is not set to a Python 3.12 and none was found at ${PYTHON_FALLBACK}. Set it and re-run.`,
  );
};

const quoted = (value: string): string => `"${value}"`;

const synthesise = (spoken: string, voice: string, output: string): void => {
  const textFile = path.join(WORK_DIR, `tts-${crypto.randomBytes(6).toString("hex")}.txt`);
  fs.writeFileSync(textFile, spoken, "utf8");
  try {
    const command = [
      ...ttsCommand(),
      "tts",
      quoted(textFile),
      "--voice", voice,
      "--speed", String(SPEED),
      "--json",
      "--output", quoted(output),
    ].join(" ");
    const ran = spawnSync(command, {
      shell: true,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, HYPERFRAMES_PYTHON: ttsPython() },
    });
    if (ran.error) {
      throw ran.error;
    }
    if ((ran.status ?? -1) !== 0 || !fs.existsSync(output)) {
      const out = `${ran.stdout ?? ""}\n${ran.stderr ?? ""}`;
      throw new Error(
        `TTS failed for "${spoken}" (exit ${String(ran.status)}):\n${out.slice(-3000)}`,
      );
    }
  } finally {
    fs.rmSync(textFile, { force: true });
  }
};

// ---- The cache ----

const cacheKey = (spoken: string, voice: string): string =>
  crypto
    .createHash("sha256")
    .update(`${MODEL_TAG}|${voice}|${String(SPEED)}|${spoken}`)
    .digest("hex")
    .slice(0, 16);

interface Phrase {
  written: string;
  spoken: string;
  file: string;
  seconds: number;
  fromCache: boolean;
}

const phrasesFor = (plan: VoPlan, force: boolean): Phrase[] =>
  plan.lines.map((line) => {
    const file = path.join(CACHE_DIR, `${plan.voice}-${cacheKey(line.spoken, plan.voice)}.wav`);
    const hit = !force && fs.existsSync(file) && fs.statSync(file).size > 1024;
    if (!hit) {
      synthesise(line.spoken, plan.voice, file);
    }
    return { ...line, file, seconds: durationOf(file), fromCache: hit };
  });

// ---- Laying the track out ----

const dbToLinear = (db: number): number => 10 ** (db / 20);
const round3 = (value: number): number => Number(value.toFixed(3));

interface Laid {
  lines: AudioLine[];
  voEndSeconds: number;
}

/**
 * Where each line actually lands.
 *
 * This is the clock the doctrine means, and nothing in it is a slot a read was squeezed into.
 * The lead in and the gap are authored; every phrase length is measured; the start of line
 * four is the sum of what really came before it. A hook edited tomorrow moves these numbers
 * and the cut has to follow them, which is the whole point of writing them down.
 */
const layOut = (phrases: Phrase[]): Laid => {
  let at = LEAD_IN_FRAMES / FPS;
  const lines: AudioLine[] = phrases.map((phrase, index) => {
    const startSeconds = at;
    const endSeconds = at + phrase.seconds;
    at = endSeconds + (index === phrases.length - 1 ? 0 : GAP_FRAMES / FPS);
    return {
      written: phrase.written,
      spoken: phrase.spoken,
      startSeconds: round3(startSeconds),
      endSeconds: round3(endSeconds),
      startFrame: Math.round(startSeconds * FPS),
      endFrame: Math.round(endSeconds * FPS),
    };
  });
  return { lines, voEndSeconds: at };
};

// ---- The voice stem ----

/**
 * Delay each phrase to its measured position, sum them, clean the result, then hold the whole
 * read at a known loudness.
 *
 * `amix` with `normalize=0` is why this is one graph rather than a concat: the default
 * divides every input by the number of inputs, which would leave a five line read about 8dB
 * quieter than a two line one for no reason a listener could explain. The phrases never
 * overlap, so a straight sum is exact.
 *
 * The anchor at the end is a STATIC gain and not a second normaliser. The read's own dynamics
 * are the performance; a compressor here would flatten what the voice is doing, and a dynamic
 * loudnorm would ride it.
 */
const buildVoice = (plan: VoPlan, phrases: Phrase[], laid: Laid, voFile: string): number => {
  const inputs = phrases.flatMap((phrase) => ["-i", phrase.file]);
  const total = laid.voEndSeconds.toFixed(3);
  const compressor = VOICE_CHAIN.compressor;

  const graph = [
    ...phrases.map((_, index) => {
      const at = laid.lines[index]?.startSeconds ?? 0;
      return `[${String(index)}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${String(Math.round(at * 1000))}:all=1[p${String(index)}]`;
    }),
    `${phrases.map((_, index) => `[p${String(index)}]`).join("")}amix=inputs=${String(phrases.length)}:normalize=0:duration=longest[sum]`,
    [
      `[sum]highpass=f=${String(VOICE_CHAIN.highpassHz)}`,
      `acompressor=threshold=${dbToLinear(compressor.thresholdDb).toFixed(6)}:ratio=${String(compressor.ratio)}:attack=${String(compressor.attackMs)}:release=${String(compressor.releaseMs)}`,
      `apad=whole_dur=${total}`,
      `atrim=0:${total}`,
      "asetpts=N/SR/TB[raw]",
    ].join(","),
  ].join(";");

  const raw = path.join(WORK_DIR, `${plan.id}-vo-raw.wav`);
  ffmpeg(
    [...inputs, "-filter_complex", graph, "-map", "[raw]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", raw],
    `assembling the voice for ${plan.id}`,
  );

  const measured = measure(raw);
  const gainDb = VOICE_TARGET_LUFS - measured.inputI;
  ffmpeg(
    ["-i", raw, "-af", `volume=${gainDb.toFixed(2)}dB`, "-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", voFile],
    `anchoring the voice for ${plan.id}`,
  );
  return gainDb;
};

// ---- The mix ----

/** Where in the bed this post starts. Deterministic from the id, so a rebuild is identical,
 * and different per post, so the three videos in a day do not all open on the same four bars
 * of the same 123 second loop. */
const bedOffset = (id: string, mixSeconds: number, bedSeconds: number): number => {
  const room = Math.max(0, bedSeconds - mixSeconds - 1);
  if (room <= 0) {
    return 0;
  }
  const digest = crypto.createHash("sha256").update(id).digest();
  return round3((digest.readUInt32BE(0) % Math.floor(room * 1000)) / 1000);
};

const carveChain = (): string =>
  CARVE_BANDS.map(
    (band) =>
      `equalizer=f=${String(band.hz)}:width_type=q:w=${String(band.q)}:g=${String(band.gainDb)}`,
  ).join(",");

/** Returns loudnorm's own word for what the master did: Linear, or Dynamic if it could not
 * hit the target with one static gain. Dynamic is not a failure but it is worth seeing. */
const buildMix = (plan: VoPlan, voFile: string, mixSeconds: number, outFile: string): string => {
  const length = mixSeconds.toFixed(3);
  const start = bedOffset(plan.id, mixSeconds, durationOf(BED));
  const fadeOutAt = Math.max(0, mixSeconds - BED_FADE.outSeconds).toFixed(3);

  const graph = [
    // The voice, padded to the full length so the same signal can also key the duck.
    `[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${length},atrim=0:${length},asetpts=N/SR/TB,asplit=2[voice][key]`,
    // The bed. Dips first, level second, edges last: that order is the doctrine's, and a
    // level stage placed before the filters would be levelling energy about to be removed.
    `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=start=${start.toFixed(3)}:end=${(start + mixSeconds).toFixed(3)},asetpts=N/SR/TB,${carveChain()},volume=${String(BED_GAIN_DB)}dB,afade=t=in:st=0:d=${String(BED_FADE.inSeconds)},afade=t=out:st=${fadeOutAt}:d=${String(BED_FADE.outSeconds)}[bed]`,
    // The level half of the carve: an envelope of the voice's own loudness, not a fixed dip.
    // A static duck would thin the bed through every pause, and once you have heard both
    // there is no reason to want it.
    `[bed][key]sidechaincompress=threshold=${String(DUCK.thresholdLinear)}:ratio=${String(DUCK.ratio)}:attack=${String(DUCK.attackMs)}:release=${String(DUCK.releaseMs)}:level_sc=1[ducked]`,
    "[voice][ducked]amix=inputs=2:normalize=0:duration=first[mix]",
  ].join(";");

  const raw = path.join(WORK_DIR, `${plan.id}-mix-raw.wav`);
  ffmpeg(
    ["-i", voFile, "-i", BED, "-filter_complex", graph, "-map", "[mix]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_f32le", raw],
    `mixing ${plan.id}`,
  );

  // Two pass, and `linear=true`, so the master is one static gain rather than a compressor
  // walking over the read. A single pass loudnorm is dynamic by definition: it would push the
  // bed up in every gap between phrases, which is the exact motion the duck exists to stop.
  const measured = measure(raw);
  const stderr = ffmpeg(
    [
      "-i", raw,
      "-af",
      loudnormArgs([
        `measured_I=${measured.inputI.toFixed(2)}`,
        `measured_TP=${measured.inputTp.toFixed(2)}`,
        `measured_LRA=${measured.inputLra.toFixed(2)}`,
        `measured_thresh=${measured.inputThresh.toFixed(2)}`,
        `offset=${measured.targetOffset.toFixed(2)}`,
        "linear=true",
        "print_format=summary",
      ]),
      // pcm_s16le at 48k, not a lossy codec: an encoder can push a true peak back over the
      // ceiling this file was just normalised to, and the platforms re-encode anyway.
      "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", outFile,
    ],
    `mastering ${plan.id}`,
  );
  return /Normalization Type:\s*(\w+)/.exec(stderr)?.[1] ?? "unknown";
};

// ---- The generated table ----

const emit = (rows: PostAudio[]): string => {
  const text = (value: string): string => JSON.stringify(value);
  const entries = rows
    .map((row) =>
      [
        `  ${text(row.id)}: {`,
        `    id: ${text(row.id)},`,
        `    voice: ${text(row.voice)},`,
        `    file: ${text(row.file)},`,
        `    voEndSeconds: ${String(row.voEndSeconds)},`,
        `    voEndFrame: ${String(row.voEndFrame)},`,
        `    seconds: ${String(row.seconds)},`,
        `    frames: ${String(row.frames)},`,
        "    lines: [",
        ...row.lines.map(
          (line) =>
            `      { written: ${text(line.written)}, spoken: ${text(line.spoken)}, startSeconds: ${String(line.startSeconds)}, endSeconds: ${String(line.endSeconds)}, startFrame: ${String(line.startFrame)}, endFrame: ${String(line.endFrame)} },`,
        ),
        "    ],",
        `    loudness: { integratedLufs: ${String(row.loudness.integratedLufs)}, truePeakDb: ${String(row.loudness.truePeakDb)}, lra: ${String(row.loudness.lra)} },`,
        "  },",
      ].join("\n"),
    )
    .join("\n");

  return [
    "/**",
    " * GENERATED BY `pnpm video:audio`. Do not edit by hand.",
    " *",
    " * Every number here was measured off a real file: line positions from ffprobe, loudness read",
    " * back off the finished WAV with ffmpeg loudnorm. See ./timings.ts for why this is committed",
    " * and the WAVs it describes are not.",
    " */",
    'import type { PostAudio } from "./timings";',
    "",
    "export const AUDIO: Record<string, PostAudio> = {",
    entries,
    "};",
    "",
  ].join("\n");
};

const readStore = (): Record<string, PostAudio> => {
  if (!fs.existsSync(STORE)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(STORE, "utf8")) as Record<string, PostAudio>;
  } catch {
    // A corrupt cache is not worth a stack trace: the cure is to rebuild, which is what an
    // empty store makes happen.
    return {};
  }
};

// ---- The build ----

/** Every post this pipeline can speak: the four shipping formats, plus the combined direction
 * Cameron is watching, which reads its own display type back. */
export const allPlans = (): VoPlan[] => [
  ...hooks.map((hook) => voPlanFor(hook, postDuration(hook))),
  voPlanForKineticNative(KINETIC_NATIVE),
];

export interface Overrun {
  id: string;
  voSeconds: number;
  compositionSeconds: number;
}

export interface BuildOptions {
  only: string[];
  force: boolean;
  quiet: boolean;
}

export interface BuildResult {
  rows: PostAudio[];
  overruns: Overrun[];
}

export const buildAudio = (options: BuildOptions): BuildResult => {
  FFMPEG = findTool("ffmpeg");
  FFPROBE = findTool("ffprobe");
  if (!fs.existsSync(BED)) {
    throw new Error(
      `The music bed is missing: ${rel(BED)}. It is the one audio asset in this project that is not generated.`,
    );
  }
  for (const dir of [CACHE_DIR, MIX_DIR, WORK_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const wanted = options.only.length > 0 ? new Set(options.only) : null;
  const plans = allPlans();
  if (wanted !== null) {
    for (const id of wanted) {
      if (!plans.some((plan) => plan.id === id)) {
        throw new Error(`"${id}" is not a hook id in src/data/hooks.ts nor the kinetic-native script.`);
      }
    }
  }
  const building = plans.filter((plan) => wanted === null || wanted.has(plan.id));

  console.log("");
  console.log(`ffmpeg    ${FFMPEG}`);
  console.log(`bed       ${rel(BED)}  ${durationOf(BED).toFixed(1)}s`);
  console.log(`cache     ${rel(CACHE_DIR)}`);
  console.log(
    `target    ${String(MIX_TARGET.lufs)} LUFS integrated, true peak under ${String(MIX_TARGET.truePeakDb)} dBTP`,
  );
  console.log("");

  const store = readStore();
  const built: PostAudio[] = [];
  const overruns: Overrun[] = [];

  for (const plan of building) {
    const started = Date.now();
    const phrases = phrasesFor(plan, options.force);
    const laid = layOut(phrases);

    const voFile = path.join(WORK_DIR, `${plan.id}-vo.wav`);
    buildVoice(plan, phrases, laid, voFile);

    const compositionSeconds = plan.durationInFrames / FPS;
    // The mix always covers the whole composition, so the bed keeps playing under the end
    // card, and always covers the whole read, so a voiceover longer than its slot is heard in
    // full rather than cut off mid word. When those two disagree it is the PICTURE that is
    // wrong: audio is the clock, so the overrun is reported and the visuals get re-cut to it.
    const mixSeconds = round3(Math.max(laid.voEndSeconds, compositionSeconds));
    if (laid.voEndSeconds > compositionSeconds) {
      overruns.push({ id: plan.id, voSeconds: round3(laid.voEndSeconds), compositionSeconds });
    }

    const mixFile = path.join(MIX_DIR, `${plan.id}.wav`);
    const normalisation = buildMix(plan, voFile, mixSeconds, mixFile);
    const checked = verify(mixFile);

    const row: PostAudio = {
      id: plan.id,
      voice: plan.voice,
      file: `audio/mix/${plan.id}.wav`,
      voEndSeconds: round3(laid.voEndSeconds),
      voEndFrame: Math.round(laid.voEndSeconds * FPS),
      seconds: mixSeconds,
      frames: Math.round(mixSeconds * FPS),
      lines: laid.lines,
      loudness: checked.loudness,
    };
    built.push(row);
    store[row.id] = row;

    const cached = phrases.filter((phrase) => phrase.fromCache).length;
    console.log(
      `  ${plan.id.padEnd(22)} ${plan.voice.padEnd(11)} read ${laid.voEndSeconds.toFixed(2)}s / mix ${mixSeconds.toFixed(2)}s   ${String(cached)}/${String(phrases.length)} cached   ${((Date.now() - started) / 1000).toFixed(1)}s`,
    );
    if (!options.quiet) {
      console.log(`    ${checked.summary}`);
      console.log(`    Normalization Type:   ${normalisation}`);
    }
  }

  // Posts that no longer exist are dropped; posts this run did not touch keep the row they
  // already had. That is what lets `--only` rewrite one clock without blanking the others.
  const live = new Set(plans.map((plan) => plan.id));
  const rows = Object.values(store)
    .filter((row) => live.has(row.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(
    STORE,
    `${JSON.stringify(Object.fromEntries(rows.map((row) => [row.id, row])), null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(GENERATED, emit(rows), "utf8");

  return { rows: built, overruns };
};

// ---- CLI ----

const USAGE = [
  "Usage: pnpm video:audio [flags]",
  "",
  "  --only <id>   build one post. Repeatable. Default is every hook plus the direction.",
  "  --force       re-run TTS even when the phrase is already cached.",
  "  --quiet       one line per post instead of the loudness summary.",
].join("\n");

const parseOptions = (argv: string[]): BuildOptions => {
  const options: BuildOptions = { only: [], force: false, quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]!;
    switch (flag) {
      case "--only": {
        const value = argv[index + 1];
        if (value === undefined || value.startsWith("--")) {
          throw new Error(`--only needs a post id.\n\n${USAGE}`);
        }
        options.only.push(value);
        index += 1;
        break;
      }
      case "--force":
        options.force = true;
        break;
      case "--quiet":
        options.quiet = true;
        break;
      case "--help":
      case "-h":
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown flag "${flag}".\n\n${USAGE}`);
    }
  }
  return options;
};

/** The overrun report, printed by the CLI and by render-day, because it is the one thing in
 * this pipeline that says the picture has to change. */
export const reportOverruns = (overruns: Overrun[]): void => {
  if (overruns.length === 0) {
    return;
  }
  console.log("");
  console.log("AUDIO IS THE CLOCK. These reads are longer than the video they belong to, so the");
  console.log("picture is what needs re-cutting. Do not speed the read up to fit the slot:");
  for (const overrun of overruns) {
    console.log(
      `  ${overrun.id.padEnd(22)} read ${overrun.voSeconds.toFixed(2)}s, video ${overrun.compositionSeconds.toFixed(2)}s   (+${(overrun.voSeconds - overrun.compositionSeconds).toFixed(2)}s)`,
    );
  }
};

const main = (): void => {
  const options = parseOptions(process.argv.slice(2));
  const { rows, overruns } = buildAudio(options);
  console.log("");
  console.log(`${rel(MIX_DIR)}: ${String(rows.length)} mix(es) written`);
  console.log(`${rel(GENERATED)} rewritten`);
  reportOverruns(overruns);
};

// tsx runs this file directly; render-day imports buildAudio from it and must not trigger the
// CLI when it does. process.argv[1] is the entry point, so this is only true of a direct run.
const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    main();
  } catch (error: unknown) {
    console.error(`\nbuild-audio: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
