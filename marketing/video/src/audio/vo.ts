/**
 * WHAT GETS SAID, BY WHOM, AND WHEN.
 *
 * The doctrine's rule for this build is that audio is the clock: scenes are re-timed to the
 * voiceover's real timestamps and a read is never rushed to fit a slot. A clock is only
 * useful if it cannot lie, so nothing in this file invents copy. The spoken line list for a
 * post is DERIVED from the same fields the frame renders, which is what makes "the words
 * spoken and the words on screen are the same" a property of the code rather than a promise
 * somebody has to keep every time a hook is edited.
 *
 * There is exactly one transform between the two, `speakable`, and it is deterministic and
 * one way. It adds the terminal punctuation Kokoro needs for a falling intonation and it
 * spells out the handful of tokens a text to speech model reads as noise ("18+", "lfg",
 * "sdk"). It never changes which words are said or in what order, so a hook edited in
 * src/data/hooks.ts changes both tracks at once or neither.
 *
 * PHRASES, NOT SENTENCES. Each phrase is synthesised as its own WAV and the track is
 * assembled from them with an authored gap. That is not a performance trick: it is how the
 * timings become exact. A single WAV of the whole read would need a forced aligner to find
 * where line two starts, and the answer would be an estimate; synthesising per phrase and
 * measuring each file with ffprobe means the start of every line is a number this pipeline
 * computed rather than inferred. The Kokoro CLI exposes no word level timings, so phrase
 * grain is the finest honest grain available, and it is also the grain the cut works at:
 * every beat in every format is one phrase.
 */
import type { Format, Hook } from "@/types";

/** The two voices Cameron picked, and nothing else, so a typo is a compile error. */
export type VoiceId = "am_michael" | "af_heart";

/**
 * Voice by format.
 *
 * `pain` is the lower, matter of fact read, because the pain format names a feeling and a
 * bright delivery would sell it. Everything else is the lighter one.
 *
 * `spec` was not assigned. It defaults to the light voice with the rest rather than being
 * guessed into the low one: `spec` is the format that reads a list of facts, and the low
 * voice is doing a specific job on `pain` that a list does not need. Flipping it is this one
 * line.
 */
export const VOICE_BY_FORMAT: Record<Format, VoiceId> = {
  pain: "am_michael",
  reframe: "af_heart",
  demo: "af_heart",
  spec: "af_heart",
};

/**
 * Tokens a speech model reads as noise, and what to say instead.
 *
 * These are pronunciations, not rewrites. Every entry here leaves the rendered copy alone:
 * the frame still says "18+ only", the voice says "eighteen plus only". Order matters, so
 * this is a list and not an object: "18+" has to be consumed before the bare "18" rule can
 * see it.
 */
const SAY_AS: readonly { find: RegExp; say: string }[] = [
  { find: /\b18\s*\+/g, say: "eighteen plus" },
  { find: /\b18\b/g, say: "eighteen" },
  { find: /\+/g, say: " plus" },
  { find: /\blfg\b/gi, say: "L F G" },
  { find: /\bsdk\b/gi, say: "S D K" },
  { find: /\bgps\b/gi, say: "G P S" },
  { find: /\bduoqueue\b/gi, say: "duo queue" },
  { find: /\bcta\b/gi, say: "C T A" },
];

/** True when a phrase already ends in something a reader would stop on. */
const ENDS_CLOSED = /[.!?]$/;

/**
 * One rendered line to one spoken line. Deterministic, one way, and the only difference the
 * pipeline permits between what is read and what is heard.
 */
export const speakable = (line: string): string => {
  const said = SAY_AS.reduce((text, rule) => text.replace(rule.find, rule.say), line)
    .replace(/\s+/g, " ")
    .trim();
  // A phrase synthesised without terminal punctuation trails upward as if the sentence
  // continues, and every phrase here is a complete statement that should land.
  return ENDS_CLOSED.test(said) ? said : `${said}.`;
};

/** One line of the read. `written` is what the frame shows; `spoken` is what Kokoro is given. */
export interface VoLine {
  written: string;
  spoken: string;
  /**
   * Kokoro's rate for THIS phrase, overriding the plan's `speed`.
   *
   * A plan level rate is the right lever for a film that is uniformly too quick, and it was
   * the right lever last cut. It cannot fix an UNEVEN read, and that is what was left: with
   * the plan at 0.9 the six phrases came back at 242 / 133 / 174 / 126 / 183 / 193 words per
   * minute. Five of those sit in or under the broadcast band. The opening sits 40% above the
   * top of it, and it is both the fastest thing in the film and the first thing anybody hears.
   *
   * The cause is length rather than rate. Kokoro reads a six word sentence at close to
   * conversational speed and a two word fragment deliberately, because the pauses inside a
   * fragment are a larger share of it. So the one full sentence in the script came out fast
   * while everything around it slowed down, and lowering the plan rate far enough to fix the
   * opening would have dragged the five phrases that were already correct.
   *
   * Per phrase, the correction goes exactly where the measurement says the problem is. It is
   * part of the cache key, so it re-synthesises one phrase and leaves the other five as
   * cache hits.
   */
  speed?: number;
}

/** Everything the builder needs to make one post's voiceover, and nothing it does not. */
export interface VoPlan {
  /** The post id. The mix is named for it and the composition looks itself up by it. */
  id: string;
  voice: VoiceId;
  lines: VoLine[];
  /** The composition's full length, so the bed can be laid under the end card as well. */
  durationInFrames: number;
  /**
   * Kokoro's rate multiplier for THIS read, defaulting to VOICE_SPEED below.
   *
   * It is per plan rather than global because pace is a directorial decision about one film
   * and not a property of the pipeline. Every post here reads at 1; the kinetic direction
   * reads slower, because it is a twelve second film with six statements in it and the note
   * that came back on the last cut was that it felt rushed. Making that a global would have
   * re-synthesised and re-timed every other post to fix one of them, and the committed
   * timings of a post nobody asked about are not a safe thing to move.
   *
   * It is part of the cache key, so lowering it re-synthesises this film's phrases and leaves
   * every other post's cache hit intact.
   */
  speed?: number;
  /**
   * Frames of breath between this read's phrases, defaulting to GAP_FRAMES below.
   *
   * Same argument as `speed`, and the same reason it moved: widening the gaps is how a film
   * gets air without touching the rate the words are actually read at. The two levers are
   * separate on purpose, because they fix different halves of "rushed".
   */
  gapFrames?: number;
}

/**
 * The rendered copy of a hook, in reading order.
 *
 * `demo` is the one format with nothing sayable on screen: its only on-frame words are the
 * step labels, and "01 / DECK" spoken aloud is "zero one slash deck". So a demo speaks its
 * `caption`, which is the one human sentence the hook carries. That is the single place in
 * this file where the spoken track is not literally the on-screen track, and it is because
 * the on-screen track there is a machine label rather than a sentence.
 */
export const writtenLinesOf = (hook: Hook): string[] => {
  switch (hook.format) {
    case "reframe":
      return [hook.beatOne, hook.beatTwo];
    case "pain":
      return hook.lines;
    case "spec":
      return [hook.title, ...hook.items];
    case "demo":
      return [hook.caption];
    default: {
      const unhandled: never = hook;
      throw new Error(`No voiceover lines for ${JSON.stringify(unhandled)}.`);
    }
  }
};

/** A hook's whole read: which voice, which lines, and how long the video it belongs to is. */
export const voPlanFor = (hook: Hook, durationInFrames: number): VoPlan => ({
  id: hook.id,
  voice: VOICE_BY_FORMAT[hook.format],
  lines: writtenLinesOf(hook).map((written) => ({ written, spoken: speakable(written) })),
  durationInFrames,
});

/**
 * The gaps, in frames at 30fps, and the reason each is the number it is.
 *
 * LEAD_IN is 6 frames, 0.20s. Not zero, because a word that starts on sample zero clips its
 * own onset and because the doctrine's opening frame carries the hook on the picture track
 * before the voice arrives to confirm it. Not more, because the first half second is the only
 * half second there is.
 *
 * GAP is 8 frames, 0.27s. It is a breath between statements, and it is deliberately under the
 * doctrine's 0.3 to 0.75s stillness window: that window is a scarce dramatic comma spent once
 * before the payoff, and putting one between every line would spend it eight times and mean
 * nothing.
 */
export const LEAD_IN_FRAMES = 6;
export const GAP_FRAMES = 8;

/**
 * The default read rate, and the only value any `Hook` uses.
 *
 * A plan may override it (see `VoPlan.speed`). It is named here rather than left as a literal
 * in the builder so that the cache key, the CLI argument and this default are one number.
 */
export const VOICE_SPEED = 1;
