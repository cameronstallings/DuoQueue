import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MIX_TARGET } from "../src/audio/mix";
import { AUDIO } from "../src/audio/timings.generated";
import type { PostAudio } from "../src/audio/timings";
import { writtenLinesOf } from "../src/audio/vo";
import { captionsFor } from "../src/config/captions";
import { CTA, type Phase } from "../src/config/phase";
import { clips } from "../src/data/clips";
import { hooks } from "../src/data/hooks";
import { KINETIC_NATIVE, kineticNativeDuration } from "../src/kinetic-native/script";
import { voPlanForKineticNative } from "../src/kinetic-native/vo";
import { postDuration } from "../src/lib/duration";
import { FPS } from "../src/lib/scale";
import { PRO } from "../src/pro/script";
import {
  beatFrames as proBeatFrames,
  beatStarts as proBeatStarts,
  BEAT_LEAD_FRAMES as PRO_LEAD,
  proDuration,
} from "../src/pro/timing";
import { voPlanForPro } from "../src/pro/vo";
import type { Hook } from "../src/types";
import { BEATS as TYPE_CLEAN_BEATS } from "../src/type-clean/plan";
import { V6 } from "../src/v6/script";
import { beatFrames, beatStarts, BEAT_LEAD_FRAMES as V6_LEAD, v6Duration } from "../src/v6/timing";
import { voPlanForV6 } from "../src/v6/vo";

/**
 * The rules a type cannot hold. TypeScript already guarantees that a `pain` hook has `lines`
 * and that every clip name exists; what it cannot see is that an id is unique, that a caption
 * says "singles", that a hook line is 45 characters wide, or that the footage it names is not
 * on this disk. Those are the ones that cost a re-render or an apology, so they are checked
 * here and `pnpm verify` refuses to go green without it.
 *
 * Errors exit 1. Warnings print and do not, because the two things they cover (a line over the
 * type budget, and footage Cameron has not recorded yet) are both states the pipeline handles
 * correctly on purpose.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const FOOTAGE_DIR = path.resolve(here, "..", "public", "footage");

// Built from its code point rather than typed, so a repo-wide grep for the character does not
// hit the one file whose job is to ban it, and so the rule survives a re-encode of this source.
const EM_DASH = String.fromCharCode(0x2014);

/** The word may appear, but only inside a denial. "no this isn't a dating app" is the
 * strongest hook the spec has; "meet singles" must never ship. Per string and not per hook,
 * because a denial two lines away does not reach the frame that says it.
 *
 * The apostrophe class covers the curly one as well as the ASCII one. The content model is
 * ASCII by house rule, but a smart quote pasted in from anywhere else would otherwise turn a
 * correctly written denial into a confusing failure. */
const DATING = /\b(dating|date night|hookup|hook ?up|romantic|romance|flirt|singles)\b/i;
const DENIAL = /\b(not|no|isn['’]?t|never)\b/i;

const ID_PATTERN = /^(reframe|pain|demo|spec)-\d{3}$/;

/** Above this a line is shrunk by fitText rather than overflowing, so this is a taste budget
 * and not a limit. Roughly two rendered lines at display.hero inside the safe box. */
const LINE_BUDGET = 28;

const SECONDS_RANGE = {
  reframe: [6, 20],
  pain: [6, 20],
  spec: [6, 20],
  // A demo is three steps of real app UI. Under 12 seconds none of them is readable.
  demo: [12, 20],
} as const;

type Level = "error" | "warning";
interface Problem {
  level: Level;
  where: string;
  message: string;
}

const problems: Problem[] = [];
const error = (where: string, message: string): void => {
  problems.push({ level: "error", where, message });
};
const warn = (where: string, message: string): void => {
  problems.push({ level: "warning", where, message });
};

interface Field {
  path: string;
  value: string;
}

/** Every string anywhere in a hook, with a readable path. A walk rather than a field list, so
 * a field added to types.ts later is checked without anybody remembering to add it here. */
const stringFields = (value: unknown, at: string, out: Field[]): void => {
  if (typeof value === "string") {
    out.push({ path: at, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => stringFields(item, `${at}[${index}]`, out));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      stringFields(nested, at === "" ? key : `${at}.${key}`, out);
    }
  }
};

/** The strings that reach a frame. `caption` and `id` are excluded deliberately: a caption is
 * post copy rather than typography and is not subject to the line budget. */
const renderedLines = (hook: Hook): Field[] => {
  switch (hook.format) {
    case "reframe":
      return [
        { path: "beatOne", value: hook.beatOne },
        { path: "beatTwo", value: hook.beatTwo },
      ];
    case "pain":
      return hook.lines.map((value, index) => ({ path: `lines[${index}]`, value }));
    case "spec":
      return [
        { path: "title", value: hook.title },
        ...hook.items.map((value, index) => ({ path: `items[${index}]`, value })),
      ];
    case "demo":
      return hook.steps.map((step, index) => ({
        path: `steps[${index}].label`,
        value: step.label,
      }));
  }
};

const clipRefs = (hook: Hook): Field[] => {
  switch (hook.format) {
    case "reframe":
    case "pain":
      return [{ path: "clip", value: hook.clip }];
    case "demo":
      return hook.steps.map((step, index) => ({ path: `steps[${index}].clip`, value: step.clip }));
    case "spec":
      return [];
  }
};

// ---- Rule 4, the cut list itself. Checked once rather than per hook that points at it. ----
for (const [name, clip] of Object.entries(clips)) {
  if (clip.to <= clip.from) {
    error(`clips.${name}`, `to (${clip.to}) must be greater than from (${clip.from})`);
  }
}

// ---- Rule 2, over the strings every post carries no matter which hook it is. ----
for (const phase of Object.keys(CTA) as Phase[]) {
  for (const [key, value] of Object.entries(CTA[phase])) {
    if (value.includes(EM_DASH)) {
      error(`CTA.${phase}.${key}`, `contains an em dash: "${value}"`);
    }
  }
}

// The caption templates go through one probe hook rather than through all 24, so a stray em
// dash in the hashtags or in the glue is reported once instead of eighty times.
const PROBE: Hook = {
  id: "spec-000",
  format: "spec",
  seconds: 10,
  title: "probe",
  items: ["probe"],
  caption: "probe",
};
for (const phase of Object.keys(CTA) as Phase[]) {
  const templateStrings: Field[] = [];
  stringFields(captionsFor(PROBE, CTA[phase]), "", templateStrings);
  for (const field of templateStrings) {
    if (field.value.includes(EM_DASH)) {
      error(`captions[${phase}].${field.path}`, "template contains an em dash");
    }
    if (DATING.test(field.value) && !DENIAL.test(field.value)) {
      error(`captions[${phase}].${field.path}`, "template names dating outside a denial");
    }
  }
}

// ---- Per hook ----
const seen = new Map<string, number>();
const clipNames = new Set(Object.keys(clips));

hooks.forEach((hook, index) => {
  const at = (field: string): string => `${hook.id}.${field}`;

  // Rule 1
  if (!ID_PATTERN.test(hook.id)) {
    error(`hooks[${index}].id`, `"${hook.id}" is not <format>-<3 digits>`);
  } else if (!hook.id.startsWith(`${hook.format}-`)) {
    error(at("id"), `id prefix does not match format "${hook.format}"`);
  }
  const previous = seen.get(hook.id);
  if (previous !== undefined) {
    error(at("id"), `duplicate id, already used by hooks[${previous}]`);
  }
  seen.set(hook.id, index);

  // Rules 2 and 3, over every string the hook carries.
  const fields: Field[] = [];
  stringFields(hook, "", fields);
  for (const field of fields) {
    if (field.value.includes(EM_DASH)) {
      error(at(field.path), `contains an em dash: "${field.value}"`);
    }
    const banned = DATING.exec(field.value);
    if (banned && !DENIAL.test(field.value)) {
      error(
        at(field.path),
        `says "${banned[0]}" outside a denial: "${field.value}". That word is only sayable as a correction.`,
      );
    }
  }

  // Rules 4 and 7
  for (const ref of clipRefs(hook)) {
    if (!clipNames.has(ref.value)) {
      error(at(ref.path), `"${ref.value}" is not a clip in src/data/clips.ts`);
      continue;
    }
    const file = clips[ref.value as keyof typeof clips].file;
    if (!fs.existsSync(path.join(FOOTAGE_DIR, file))) {
      const message = `public/footage/${file} is missing`;
      // A demo is nothing but footage, so a missing file is an empty video. The other three
      // render the labelled placeholder panel, which is a usable draft and a visible reminder.
      if (hook.format === "demo") {
        error(at(ref.path), `${message}, and a demo is nothing but footage`);
      } else {
        warn(at(ref.path), `${message}, so this renders the placeholder panel`);
      }
    }
  }

  // Rule 5
  const [min, max] = SECONDS_RANGE[hook.format];
  if (hook.seconds < min || hook.seconds > max) {
    error(at("seconds"), `${hook.seconds} is outside ${min} to ${max} for a ${hook.format}`);
  }

  // Rule 6
  for (const line of renderedLines(hook)) {
    if (line.value.length > LINE_BUDGET) {
      warn(
        at(line.path),
        `${line.value.length} characters, over the ${LINE_BUDGET} budget, so fitText will shrink it`,
      );
    }
  }
});

// ---- Rule 8, the audio. ----
/**
 * The voiceover is DERIVED from a hook's own copy, so the words spoken and the words on screen
 * cannot drift while both are being produced from one source. What can drift is the recording:
 * edit a hook and the WAV on the disk is now of the previous sentence, and nothing about that
 * is visible until somebody watches the video.
 *
 * So the committed table is checked against the copy it claims to be of. That is the one rule
 * here that is an error rather than a warning: a stale mix ships a video whose voice says
 * something the frame does not, which is worse than no voice at all. The fix is one command.
 *
 * Everything else is a warning, because everything else is a state the pipeline handles: a
 * post with no audio yet renders silent, and a read that does not fill its video renders fine
 * and is a note about the cut rather than a fault in it.
 */
const MIX_TOLERANCE_LU = 0.5;
const FIT_TOLERANCE_SECONDS = 1;

/** Collected rather than warned about one at a time. See the aggregate below. */
const misfits: { id: string; delta: number }[] = [];

for (const id of Object.keys(AUDIO)) {
  // The two direction experiments are not `Hook`s and never will be, so they are named rather
  // than looked up. Anything else in the table is a post that has been deleted from the queue
  // and whose mix is now a file nothing plays.
  if (
    !hooks.some((hook) => hook.id === id) &&
    !id.startsWith("kinetic-native") &&
    id !== V6.id &&
    id !== PRO.id
  ) {
    error(
      `audio.${id}`,
      "src/audio/timings.generated.ts holds a post that no longer exists. Re-run pnpm video:audio.",
    );
  }
}

/**
 * The loudness rule, once, for every post that has audio.
 *
 * It reads MIX_TARGET rather than carrying its own copy of the number, and that is the whole
 * point of it being a function: the target moved from -14 to -15 when the mix was rebalanced,
 * and a validator holding a literal would have warned on all twenty five posts for being
 * exactly where they were asked to be. A gate that has its own opinion of the spec is a gate
 * that goes off when the spec changes.
 */
const checkLoudness = (id: string, audio: PostAudio): void => {
  const { integratedLufs, truePeakDb } = audio.loudness;
  if (Math.abs(integratedLufs - MIX_TARGET.lufs) > MIX_TOLERANCE_LU) {
    warn(
      `${id}.audio`,
      `mix measures ${integratedLufs} LUFS, off the ${MIX_TARGET.lufs} target by more than ${MIX_TOLERANCE_LU} LU`,
    );
  }
  if (truePeakDb > MIX_TARGET.truePeakDb + 0.2) {
    warn(`${id}.audio`, `mix true peak is ${truePeakDb} dBTP, which is not under -1`);
  }
};

/**
 * THE DIRECTION, checked the same way a hook is, and it was not before.
 *
 * kinetic-native is not a `Hook`, so it is not in `hooks`, so the stale mix rule above never
 * saw it. That is not a cosmetic gap: the direction was edited from nine beats to five, the
 * audio was NOT rebuilt, and the film rendered with a voice saying the previous script over
 * captions saying the new one. `pnpm validate` reported zero errors on that state, because
 * the one rule written to catch exactly it was iterating a list the direction is not in.
 *
 * So the same three questions are asked here. Does the recorded read still match the copy the
 * frame renders. Does the length of the read still match the length of the film. Is the mix
 * where the mix target says it should be. The first is an ERROR for the same reason it is on
 * a hook: a video whose voice says something the picture does not is worse than a silent one.
 */
/** Frames a beat begins before its own phrase's file does. See THE CLOCK in
 * src/kinetic-native/script.ts for why it is a fixed lead rather than the midpoint of the gap. */
const BEAT_LEAD_FRAMES = 6;

const checkKineticNative = (): void => {
  const audio = AUDIO[KINETIC_NATIVE.id];
  if (audio === undefined) {
    warn(
      `${KINETIC_NATIVE.id}.audio`,
      "no voiceover built yet, so the direction renders silent. Run pnpm video:audio.",
    );
    return;
  }

  const written = voPlanForKineticNative(KINETIC_NATIVE).lines.map((line) => line.written);
  const recorded = audio.lines.map((line) => line.written);
  if (JSON.stringify(written) !== JSON.stringify(recorded)) {
    error(
      `${KINETIC_NATIVE.id}.audio`,
      `the mix says ${JSON.stringify(recorded)} and the beats now read ${JSON.stringify(written)}. Re-run pnpm video:audio.`,
    );
  }

  // Audio is the clock, so a mismatch here means the picture is the wrong length rather than
  // the read being wrong. A whole frame of slack, because the mix is padded to the film and
  // the last comparison worth making is whether the read fits inside it at all.
  const filmFrames = kineticNativeDuration(KINETIC_NATIVE);
  if (audio.frames !== filmFrames) {
    error(
      `${KINETIC_NATIVE.id}.audio`,
      `the mix is ${audio.frames} frames and the film is ${filmFrames}. They are one clock. Re-run pnpm video:audio.`,
    );
  }
  if (audio.voEndFrame > filmFrames) {
    error(
      `${KINETIC_NATIVE.id}.audio`,
      `the read ends at frame ${audio.voEndFrame} and the film ends at ${filmFrames}, so the last words are never heard.`,
    );
  }

  /**
   * EVERY BEAT FULLY CONTAINS ITS OWN PHRASE, AND THE LEAD IS FLAT.
   *
   * This is the property the cut actually rests on and it used to live only in a comment. The
   * beat table in script.ts is derived by hand from the measured read: a beat begins a fixed
   * 6 frames before its phrase's file does. Nothing stopped somebody nudging a beat by two
   * frames afterwards, and the failure mode of doing so is silent and awful: a word arrives
   * after it is spoken, which reads as lag, or a phrase runs past its own cut and is heard
   * over the next beat's picture.
   *
   * So it is checked. The lead is allowed a frame of slack in either direction, because the
   * committed frame numbers are rounded from measured seconds.
   */
  let at = 0;
  KINETIC_NATIVE.beats.forEach((beat, index) => {
    const from = at;
    at += beat.frames;
    const line = audio.lines[index];
    if (line === undefined) {
      error(
        `${KINETIC_NATIVE.id}.beats`,
        `beat ${index + 1} has no phrase in the mix. The read has ${audio.lines.length} lines and the cut has ${KINETIC_NATIVE.beats.length} beats.`,
      );
      return;
    }
    const lead = line.startFrame - from;
    if (Math.abs(lead - BEAT_LEAD_FRAMES) > 1) {
      error(
        `${KINETIC_NATIVE.id}.beats`,
        `beat ${index + 1} starts at frame ${from} and its phrase at ${line.startFrame}, a lead of ${lead} frames where every other beat leads by ${BEAT_LEAD_FRAMES}. The picture must be the same distance ahead of the voice at every cut.`,
      );
    }
    if (line.endFrame > at) {
      error(
        `${KINETIC_NATIVE.id}.beats`,
        `beat ${index + 1} ends at frame ${at} and its phrase runs to ${line.endFrame}, so the last of it is heard over the next beat's picture.`,
      );
    }
  });

  checkLoudness(KINETIC_NATIVE.id, audio);
};

for (const hook of hooks) {
  const audio = AUDIO[hook.id];
  if (audio === undefined) {
    warn(`${hook.id}.audio`, "no voiceover built yet, so this renders silent. Run pnpm video:audio.");
    continue;
  }

  const written = writtenLinesOf(hook);
  const recorded = audio.lines.map((line) => line.written);
  if (JSON.stringify(written) !== JSON.stringify(recorded)) {
    error(
      `${hook.id}.audio`,
      `the mix says ${JSON.stringify(recorded)} and the hook now reads ${JSON.stringify(written)}. Re-run pnpm video:audio.`,
    );
  }

  checkLoudness(hook.id, audio);

  const videoSeconds = postDuration(hook) / FPS;
  const delta = audio.voEndSeconds - videoSeconds;
  if (Math.abs(delta) > FIT_TOLERANCE_SECONDS) {
    misfits.push({ id: hook.id, delta });
  }
}

checkKineticNative();

/**
 * THE SIXTH SCRIPT, and the three directions that share it.
 *
 * Its beat table is DERIVED from the measured read rather than transcribed from it (see
 * src/v6/timing.ts), so two of the four checks below can no longer fail by hand. They are here
 * anyway, because a derivation can be wrong in ways a transcription cannot: `beatFrames` falls
 * back to an ESTIMATE when the audio has not been built, and a film rendered off that estimate
 * would be silently out of time with its own voice at every cut. Asserting the property rather
 * than trusting the function is what catches that.
 *
 * The other two are about the copy, and they are the two notes Cameron gave that a type system
 * cannot see. The rendered lines must rejoin to exactly the phrase that was spoken, so the eye
 * and the ear never drift. And a multi-line stack may not leave a single word alone on a line,
 * which is the "SAME GAME / SAME / HOURS" orphan he caught in the fifth cut.
 */
const checkV6 = (): void => {
  for (const [index, beat] of V6.beats.entries()) {
    const where = `${V6.id}.beat${String(index + 1)}`;
    if (beat.lines.join(" ") !== beat.phrase) {
      error(
        where,
        `the frame renders ${JSON.stringify(beat.lines.join(" "))} and the voice says ${JSON.stringify(beat.phrase)}. The lines are the phrase broken by hand and must rejoin to it exactly.`,
      );
    }
    if (beat.lines.length > 1) {
      const orphan = beat.lines.find((line) => line.trim().split(/\s+/).length < 2);
      if (orphan !== undefined) {
        error(
          where,
          `${JSON.stringify(orphan)} is one word alone on a line of a ${String(beat.lines.length)} line stack, which reads as a mistake. Re-break the phrase or set it on one line.`,
        );
      }
    }
    for (const text of [beat.phrase, ...beat.lines]) {
      if (text.includes(EM_DASH)) {
        error(where, `contains an em dash: ${JSON.stringify(text)}`);
      }
      if (DATING.test(text)) {
        error(where, `names the category this film exists not to be filed under: ${JSON.stringify(text)}`);
      }
    }
  }

  const audio = AUDIO[V6.id];
  if (audio === undefined) {
    warn(
      `${V6.id}.audio`,
      "no voiceover built yet, so all three directions render silent and their beats are estimates. Run pnpm video:audio --only v6-001 twice; see the header of src/v6/timing.ts for why twice.",
    );
    return;
  }

  const written = voPlanForV6(V6).lines.map((line) => line.written);
  const recorded = audio.lines.map((line) => line.written);
  if (JSON.stringify(written) !== JSON.stringify(recorded)) {
    error(
      `${V6.id}.audio`,
      `the mix says ${JSON.stringify(recorded)} and the beats now read ${JSON.stringify(written)}. Re-run pnpm video:audio --only v6-001.`,
    );
  }

  const filmFrames = v6Duration(V6);
  if (audio.frames !== filmFrames) {
    error(
      `${V6.id}.audio`,
      `the mix is ${audio.frames} frames and the film is ${filmFrames}. They are one clock, and the usual cause is that the audio was built once against an estimated length: run pnpm video:audio --only v6-001 again.`,
    );
  }

  const frames = beatFrames(V6);
  const starts = beatStarts(V6);
  starts.forEach((from, index) => {
    const line = audio.lines[index];
    if (line === undefined) {
      error(
        `${V6.id}.beats`,
        `beat ${String(index + 1)} has no phrase in the mix. The read has ${String(audio.lines.length)} lines and the cut has ${String(V6.beats.length)} beats.`,
      );
      return;
    }
    const lead = line.startFrame - from;
    if (Math.abs(lead - V6_LEAD) > 1) {
      error(
        `${V6.id}.beats`,
        `beat ${String(index + 1)} starts at frame ${String(from)} and its phrase at ${String(line.startFrame)}, a lead of ${String(lead)} frames where every other beat leads by ${String(V6_LEAD)}.`,
      );
    }
    const ends = from + (frames[index] ?? 0);
    if (line.endFrame > ends) {
      error(
        `${V6.id}.beats`,
        `beat ${String(index + 1)} ends at frame ${String(ends)} and its phrase runs to ${String(line.endFrame)}, so the last of it is heard over the next beat's picture.`,
      );
    }
  });

  checkLoudness(V6.id, audio);
};

checkV6();

/**
 * THE SEVENTH SCRIPT, checked on exactly the same terms as the sixth, plus one rule the sixth
 * did not need.
 *
 * The copy rules are the same three and for the same reasons: the rendered lines must rejoin
 * to the spoken phrase exactly, a multi-line stack may not leave one word alone on a line, and
 * neither register may carry an em dash or name the category. The audio rules are the same
 * four: the mix must say what the beats now read, the mix and the film must be one length,
 * every phrase must be fully contained by its own beat, and the lead must be flat.
 *
 * THE NEW RULE IS THE NEGATION RULE, and it is here because it is the note Cameron gave twice
 * and the property this script is built around. `src/pro/script.ts` claims in its header that
 * there is not a single "not", "no" or "never" in the read. A claim in a comment is worth
 * nothing; a sentence added later that quietly reintroduces one is exactly how the fifth
 * script became every beat a negation. So the claim is asserted.
 *
 * It is deliberately narrower than a rule about the word "no": DATING above already permits a
 * denial where a denial is the strongest thing to say, and that is a different film's problem.
 * This one is a rule about THIS script only.
 */
const NEGATION = /\b(not|no|never|isn['’]?t|don['’]?t|doesn['’]?t|won['’]?t|can['’]?t)\b/i;

const checkPro = (): void => {
  for (const [index, beat] of PRO.beats.entries()) {
    const where = `${PRO.id}.beat${String(index + 1)}`;
    if (beat.lines.join(" ") !== beat.phrase) {
      error(
        where,
        `the frame renders ${JSON.stringify(beat.lines.join(" "))} and the voice says ${JSON.stringify(beat.phrase)}. The lines are the phrase broken by hand and must rejoin to it exactly.`,
      );
    }
    if (beat.lines.length > 1) {
      const orphan = beat.lines.find((line) => line.trim().split(/\s+/).length < 2);
      if (orphan !== undefined) {
        error(
          where,
          `${JSON.stringify(orphan)} is one word alone on a line of a ${String(beat.lines.length)} line stack, which reads as a mistake. Re-break the phrase or set it on one line.`,
        );
      }
    }
    if (!new RegExp(`\\b${beat.key}\\b`, "i").test(beat.phrase)) {
      error(
        where,
        `the accent word ${JSON.stringify(beat.key)} is not in ${JSON.stringify(beat.phrase)}, so no direction can mark it.`,
      );
    }
    if (/[.!?]$/.test(beat.phrase)) {
      error(
        where,
        `${JSON.stringify(beat.phrase)} carries its own terminal punctuation. speakable() adds the full stop the synthesiser needs and the frame should not render one.`,
      );
    }
    for (const text of [beat.phrase, ...beat.lines]) {
      if (text.includes(EM_DASH)) {
        error(where, `contains an em dash: ${JSON.stringify(text)}`);
      }
      if (DATING.test(text)) {
        error(where, `names the category this film exists not to be filed under: ${JSON.stringify(text)}`);
      }
      if (NEGATION.test(text)) {
        error(
          where,
          `contains a negation: ${JSON.stringify(text)}. This script says what the product does and never what it lacks; see the header of src/pro/script.ts.`,
        );
      }
    }
  }

  const audio = AUDIO[PRO.id];
  if (audio === undefined) {
    warn(
      `${PRO.id}.audio`,
      "no voiceover built yet, so all three directions render silent and their beats are estimates. Run pnpm video:audio --only pro-001 twice; see the header of src/pro/timing.ts for why twice.",
    );
    return;
  }

  const written = voPlanForPro(PRO).lines.map((line) => line.written);
  const recorded = audio.lines.map((line) => line.written);
  if (JSON.stringify(written) !== JSON.stringify(recorded)) {
    error(
      `${PRO.id}.audio`,
      `the mix says ${JSON.stringify(recorded)} and the beats now read ${JSON.stringify(written)}. Re-run pnpm video:audio --only pro-001.`,
    );
  }

  const filmFrames = proDuration(PRO);
  if (audio.frames !== filmFrames) {
    error(
      `${PRO.id}.audio`,
      `the mix is ${audio.frames} frames and the film is ${filmFrames}. They are one clock, and the usual cause is that the audio was built once against an estimated length: run pnpm video:audio --only pro-001 again.`,
    );
  }

  const frames = proBeatFrames(PRO);
  const starts = proBeatStarts(PRO);
  starts.forEach((from, index) => {
    const line = audio.lines[index];
    if (line === undefined) {
      error(
        `${PRO.id}.beats`,
        `beat ${String(index + 1)} has no phrase in the mix. The read has ${String(audio.lines.length)} lines and the cut has ${String(PRO.beats.length)} beats.`,
      );
      return;
    }
    const lead = line.startFrame - from;
    if (Math.abs(lead - PRO_LEAD) > 1) {
      error(
        `${PRO.id}.beats`,
        `beat ${String(index + 1)} starts at frame ${String(from)} and its phrase at ${String(line.startFrame)}, a lead of ${String(lead)} frames where every other beat leads by ${String(PRO_LEAD)}.`,
      );
    }
    const ends = from + (frames[index] ?? 0);
    if (line.endFrame > ends) {
      error(
        `${PRO.id}.beats`,
        `beat ${String(index + 1)} ends at frame ${String(ends)} and its phrase runs to ${String(line.endFrame)}, so the last of it is heard over the next beat's picture.`,
      );
    }
  });

  checkLoudness(PRO.id, audio);
};

checkPro();

/**
 * THE TYPE DIRECTION'S BREAK TABLE.
 *
 * src/type-clean/ sets each beat as one SUPPORT line over one HERO line, and it breaks the
 * phrase at a different place than src/v6/script.ts does, because there a break balances two
 * halves of a sentence and here it decides which words are the frame and which word is the
 * subject. Two registers means two chances for the copy and the read to drift apart, so the
 * three properties that stop it are asserted rather than trusted.
 *
 *   THE WORDS ARE THE SCRIPT'S. `support` and `hero` joined by one space must equal the beat's
 *   spoken `phrase` exactly. Not one word added, dropped, re-ordered or re-spelled.
 *
 *   THE STACK IS EXACTLY TWO LINES, one per register. That is what makes the orphan Cameron
 *   caught in the fifth cut impossible here rather than merely absent. "SAME GAME / SAME /
 *   HOURS" read as broken because three lines in ONE register held one word between them; a one
 *   word line is only ever a mistake when nothing tells the eye it was intended. With exactly
 *   two lines three times apart in size, three weight steps apart, tracked in opposite
 *   directions and set in opposite case, every line is unmistakably in a register of its own.
 *
 *   THE HERO IS ONE OR TWO WORDS. This is the arithmetic that lets the whole film be set at ONE
 *   hero size: a longer hero fits at a smaller size, and the size the film picks is the
 *   smallest of them, so a five word hero would drag every beat down with it and hand the
 *   decision back to spelling, which is the defect the direction was rebuilt to remove.
 */
const checkTypeClean = (): void => {
  TYPE_CLEAN_BEATS.forEach((beat, index) => {
    const where = `type-clean.beat${String(index + 1)}`;
    const phrase = V6.beats[index]?.phrase;
    if (phrase === undefined) {
      error(where, `there is no beat ${String(index + 1)} in ${V6.id} for this stack to set.`);
      return;
    }
    const joined = `${beat.support} ${beat.hero}`;
    if (joined !== phrase) {
      error(
        where,
        `the frame renders ${JSON.stringify(joined)} and the voice says ${JSON.stringify(phrase)}. The support and the hero are the phrase broken by hand and must rejoin to it exactly.`,
      );
    }
    const heroWords = beat.hero.trim().split(/\s+/).length;
    if (heroWords > 2) {
      error(
        where,
        `the hero ${JSON.stringify(beat.hero)} is ${String(heroWords)} words. The film is set at one hero size, which is the smallest fit of them all, so a long hero shrinks every other beat and hands the size back to spelling. Two words is the ceiling.`,
      );
    }
    if (beat.support.trim() === "") {
      error(where, "the support line is empty, so this beat has no label register at all.");
    }
    for (const text of [beat.support, beat.hero]) {
      if (text.includes(EM_DASH)) {
        error(where, `contains an em dash: ${JSON.stringify(text)}`);
      }
      if (DATING.test(text)) {
        error(where, `names the category this film exists not to be filed under: ${JSON.stringify(text)}`);
      }
    }
  });

  if (TYPE_CLEAN_BEATS.length !== V6.beats.length) {
    error(
      "type-clean.beats",
      `the direction sets ${String(TYPE_CLEAN_BEATS.length)} stacks and ${V6.id} has ${String(V6.beats.length)} beats. They are one film.`,
    );
  }
};

checkTypeClean();

/**
 * One line, not one per post.
 *
 * Every hook in the queue currently misfits, and twenty four identical warnings is how a
 * warning list becomes something nobody reads. It is also one finding rather than twenty four:
 * the videos were timed before there was a voice to time them against. `pnpm video:audio`
 * prints the per post table, which is where somebody who is about to re-cut one wants it.
 */
if (misfits.length > 0) {
  const worst = [...misfits].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]!;
  const overruns = misfits.filter((row) => row.delta > 0).length;
  const smallest = Math.min(...misfits.map((row) => Math.abs(row.delta)));
  warn(
    "audio.fit",
    `${misfits.length} of ${hooks.length} posts do not match the length of their own read, by ${smallest.toFixed(1)}s to ${Math.abs(worst.delta).toFixed(1)}s (worst: ${worst.id}${worst.delta > 0 ? ", which overruns" : ""}). ${overruns > 0 ? `${overruns} overrun and lose a word. ` : ""}Audio is the clock, so the picture is what needs re-cutting. pnpm video:audio prints the table.`,
  );
}

// ---- Report ----
/**
 * Prints the findings and returns the error count. A function rather than a bare block so
 * the daily batch can run exactly this validation in-process, in the same order and with the
 * same wording, instead of shelling out to a second node and parsing its exit code. The
 * batch aborting on something `pnpm validate` would have called fine is the failure mode
 * that costs a morning, so there is one implementation and no second opinion.
 */
export const reportContent = (): number => {
  const errors = problems.filter((problem) => problem.level === "error");
  const warnings = problems.filter((problem) => problem.level === "warning");
  const width = Math.max(0, ...problems.map((problem) => problem.where.length));
  const plural = (count: number, noun: string): string =>
    `${count} ${noun}${count === 1 ? "" : "s"}`;

  console.log(`validate-content: ${hooks.length} hooks, ${clipNames.size} clips`);
  for (const problem of [...errors, ...warnings]) {
    const tag = problem.level === "error" ? "ERROR" : "warn ";
    console.log(`  ${tag}  ${problem.where.padEnd(width)}  ${problem.message}`);
  }
  console.log(`${plural(errors.length, "error")}, ${plural(warnings.length, "warning")}`);

  return errors.length;
};

// Runs as a script, and stays importable for the reason above. Same guard as sync-assets.ts.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (reportContent() > 0) {
    process.exit(1);
  }
}
