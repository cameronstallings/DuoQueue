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
 *   sum     voice + carved bed  ->  measure  ->  static gain to MIX_TARGET.lufs  ->  ceiling
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
 *
 * It is also the reference the whole rebalance below is expressed against. This number did
 * NOT move: "the voice is too forward" is answered by the master's target, and "the music is
 * too loud" is answered by the bed's offset, and both of those are meaningless unless the
 * thing they are measured against holds still.
 */
export const VOICE_TARGET_LUFS = -16;

/**
 * The bed's attenuation, in dB, applied after its dips.
 *
 * bed-01.mp3 measures -9.5 LUFS integrated with a +0.9 dBTP true peak: it is mastered hot,
 * already clipping, and 2.7 LU of range means it is doing nothing but sitting at full tilt.
 *
 * -15, four dB further down than the -11 this started at, and the change is a note rather
 * than a preference. Cameron watched the first mixed cut and said to turn the music down.
 * The wrong answer is to turn the master down: every platform normalises to about -14 LUFS,
 * so a quieter file is turned back up on the way in and the mix arrives exactly as loud as it
 * left, with the same music in it. The only thing that survives that normalisation is a
 * RELATIVE change, which is why this number moved and MIX_TARGET.lufs barely did.
 *
 * 15 dB down puts the bed at about -24.5 LUFS, which is 8.5 LU under the anchored voice
 * before the duck does anything at all and about 17 LU under it while a word is being said.
 *
 * Measured on the finished kinetic-native mix, mean volume over the four bed-alone gaps
 * between phrases and over the five spoken windows, before and after:
 *
 *              bed alone (4 gaps)   the read (5 windows)   distance
 *   before          -23.4 dBFS           -15.1 dBFS          8.4 dB
 *   after           -29.0 dBFS           -16.1 dBFS         12.8 dB
 *
 * The bed fell 5.5 dB, the read fell 1.1, and the distance between them widened by 4.5. Those
 * are the two numbers the note asked for, and the second one is the master's doing rather than
 * this constant's: see MIX_TARGET below.
 */
export const BED_GAIN_DB = -15;

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
 *
 * `ratio` was chosen by measuring rather than by taste. The bed was rendered through this
 * chain at four ratios and the integrated loudness of the read's own window compared against
 * the same window undducked, on reframe-001:
 *
 *     ratio 2    -30.2 LUFS    6.1 dB of duck
 *     ratio 2.5  -31.2 LUFS    7.1 dB
 *     ratio 3    -31.9 LUFS    7.8 dB
 *     ratio 4    -32.8 LUFS    8.7 dB
 *     (undducked reference over that window: -24.1 LUFS)
 *
 * 4 it is, and it was briefly 2.5 by mistake. The argument for 2.5 was that seven dB is the
 * broadcast duck and that 4 was a hole rather than room, which is a defensible reading of
 * that table in the abstract and the wrong one here: the note on the record is that the music
 * is too loud under the voice, and by this table 2.5 makes the bed 1.6 dB LOUDER under a word
 * than 4 does. A ratio picked against the only listening note the mix has is not a taste
 * call, it is a regression. 8.7 dB of duck on a bed that is already 8.5 LU down puts the
 * music about 17 LU under the read while a word is being said, which is where it belongs.
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
 * -14.7 LUFS, down from -14, and that 0.7 dB is the ONLY absolute level change in this file.
 * -14 is what Instagram, TikTok and YouTube all normalise to, so a mix delivered at it is
 * played at the level it was mixed at rather than being turned down on the way in, and that
 * is exactly why turning the master down is not how you answer "it is too loud": the platform
 * turns it back up. What a platform cannot undo is the DISTANCE between the voice and the bed,
 * which is why BED_GAIN_DB carries the real change and this number moved only a shade.
 *
 * The shade is worth having anyway, and it is the second half of the note: the read was also
 * too far forward. Dropping the bed 4 dB makes the sum a little quieter, so the master's
 * static gain gets a little larger to compensate and the VOICE would come out slightly LOUDER
 * than it went in. Taking the target down cancels that and leaves the read about a dB under
 * where it sat. Measured on the finished kinetic-native mix, the read moved from -15.1 dBFS
 * mean to -16.1, which is the low end of the "voice down 1 to 2 dB" the note asked for and is
 * as much as the -14 to -15 window it also asked for will pay for. Anything past -15 is a
 * real loudness penalty on a platform that normalises, so this is as far as an absolute trim
 * can honestly go and the rest is the gap.
 *
 * WHY -14.7 AND NOT -15. This number aims the WAV, and the WAV is an intermediate: what
 * anybody plays is the mp4 Remotion muxes it into, and the AAC encode plus its frame padding
 * costs about 0.2 LU. The first pass at this targeted -15.0, the WAV landed at -14.9, and the
 * RENDER measured -15.1, which is outside the window by exactly that encode. Aiming the
 * intermediate at -14.7 puts the delivered file at about -14.9, in the middle of the window
 * rather than on its edge. Target the file that gets watched, not the one in the middle.
 *
 * -1.2 dBTP as the ceiling rather than -1.0: loudnorm treats TP as a target it approaches, so
 * asking for exactly -1.0 lands at about -1.0 and the brief's requirement is UNDER -1. Asking
 * for -1.2 guarantees it with room for the lossy encode a platform will do afterwards.
 *
 * `truePeakDb` is the REQUIREMENT, and `ceilingDbfs` is what actually enforces it. Nothing in
 * this pipeline asks ffmpeg's `loudnorm` to hit either one: the master is a measurement
 * followed by one static gain, and the ceiling below is what the peaks meet. Asking loudnorm
 * to do it was the first design and it was abandoned on measurement, because `linear=true` is
 * a request rather than an instruction and it was refused on all twenty five posts. See the
 * master in scripts/build-audio.ts for the numbers; the short version is that a dynamic
 * normaliser lifts quiet passages, the quiet passages here are the ducked gaps between
 * phrases, and lifting them undoes the duck. It cost 1.9 LU of range on reframe-001.
 *
 * `toleranceLu` is the second measurement. The master's gain is computed from the loudness of
 * the file before the ceiling touched it, and a limiter doing real work takes a couple of
 * tenths back out, so the finished file is measured and trimmed by the difference when it is
 * more than this far off. Measure, trim, measure again.
 *
 * The ceiling is enforced at 4x oversampling, and that is not decoration either. A limiter
 * works on samples; true peak is measured between them. Limiting at 48kHz with -1.5 dBFS of
 * ceiling and 0.3 dB of assumed headroom produced files measuring -0.6, -0.8 and -0.9 dBTP,
 * all of which fail the brief's "under -1". Running the limiter at 192kHz makes the samples it
 * sees close enough to the true waveform that the ceiling means what it says.
 */
export const MIX_TARGET = {
  lufs: -14.7,
  truePeakDb: -1.2,
  lra: 11,
  toleranceLu: 0.15,
  ceilingDbfs: -1.5,
} as const;

/**
 * THE ENCODER'S HEAD START, in samples at 48kHz, and it is a delivery fix rather than a mix
 * decision.
 *
 * An AAC encoder needs a block of lookahead before it can emit its first real frame, and what
 * it emits in the meantime is silence. The container is supposed to declare that padding in an
 * edit list so a player throws it away, and the one Remotion's mux writes takes back only 512
 * samples of it. The rest is left in, and every mix therefore plays late.
 *
 * The figure is measured rather than reasoned. Null testing a delivered mp4 against the WAV it
 * was built from, one sample shift at a time, the residual sits at -15.2 dB mean at lag 0,
 * collapses to -53.7 dB at lag 2048, and comes back up at 2049 and 2050. The delay is 2048
 * samples exactly: 42.67ms, 1.28 video frames, on every render this pipeline has produced.
 *
 * It is small and it is systematic, which is the worst combination for a build whose one
 * doctrinal rule is that AUDIO IS THE CLOCK. Every beat in the combined direction is cut to
 * lead its own words by about 0.18s; 42.67ms of encoder lag quietly spends a quarter of that,
 * and does it to all twenty five posts at once.
 *
 * So the master is trimmed by exactly that much at the head. The WAV is an intermediate and
 * the mp4 is what gets watched, which is the same argument MIX_TARGET already makes about
 * loudness: aim the file that is played, not the one in the middle. What is trimmed is the
 * first 42.67ms of a 0.6s bed fade in under 0.2s of lead in silence, so nothing audible is
 * lost, and the committed line timings then describe where the words land in the DELIVERED
 * video rather than 1.28 frames before it.
 *
 * If Remotion changes its audio encode path this number should be re-measured with the same
 * null test rather than assumed.
 */
export const ENCODER_PRIMING_SAMPLES = 2048;

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
  /**
   * The ceiling, and it is fixing a real defect rather than adding polish.
   *
   * Kokoro's output is mastered right up to the wall: the assembled read measured +0.7 dBTP
   * before this was added, which is a stem that is already clipping when nothing has been
   * done to it yet. -3 dBFS of lookahead limiting takes about 4 dB off the peaks and leaves
   * roughly 13 dB of crest, which is where a broadcast read sits. It is the last stage on
   * this signal on purpose: a limiter placed anywhere but last is not a ceiling.
   */
  ceilingDbfs: -3,
} as const;
