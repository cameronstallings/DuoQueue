import type { Format, Hook } from "../types";
import type { Ledger } from "./ledger";

/**
 * Which three hooks go out today. Pure: it takes the queue and the ledger and returns picks,
 * so it can be checked by calling it with a synthetic ledger instead of by rendering a day.
 *
 * The rule is rotation, not randomness and not the date. Walking a fixed cycle means a day's
 * three are three different formats, that a viewer who sees two DuoQueue posts sees two
 * different kinds of post, and that missing a Tuesday costs a day rather than a hook.
 */

/**
 * `demo` sits last deliberately. The spec calls it lowest reach and highest intent, so it
 * should surface about once every four videos rather than a quarter of every day.
 */
export const FORMAT_CYCLE: readonly Format[] = ["reframe", "pain", "spec", "demo"];

/** Ten times round the cycle. Long enough that a queue with three formats exhausted still
 * fills its slots from the fourth, short enough that an empty queue fails in microseconds
 * instead of looping. */
const MAX_STEPS = 40;

export interface Selection {
  /** In posting order, which is cycle order. */
  picks: Hook[];
  /** Where the next day starts. Belongs in the ledger unchanged. */
  cyclePos: number;
  /** True when the day could only be filled by taking two of the same format. The caller
   * warns; it is not an error, because a slightly repetitive day beats no videos on posting
   * day. */
  repeatedFormats: boolean;
}

const EMPTY_COUNTS: Record<Format, number> = { reframe: 0, pain: 0, spec: 0, demo: 0 };

/** What is left, per format. The number Cameron needs when the queue runs dry, and the one
 * `--dry-run` prints so he can see it coming. */
export const unrenderedByFormat = (
  hooks: readonly Hook[],
  ledger: Ledger,
): Record<Format, number> => {
  const shipped = new Set(ledger.renderedIds);
  const counts = { ...EMPTY_COUNTS };
  for (const hook of hooks) {
    if (!shipped.has(hook.id)) {
      counts[hook.format] += 1;
    }
  }
  return counts;
};

export const selectDay = (
  hooks: readonly Hook[],
  ledger: Ledger,
  count = 3,
): Selection => {
  const shipped = new Set(ledger.renderedIds);
  const start = ledger.cyclePos % FORMAT_CYCLE.length;

  const picks: Hook[] = [];
  const pickedIds = new Set<string>();
  /** How far into the walk the last pick was made. The next day starts one past it, so the
   * cycle carries across days rather than restarting at reframe every morning. */
  let lastStep = -1;

  // Lowest index wins, which is why hooks.ts says order inside a format is posting priority:
  // the strongest hook of each format is first and goes out first.
  const nextOf = (format: Format): Hook | undefined =>
    hooks.find(
      (hook) => hook.format === format && !shipped.has(hook.id) && !pickedIds.has(hook.id),
    );

  const walk = (allowRepeatFormats: boolean): void => {
    for (let step = 0; step < MAX_STEPS && picks.length < count; step += 1) {
      const format = FORMAT_CYCLE[(start + step) % FORMAT_CYCLE.length]!;
      if (!allowRepeatFormats && picks.some((pick) => pick.format === format)) {
        continue;
      }
      const hook = nextOf(format);
      if (!hook) {
        continue;
      }
      picks.push(hook);
      pickedIds.add(hook.id);
      lastStep = step;
    }
  };

  walk(false);
  // Pass 1 visits every format, so anything it left unfilled has no unrendered hooks at all.
  // Pass 2 can therefore only add repeats, which is exactly the trade being made.
  const repeatedFormats = picks.length < count;
  if (repeatedFormats) {
    walk(true);
  }

  if (picks.length < count) {
    const remaining = unrenderedByFormat(hooks, ledger);
    const perFormat = FORMAT_CYCLE.map((format) => `${format} ${remaining[format]}`).join(", ");
    throw new Error(
      [
        `Only ${picks.length} of ${count} slots could be filled from ${hooks.length} hooks.`,
        `Unrendered per format: ${perFormat}.`,
        "Add hooks to src/data/hooks.ts.",
      ].join("\n"),
    );
  }

  return {
    picks,
    cyclePos: (start + lastStep + 1) % FORMAT_CYCLE.length,
    repeatedFormats,
  };
};
