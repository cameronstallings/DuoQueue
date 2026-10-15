import type { MatchSessionRow, MessageRow } from "@duoqueue/shared-types";

/**
 * The chat's play-together row: Discord, "I'm free now" and "Pick a time", one tap above the
 * composer instead of three rows deep in the "..." menu.
 *
 * Why it moved. Since launch there have been 0 Discord shares and 0 confirmed sessions, and the
 * only thing standing between a match and either of them was that both tools lived behind the
 * overflow menu, under a heading nobody opened. A match is worth something only when the two of
 * them end up in a game together, and these are the two ways the app gets them there.
 *
 * Every decision the row makes lives here, pure and tested (playTogether.test.ts): which chips
 * show, what the Discord chip says, when "I'm free now" cools down, which proposal still counts,
 * and whether the three labels fit one line on a 375pt phone. The screen and PlayTogetherChips
 * only draw it.
 */

/** Sent as a normal chat message by the chip and by the menu row. Moved verbatim from the chat
 * screen (the cooldown below matches on it, so it must never be reworded in one place only). */
export const FREE_NOW_MESSAGE = "🎮 I'm free to play right now!";

/** A confirmed session still reads "Playing ..." for 2 hours after its start time, then it is
 * over. The server never ends a CONFIRMED row (0077's cron cancels only stale pending ones), so
 * without this a confirmed session from last week hid the chips for good. */
export const SESSION_CONFIRMED_LIVE_MS = 2 * 60 * 60 * 1000;

/** A pending proposal can be answered until 30 minutes after its time (0077: `respond_session`
 * raises `session_time_passed` after that), so Confirm disappears with it. */
export const SESSION_PENDING_LIVE_MS = 30 * 60 * 1000;

/** One "I'm free now" per 5 minutes: it is a message, and two in a row reads as spam. */
export const FREE_NOW_COOLDOWN_MS = 5 * 60 * 1000;

export const PLAY_TOGETHER_COPY = {
  addDiscord: "Add your Discord",
  shareDiscord: "Share my Discord",
  freeNow: "I'm free now",
  pickTime: "Pick a time",
  /** The menu's Discord row once it is shared. */
  discordAlreadyShared: "Discord already shared",
  emptyChatSubtitle: "Say hi, then share your Discord or pick a time to play.",
  toastDiscordShared: "Discord shared",
  toastCopied: "Copied",
  shareFailedTitle: "Couldn't share your Discord",
  messageNotSentTitle: "Message not sent",
  somethingWentWrong: "Something went wrong",
  tryAgain: "Please try again.",
} as const;

type SessionLike = Pick<MatchSessionRow, "status" | "scheduled_at">;

/**
 * The session the chat should still show, or null: a confirmed one until 2 hours after its
 * time, a pending one until 30 minutes after, anything else (cancelled, declined, unreadable)
 * never. Returns the same object, so the banner can read its id and proposer.
 */
export function liveSession<T extends SessionLike>(session: T | null | undefined, now: number): T | null {
  if (!session) return null;
  const at = Date.parse(session.scheduled_at);
  if (!Number.isFinite(at)) return null;
  if (session.status === "confirmed") return at > now - SESSION_CONFIRMED_LIVE_MS ? session : null;
  if (session.status === "pending") return at > now - SESSION_PENDING_LIVE_MS ? session : null;
  return null;
}

/**
 * Whether the chip row shows. Hidden in a locked chat (the composer is the upgrade card there,
 * and the paywall stays the one way forward) and while a confirmed session is live (the two of
 * them already have a time; the banner says it). A session still loading counts as none: a
 * confirmed session is rare, and a row that pops in late is worse than one that leaves.
 */
export function chipsVisible({
  session,
  isLocked,
  now,
}: {
  session: SessionLike | null | undefined;
  isLocked: boolean;
  now: number;
}): boolean {
  if (isLocked) return false;
  return liveSession(session, now)?.status !== "confirmed";
}

export type DiscordChipState = "hidden" | "share" | "add";

/** Hidden once this player has shared it in this chat; "Share my Discord" when a username is
 * saved; otherwise "Add your Discord", which opens the editor first (0073 refuses a share with
 * no username, so the old menu hid the row and the tool was simply missing). */
export function discordChipState({ hasUsername, hasShared }: { hasUsername: boolean; hasShared: boolean }): DiscordChipState {
  if (hasShared) return "hidden";
  return hasUsername ? "share" : "add";
}

type MessageLike = Pick<MessageRow, "sender_id" | "content" | "created_at">;

/**
 * When the current "I'm free now" cooldown ends (ms), or null when there is none: 5 minutes
 * after the newest of MY messages that is exactly `FREE_NOW_MESSAGE`. An optimistic temp row
 * counts, so a double tap cannot slip a second one out before the first one lands.
 *
 * TWO CLOCKS. A server row's created_at is the server's clock, while `now` and a temp row are the
 * phone's, so a phone whose clock is off reads its own message as older or newer than it is.
 * - Slow phone: the server row looks like it is from the future. Every time is capped at `now`, so
 *   the cooldown never runs more than 5 minutes past the moment it is worked out.
 * - Fast phone: the server row looks old, and the cooldown would end the moment it replaced the
 *   temp row. `sentAt` is this phone's own clock reading when it last sent one in this chat (the
 *   chat keeps it while it is open), and the later of the two wins.
 */
export function freeNowCooldownUntil({
  messages,
  myId,
  now,
  sentAt,
}: {
  messages: readonly MessageLike[];
  myId: string | undefined;
  now: number;
  sentAt?: number | null;
}): number | null {
  if (!myId) return null;
  let newest = typeof sentAt === "number" && Number.isFinite(sentAt) ? Math.min(sentAt, now) : -Infinity;
  for (const m of messages) {
    if (m.sender_id !== myId || m.content !== FREE_NOW_MESSAGE) continue;
    const at = Math.min(Date.parse(m.created_at), now);
    if (Number.isFinite(at) && at > newest) newest = at;
  }
  const until = newest + FREE_NOW_COOLDOWN_MS;
  return until > now ? until : null;
}

export function freeNowCoolingDown(input: {
  messages: readonly MessageLike[];
  myId: string | undefined;
  now: number;
  sentAt?: number | null;
}): boolean {
  return freeNowCooldownUntil(input) !== null;
}

/**
 * Fit maths for the row, so "three chips on one line at 375pt" is a test rather than a hope.
 * A chip's label is `type.chipText`: IBM Plex Mono at 10pt, whose advance is 0.6em (6pt), plus
 * 0.6 letter spacing, so 6.6pt a character. Its chrome is 2 x (spacing.sm + 1) of padding plus
 * a 1px border each side: 20pt. The row's gap is spacing.sm.
 */
export const CHIP_CHAR_W = 6.6;
export const CHIP_CHROME_W = 20;
export const CHIP_GAP = 8;

export function chipRowWidth(labels: readonly string[]): number {
  if (labels.length === 0) return 0;
  const chips = labels.reduce((sum, label) => sum + label.length * CHIP_CHAR_W + CHIP_CHROME_W, 0);
  return chips + CHIP_GAP * (labels.length - 1);
}
