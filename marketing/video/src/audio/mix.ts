/**
 * THE MIX, AS NUMBERS.
 *
 * Every value here is a decision with a reason, and the reasons are the same ones the
 * hyperframes audio doctrine gives: a mix is a set of relationships, you subtract before you
 * add, you level after you filter, and a bed under a voice is carved rather than turned down.
 * The implementation is ffmpeg rather than that engine's Web Audio graph, so the concepts
 * carry over and the API does not. That translation happens once, in scripts/build-audio.ts,
 * and nowhere else.
 *
 * SIGNAL ORDER, which is the whole design:
 *
 *   voice   highpass 80Hz  ->  gentle compressor  ->  static gain to VOICE_TARGET_LUFS
 *   bed     3 peaking dips ->  static gain        ->  sidechain duck keyed by the voice
 *   sum     voice + carved bed  ->  two pass linear loudnorm to MIX targets
 *
 * The bed's dips come first and its level stage second, which is the doctrine's order: a
 * compressor placed before a filter spends its life chasing what the filter was going to
 * remove anyway.
 */

/**
 * The voice's anchor. The voiceover stem is measured and then moved to this figure with a
 * STATIC gain, before it ever meets the bed.
 *
 * This is the load bearing decision in the file. Anchoring the voice first is what makes
 * every other number here deterministic: the bed's offset, the duck's threshold and the
 * final trim are all relative to a voice whose level is known, so a hook whose read happens
 * to be quieter than yesterday's does not silently change how loud the music sits under it.
 * -16 LUFS leaves 2 LU of room under the -14 the mix lands on, which is roughly what the bed
 * adds when it is summed in.
 */
export const VOICE_TARGET_LUFS = -16;

/**
 * The bed's attenuation, in dB, applied after its dips.
 *
 * bed-01.mp3 measures -9.5 LUFS integrated with a +0.9 dBTP true peak: it is mastered hot,
 * already clipping, and 2.7 LU of range means it is doing nothing but sitting at full tilt.
 * 11 dB down puts it at about -20.5 LUFS, which is 4.5 LU under the anchored voice before
 * the duck does anything at all, and 11 or 12 LU under it while a word is actually being
 * said. That is the figure the brief specified and the measurement agrees with it.
 */
export const BED_GAIN_DB = -11;

/**
 * THE CARVE. Three peaking dips in the bands a voice occupies, so the bed gives up the
 * frequencies the words need instead of giving up all of them.
 *
 * These are the doctrine's default strength 0.25 profile, verbatim: a 6 dB dip at 400Hz and
 * roughly 3 dB at 1kHz and 1.6kHz, all at Q 1.4. Audible as room for the voice rather than
 * as a hole in the music, which is the failure mode a stronger carve has. The bed keeps its
 * low end and its top, so it is still music while the voice is still intelligible.
 *
 * Implemented as ffmpeg `equalizer` filters, which are the same biquad peaking sections the
 * doctrine's `peaking` node is.
 */
export const CARVE_BANDS: readonly { hz: number; q: number; gainDb: number }[] = [
  { hz: 400, q: 1.4, gainDb: -6 },
  { hz: 1000, q: 1.4, gainDb: -3 },
  { hz: 1600, q: 1.4, gainDb: -3.17 },
];

/**
 * THE DUCK. The level half of the carve, and the half a static dip cannot do: spectral
 * carving cannot fix a bed that is simply louder than the voice at that moment.
 *
 * ffmpeg's `sidechaincompress` is the engine's "gain stage driven by an envelope of the
 * voice's own level". `threshold` is linear amplitude, not dB, which is the one trap in this
 * filter: 0.05 is about -26 dBFS, low enough that ordinary speech opens the duck and quiet
 * enough that the tail of a word does not hold it open.
 *
 * `release` is 800ms on purpose. Music that snaps back to full the instant a word ends
 * sounds like a machine doing it, and 800ms is long enough to read as the mix breathing.
 * `attack` is 20ms, which is under a syllable, so the first word of a phrase is not fought.
 */
export const DUCK = {
  thresholdLinear: 0.05,
  ratio: 4,
  attackMs: 20,
  releaseMs: 800,
} as const;

/**
 * Where the finished file lands.
 *
 * -14 LUFS is what Instagram, TikTok and YouTube all normalise to, so a mix delivered there
 * is played at the level it was mixed at rather than being turned down on the way in. -1.2
 * dBTP as the ceiling rather than -1.0: loudnorm treats TP as a target it approaches, so
 * asking for exactly -1.0 lands at about -1.0 and the brief's requirement is UNDER -1. Asking
 * for -1.2 guarantees it with room for the lossy encode a platform will do afterwards.
 */
export const MIX_TARGET = { lufs: -14, truePeakDb: -1.2, lra: 11 } as const;

/** The bed's own edges. It fades up under the first frame and out under the end card. */
export const BED_FADE = { inSeconds: 0.6, outSeconds: 1 } as const;

/**
 * Voice cleanup, and it is deliberately two filters.
 *
 * The highpass is the doctrine's rumble cut. Kokoro's output has no room tone to remove, but
 * it does carry sub-bass energy that costs headroom in the sum and is inaudible on a phone
 * speaker, so cutting it is free.
 *
 * The compressor is "even out levels" at its gentlest. 2.5:1 with a slow-ish release narrows
 * the distance between a stressed syllable and an unstressed one just enough that the duck
 * keyed off this signal behaves consistently. Anything heavier would flatten a read that is
 * already even.
 */
export const VOICE_CHAIN = {
  highpassHz: 80,
  compressor: { thresholdDb: -18, ratio: 2.5, attackMs: 5, releaseMs: 120 },
} as const;
