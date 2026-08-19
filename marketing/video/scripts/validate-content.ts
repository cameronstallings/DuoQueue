import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { captionsFor } from "../src/config/captions";
import { CTA, type Phase } from "../src/config/phase";
import { clips } from "../src/data/clips";
import { hooks } from "../src/data/hooks";
import type { Hook } from "../src/types";

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
