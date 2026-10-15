// scripts/generate-pop-sound.mjs — writes apps/mobile/assets/sounds/duo-pop.wav
//
//   node scripts/generate-pop-sound.mjs
//
// Zero dependencies: node:fs, node:path and node:url only, matching the rest of scripts/.
//
// ---------------------------------------------------------------------------
// WHAT THIS MAKES AND WHY
//
// A Duo Pop is the one push in DuoQueue that has a clock on it (ten minutes), so it is the one
// push that gets its own sound. iOS only plays a custom notification sound that is linear PCM
// WAV, CAF or AIFF, shorter than 30 seconds, and bundled into the binary. Expo bundles it
// through the expo-notifications config plugin's `sounds` option in apps/mobile/app.json, and
// the push names it by file name: `sound: "duo-pop.wav"` (send-push-notification on the
// server, DUO_POP_SOUND_FILE in apps/mobile/src/lib/pushSound.ts on the phone). Rename one and
// the other plays the default chime without any error, so the name lives in both places.
//
// The sound is an original two-note blip, a short rising pair that echoes the two rings
// locking together in the app. It is synthesized here from plain sine maths, so it is ours,
// free, and byte-for-byte reproducible: re-run this script and the same file comes out. It is
// deliberately NOT League of Legends' queue pop or anything like it (no Riot sounds, ever).
//
// Synthesis, per sample, for each note that has started (u = t - start >= 0):
//   env    = min(1, u / 0.004) * exp(-u / tau)      4 ms attack, exponential decay
//   glide  = 1 + 0.06 * exp(-u / 0.012)            a 6% pitch drop in the first few ms (the "pop")
//   phase += 2 * PI * freq * glide / 44100
//   sample += gain * env * (sin(phase) + 0.22 * sin(2 * phase))
// Note A: starts 0.000 s, 659.25 Hz (E5), tau 0.070 s, gain 0.55.
// Note B: starts 0.085 s, 987.77 Hz (B5), tau 0.120 s, gain 0.75.
// Then: normalise the absolute peak to 0.70, a linear fade to zero over the last 8 ms, and
// quantise with Math.round(x * 32767) clamped to int16. 44100 Hz, mono, 16-bit, 0.45 s.
//
// Cameron may swap the file for another sound before the build (a 16-bit PCM WAV under 30 s,
// same file name). NEVER play or preview this file on Cameron's PC (his standing rule): this
// script checks the result by its header bytes and sample maths only.
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "apps/mobile/assets/sounds/duo-pop.wav");

const SAMPLE_RATE = 44100;
const DURATION_S = 0.45;
const SAMPLES = Math.round(SAMPLE_RATE * DURATION_S); // 19845
const PEAK = 0.7;
const FADE_S = 0.008;

const NOTES = [
  { start: 0.0, freq: 659.25, tau: 0.07, gain: 0.55 },
  { start: 0.085, freq: 987.77, tau: 0.12, gain: 0.75 },
];

function synthesize() {
  const out = new Float64Array(SAMPLES);
  const phases = NOTES.map(() => 0);
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    NOTES.forEach((note, n) => {
      const u = t - note.start;
      if (u < 0) return;
      const env = Math.min(1, u / 0.004) * Math.exp(-u / note.tau);
      const glide = 1 + 0.06 * Math.exp(-u / 0.012);
      phases[n] += (2 * Math.PI * note.freq * glide) / SAMPLE_RATE;
      sample += note.gain * env * (Math.sin(phases[n]) + 0.22 * Math.sin(2 * phases[n]));
    });
    out[i] = sample;
  }

  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  const scale = peak > 0 ? PEAK / peak : 0;
  const fadeSamples = Math.round(SAMPLE_RATE * FADE_S);
  for (let i = 0; i < SAMPLES; i++) {
    const fromEnd = SAMPLES - 1 - i;
    const fade = fromEnd < fadeSamples ? fromEnd / fadeSamples : 1;
    out[i] = out[i] * scale * fade;
  }
  return out;
}

function encodeWav(samples) {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const q = Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767)));
    buf.writeInt16LE(q, 44 + i * 2);
  }
  return buf;
}

function verify(path) {
  const buf = readFileSync(path);
  const fail = (msg) => {
    throw new Error(`duo-pop.wav check failed: ${msg}`);
  };
  if (buf.toString("ascii", 0, 4) !== "RIFF") fail("no RIFF");
  if (buf.readUInt32LE(4) !== buf.length - 8) fail("RIFF size");
  if (buf.toString("ascii", 8, 12) !== "WAVE") fail("no WAVE");
  if (buf.toString("ascii", 12, 16) !== "fmt ") fail("no fmt chunk");
  if (buf.readUInt16LE(20) !== 1) fail("not PCM");
  if (buf.readUInt16LE(22) !== 1) fail("not mono");
  if (buf.readUInt32LE(24) !== SAMPLE_RATE) fail("sample rate");
  if (buf.readUInt32LE(28) !== SAMPLE_RATE * 2) fail("byte rate");
  if (buf.readUInt16LE(32) !== 2) fail("block align");
  if (buf.readUInt16LE(34) !== 16) fail("bits per sample");
  if (buf.toString("ascii", 36, 40) !== "data") fail("no data chunk at 36");
  const dataBytes = buf.readUInt32LE(40);
  if (dataBytes !== buf.length - 44 || dataBytes % 2 !== 0) fail("data size");

  const count = dataBytes / 2;
  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(buf.readInt16LE(44 + i * 2)));
  return { samples: count, seconds: count / SAMPLE_RATE, peak, bytes: buf.length };
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodeWav(synthesize()));
const result = verify(OUT);
console.log(
  `wrote ${OUT}\n  samples ${result.samples}, ${result.seconds.toFixed(3)} s, peak ${result.peak}, ${result.bytes} bytes`,
);
