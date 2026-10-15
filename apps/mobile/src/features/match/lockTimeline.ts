import { RINGS_MS } from "./matchMoment";

/**
 * "The ring closes": when every part of DUO LOCKED happens, in ms. Pure (lockTimeline.test.ts),
 * so the schedule is tested in node and DuoLockedScreen only plays it.
 *
 * Three schedules from one function:
 *
 * - Plain DUO LOCKED (variant "match", no popped time): exactly the schedule the match screen has
 *   always had, counted from the screen opening. The sheet slides up for 250ms, the rings slide
 *   together for 520ms and lock at 770, then the players, the reason, the sentence and the
 *   buttons.
 * - The sender's DUO LOCKED after a Duo Pop (variant "match" with a popped time): the same lock
 *   at 770, then the "POPPED IN 0:41" stamp rolls in under DUO LOCKED (from 1030, landing at
 *   1550), and everything below waits for it.
 * - The Pop card (variant "pop"), counted from T0, the moment `answer_duo_pop` says "locked":
 *   the countdown ring closes (160ms), the rings set off at 140, lock at 660, and the rest follows
 *   the popped stamp as above. Settled at T0 + 1960.
 *
 * The haptics follow the same clock: success at the lock, selection when the digits land, 780ms
 * apart (the heavy tap when the Pop card opens and the rigid one on I'm in come before T0).
 */

/** The match screen is a modal sheet still sliding up for about this long. */
export const SHEET_IN_MS = 250;
/** The brackets set off this long after the rings, so their spring first reaches home at the
 * lock (BRACKET_SPRING overshoots; it first crosses its target about 132ms in). */
export const BRACKETS_AFTER_RINGS_MS = 380;
/** The lock's volt flash, up and back down. */
export const FLASH_MS = 200;
/** "DUO LOCKED" stamping in (opacity, scale 1.25 to 1). */
export const STAMP_MS = 260;

/** The Pop card: the drained gap of the countdown ring fills in volt. */
export const POP_CLOSE_MS = 160;
/** The Pop card: the rings set off this long after T0, once the ring has closed. */
export const POP_RINGS_AFTER_MS = 140;
/** The Pop card: the Q fades in as it flies in from the right. */
export const POP_Q_FADE_MS = 200;
/** The Pop card: at the lock the volt O hands over to the ink O, so the final frame is the mark. */
export const POP_INK_MS = 240;
/** The Pop card: the countdown's content (name, game, buttons) fades out at T0. */
export const POP_CONTENT_OUT_MS = 180;
/** The Pop card: the m:ss in the ring and the "Duo Pop" label fade out this quickly. */
export const POP_LABEL_OUT_MS = 120;

/** The Popped-in line starts this long after the lock: when the stamp has finished. */
export const POPPED_AFTER_LOCK_MS = 260;
/** The Popped-in line fades in over this long as its digits start to roll. */
export const POPPED_FADE_MS = 120;
/** The digits roll for this long, then land (one selection tap). */
export const POPPED_ROLL_MS = 520;

/** Every fade after the lock. */
export const FADE_MS = 300;
/** The buttons rise and fade in over this long. */
export const BUTTONS_FADE_MS = 400;
/** The caller's card under the buttons (the push pre-ask) follows them by this much. */
const BELOW_BUTTONS_AFTER_MS = 200;

/** After the lock, when each block fades in: today's plain schedule, and the later one that waits
 * for a Popped-in stamp to land. */
const AFTER_LOCK = {
  plain: { players: 120, reason: 350, sentence: 420, buttons: 500 },
  popped: { players: 600, reason: 760, sentence: 820, buttons: 900 },
} as const;

export type LockVariant = "match" | "pop";

export interface LockSchedule {
  ringsAt: number;
  bracketsAt: number;
  lockAt: number;
  /** Null without a popped-in time. */
  poppedAt: number | null;
  poppedLandsAt: number | null;
  playersAt: number;
  reasonAt: number;
  sentenceAt: number;
  buttonsAt: number;
  belowButtonsAt: number;
  settledAt: number;
}

export function lockSchedule(variant: LockVariant, popped: boolean): LockSchedule {
  const ringsAt = variant === "match" ? SHEET_IN_MS : POP_RINGS_AFTER_MS;
  const lockAt = ringsAt + RINGS_MS;
  const poppedAt = popped ? lockAt + POPPED_AFTER_LOCK_MS : null;
  const after = popped ? AFTER_LOCK.popped : AFTER_LOCK.plain;
  const buttonsAt = lockAt + after.buttons;
  return {
    ringsAt,
    bracketsAt: ringsAt + BRACKETS_AFTER_RINGS_MS,
    lockAt,
    poppedAt,
    poppedLandsAt: poppedAt === null ? null : poppedAt + POPPED_ROLL_MS,
    playersAt: lockAt + after.players,
    reasonAt: lockAt + after.reason,
    sentenceAt: lockAt + after.sentence,
    buttonsAt,
    belowButtonsAt: buttonsAt + BELOW_BUTTONS_AFTER_MS,
    settledAt: buttonsAt + BUTTONS_FADE_MS,
  };
}
