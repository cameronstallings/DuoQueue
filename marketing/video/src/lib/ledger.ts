import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * What has already shipped. This is the only piece of state the pipeline keeps, and it is
 * committed on purpose: it is two fields of JSON, and the alternative (deriving the day's
 * three from the date) silently re-renders or skips whenever a day is missed, which days
 * will be.
 *
 * Node only. It is under src/ because select.ts is, and select.ts is the half of the
 * selection that a browser could in principle run; this half reads a file and must never end
 * up in a composition's import graph. Nothing under src/components or src/formats imports it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));

/** Anchored on this file rather than on cwd, so `pnpm render-day` and
 * `pnpm --dir marketing/video render-day` and a bare `tsx scripts/render-day.ts` all write
 * the same ledger. (webpack-override.ts anchors on cwd instead, for a reason specific to how
 * the Remotion CLI evaluates it. Nothing evaluates this file but tsx.) */
export const LEDGER_PATH = path.resolve(here, "..", "..", "state", "rendered.json");

export interface Ledger {
  /** Hook ids that have been rendered into a day folder, in the order they shipped. */
  renderedIds: string[];
  /** Where the format rotation stands. An index into select.ts's FORMAT_CYCLE, which
   * normalizes it, so a hand-edited value larger than the cycle still means something. */
  cyclePos: number;
}

/** The path as Cameron would type it, for error messages. Absolute paths in a message about
 * a committed file read like a machine problem when it is a repo problem. */
const RELATIVE = "marketing/video/state/rendered.json";

const SEED = `{\n  "renderedIds": [],\n  "cyclePos": 0\n}\n`;

export const readLedger = (): Ledger => {
  if (!fs.existsSync(LEDGER_PATH)) {
    // Not created silently: an absent ledger and an empty one are the same file, but they
    // mean opposite things. Empty means nothing has shipped; absent means the record of what
    // shipped was lost, and rendering against it would re-post hooks that are already out.
    throw new Error(
      [
        `${RELATIVE} is missing. It is committed, so this is a deletion, not a fresh start.`,
        `Restore it with \`git checkout ${RELATIVE}\`, or, if this really is a new queue,`,
        `create it containing:\n${SEED}`,
      ].join("\n"),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8"));
  } catch (cause) {
    throw new Error(`${RELATIVE} is not valid JSON: ${(cause as Error).message}`);
  }

  const candidate = parsed as Partial<Ledger>;
  const ids = candidate.renderedIds;
  const cyclePos = candidate.cyclePos;

  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
    throw new Error(`${RELATIVE}: renderedIds must be an array of hook ids.`);
  }
  if (typeof cyclePos !== "number" || !Number.isInteger(cyclePos) || cyclePos < 0) {
    throw new Error(`${RELATIVE}: cyclePos must be a whole number, and is ${String(cyclePos)}.`);
  }

  return { renderedIds: [...ids], cyclePos };
};

/**
 * Written once, at the end of a batch, after every render has succeeded. A crash halfway
 * through therefore costs the renders that did finish and nothing else: the same three hooks
 * come up again on the next run, which is the recoverable failure. Consuming hooks up front
 * and crashing is the unrecoverable one.
 *
 * Two spaces and a trailing newline because this file is committed and its diffs are read.
 */
export const writeLedger = (ledger: Ledger): void => {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.writeFileSync(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
};
