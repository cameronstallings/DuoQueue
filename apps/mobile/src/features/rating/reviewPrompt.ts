/**
 * When DuoQueue may ask iOS for the App Store rating sheet. Pure (no imports), so every rule is
 * pinned by vitest; `requestReview.ts` does the storage and the native call.
 *
 * The moments: right after a player's 2nd distinct DUO LOCKED (or any later one, so a 2nd that was
 * cut short leaves the 3rd eligible), or right after a live reply to their own message. Those are
 * the two points where the app has just done the thing it promises. Never on a button, never
 * behind a "Do you like DuoQueue?" screen (App Store 5.6.1).
 *
 * The limits: once per app version, at least 120 days apart, and never in a session where the
 * player reported, blocked or unmatched someone (`reviewSession.ts`): that was a bad moment, and
 * asking for stars on top of it is how an app earns one-star reviews. Apple decides on top of all
 * of this whether the sheet shows at all (at most 3 times a year), and TestFlight never shows it.
 *
 * The ledger is per device (AsyncStorage) and counts DISTINCT match ids, so reopening the same
 * DUO LOCKED never counts twice.
 */

export type ReviewTrigger = "second-duo-locked" | "first-reply";

export interface ReviewLedger {
  lastAskedAtMs: number | null;
  lastAskedVersion: string | null;
  lockedMatchIds: string[];
}

export const EMPTY_REVIEW_LEDGER: ReviewLedger = Object.freeze({
  lastAskedAtMs: null,
  lastAskedVersion: null,
  lockedMatchIds: [],
}) as ReviewLedger;

export const REVIEW_COOLDOWN_MS = 120 * 86_400_000;

/** How long after the moment the ask waits, so the DUO LOCKED or the reply lands first. */
export const REVIEW_DELAY_MS = 2000;

export const MAX_REMEMBERED_LOCKS = 20;

function normalizeId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const normalized = id.trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

/** Whatever AsyncStorage held (a JSON string, or already an object), read tolerantly. */
export function parseReviewLedger(raw: unknown): ReviewLedger {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ...EMPTY_REVIEW_LEDGER, lockedMatchIds: [] };
    }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_REVIEW_LEDGER, lockedMatchIds: [] };
  }
  const record = value as Record<string, unknown>;
  const lastAskedAtMs =
    typeof record.lastAskedAtMs === "number" && Number.isFinite(record.lastAskedAtMs) ? record.lastAskedAtMs : null;
  const lastAskedVersion =
    typeof record.lastAskedVersion === "string" && record.lastAskedVersion !== "" ? record.lastAskedVersion : null;
  const ids: string[] = [];
  if (Array.isArray(record.lockedMatchIds)) {
    for (const raw of record.lockedMatchIds) {
      const id = normalizeId(raw);
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return { lastAskedAtMs, lastAskedVersion, lockedMatchIds: ids.slice(-MAX_REMEMBERED_LOCKS) };
}

export function shouldAskForReview({
  ledger,
  appVersion,
  nowMs,
  safetyActionThisSession,
}: {
  ledger: ReviewLedger;
  appVersion: string | null | undefined;
  nowMs: number;
  safetyActionThisSession: boolean;
}): boolean {
  if (safetyActionThisSession) return false;
  if (!appVersion) return false;
  if (ledger.lastAskedVersion === appVersion) return false;
  if (ledger.lastAskedAtMs !== null) {
    // A stamp in the future means the clock moved; do not trust it to have expired.
    if (ledger.lastAskedAtMs > nowMs) return false;
    if (nowMs - ledger.lastAskedAtMs < REVIEW_COOLDOWN_MS) return false;
  }
  return true;
}

/**
 * Counts a DUO LOCKED. A repeat id (case and spaces ignored) changes nothing and returns the same
 * ledger object; the newest 20 ids are kept. `isTrigger` once there are 2 or more distinct locks.
 */
export function recordDuoLocked(ledger: ReviewLedger, matchId: string): { ledger: ReviewLedger; isTrigger: boolean } {
  const id = normalizeId(matchId);
  if (!id || ledger.lockedMatchIds.includes(id)) return { ledger, isTrigger: false };
  const lockedMatchIds = [...ledger.lockedMatchIds, id].slice(-MAX_REMEMBERED_LOCKS);
  return { ledger: { ...ledger, lockedMatchIds }, isTrigger: lockedMatchIds.length >= 2 };
}

export function markReviewAsked(ledger: ReviewLedger, appVersion: string, nowMs: number): ReviewLedger {
  return { ...ledger, lastAskedAtMs: nowMs, lastAskedVersion: appVersion };
}

/**
 * The chat's newest message is THEIRS, arrived while the chat was open (at or after mount), and
 * the one before it is MINE: they just answered the player. Messages oldest first.
 */
export function isLiveReplyToMe(
  messages: readonly { senderId: string; atMs: number }[],
  myId: string | null | undefined,
  mountedAtMs: number,
): boolean {
  if (!myId || messages.length < 2) return false;
  const newest = messages[messages.length - 1];
  const before = messages[messages.length - 2];
  if (!newest || !before) return false;
  if (newest.senderId === myId) return false;
  if (!Number.isFinite(newest.atMs) || newest.atMs < mountedAtMs) return false;
  return before.senderId === myId;
}
