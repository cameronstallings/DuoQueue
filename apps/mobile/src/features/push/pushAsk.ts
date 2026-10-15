/**
 * When and how the app asks for notification permission, as pure rules (pushAsk.test.ts).
 *
 * Why the ask moved. Until 1.0.2 the iOS prompt fired cold, the moment a profile became ready,
 * in the middle of signup. 18 of the 19 tokens on file were granted within 0.3 minutes of that
 * prompt, so the people who said yes said it on reflex, and 9 of 24 onboarded players have no
 * token at all: they said no to a question asked before the app had given them a reason. iOS
 * shows its prompt once per install, so a wasted prompt is gone for good.
 *
 * Since 1.0.2 the app asks at the moments a notification pays off, with its own card first
 * (so "Not now" costs nothing and the iOS prompt is kept for a yes):
 * - on the deck, right after a Duo that did not match ("Get notified when they duo you back?");
 * - on DUO LOCKED ("Get notified when Kai messages you?");
 * - in Settings > Notifications, as a standing line rather than an interruption.
 * One ask a week across every surface, and the deck slot is shared with the Duo Pops card, which
 * wins it while the player is eligible (it asks for the same permission and more).
 */

/** At most one ask a week, across every surface. */
export const PUSH_ASK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export interface PushPermissionState {
  status: "granted" | "denied" | "undetermined";
  /** False once iOS will never show its prompt again (the player said no before): the only way
   * left is the Settings app. */
  canAskAgain: boolean;
}

/** expo-notifications' `getPermissionsAsync()` answer, narrowed. `granted: true` wins whatever
 * the status says (iOS provisional and ephemeral are granted). Junk reads as undetermined,
 * askable unless the OS explicitly said it cannot ask again. */
export function permissionStateOf(raw: unknown): PushPermissionState {
  const r = raw && typeof raw === "object" ? (raw as { status?: unknown; granted?: unknown; canAskAgain?: unknown }) : {};
  const status: PushPermissionState["status"] =
    r.granted === true || r.status === "granted" ? "granted" : r.status === "denied" ? "denied" : "undetermined";
  const canAskAgain = typeof r.canAskAgain === "boolean" ? r.canAskAgain : status !== "denied";
  return { status, canAskAgain };
}

/** What `askForPush` does with the answer. The same three words as the empty deck's
 * `PingOutcome` (emptyDeckDecisions.ts), so the two stay interchangeable. */
export type AskOutcome = "register-token" | "open-os-settings" | "nothing";

/**
 * What a tap on Turn on (or Open Settings) leads to, from the permission BEFORE the tap and
 * `ensurePushPermission()`'s answer after it.
 *
 * The answer alone cannot tell a fresh no from an old one. Expo on iOS reports `canAskAgain`
 * as false the moment the status is denied (EXPermissionsService.m: `canAskAgain = status !=
 * Denied`), so a player who taps Turn on and then Don't Allow comes back as
 * `{ granted: false, canAskAgain: false }`, exactly like one who said no months ago. Reading
 * that as "open Settings" marched them into the Settings app a second after they said no: asking
 * again with extra steps, against the whole point of "Not now", and the kind of push into consent
 * App Review cites under 5.1.1(iv).
 *
 * So: yes registers the token; a no to a prompt this tap could have raised (the OS was still able
 * to ask before it) is "nothing"; Settings opens only when the OS could not prompt before the tap
 * and still cannot, which is the one case where the Settings app is the only way left to say yes.
 */
export function askOutcome(before: PushPermissionState, after: { granted: boolean; canAskAgain: boolean }): AskOutcome {
  if (after.granted) return "register-token";
  const couldPrompt = before.status !== "granted" && before.canAskAgain;
  if (couldPrompt) return "nothing";
  return after.canAskAgain ? "nothing" : "open-os-settings";
}

export type PushAskKind = "none" | "ask" | "open-settings";

/**
 * Whether a surface may show the ask, and which one.
 *
 * "none" until both inputs have loaded (`permission` undefined, or `lastOfferedAt` undefined
 * while the persisted record is being read): a card that appears late jumps the layout, and one
 * shown on a guess can ask a player who already said yes. "none" when notifications are on, or
 * when any surface offered within the last 7 days (an offer stamped in the near future means
 * the clock moved back, and counts as recent; one more than a week ahead is junk). Otherwise
 * "ask" while iOS can still show its prompt, else "open-settings".
 */
export function pushAskKind({
  permission,
  lastOfferedAt,
  now,
}: {
  permission: PushPermissionState | undefined;
  lastOfferedAt: number | null | undefined;
  now: number;
}): PushAskKind {
  if (!permission || lastOfferedAt === undefined) return "none";
  if (permission.status === "granted") return "none";
  if (lastOfferedAt !== null && Math.abs(now - lastOfferedAt) < PUSH_ASK_INTERVAL_MS) return "none";
  return permission.canAskAgain ? "ask" : "open-settings";
}

/** The two asks that compete for the one slot over the bottom of the deck. */
export type DeckAskHolder = "push" | "duo-pops";

export function canHoldDeckSlot(holder: DeckAskHolder | null, who: DeckAskHolder): boolean {
  return holder === null || holder === who;
}

export interface PushAskCopy {
  title: string;
  body?: string;
  primaryLabel: string;
  secondaryLabel: string;
}

/** The card's words. `otherName` is the new duo's name on DUO LOCKED ("your match" when it is
 * missing) and, if a caller ever has one, the liked player's on the deck ("they" otherwise). */
export function pushAskCopy(kind: "ask" | "open-settings", surface: "deck" | "match", otherName?: string): PushAskCopy {
  const name = otherName?.trim() || null;
  if (surface === "deck") {
    if (kind === "ask") {
      return {
        title: name ? `Get notified when ${name} duos you back?` : "Get notified when they duo you back?",
        body: "We'll let you know when a duo locks or a match messages you.",
        primaryLabel: "Turn on",
        secondaryLabel: "Not now",
      };
    }
    return {
      title: "Notifications are off for DuoQueue",
      body: "Turn them on in Settings so you know when a duo locks.",
      primaryLabel: "Open Settings",
      secondaryLabel: "Not now",
    };
  }
  const who = name ?? "your match";
  if (kind === "ask") {
    return { title: `Get notified when ${who} messages you?`, primaryLabel: "Turn on", secondaryLabel: "Not now" };
  }
  return {
    title: "Notifications are off for DuoQueue",
    body: `Turn them on in Settings so you see ${who}'s reply.`,
    primaryLabel: "Open Settings",
    secondaryLabel: "Not now",
  };
}

/** Settings > Notifications' standing line above the switches. No "Not now": the player opened
 * this screen, so it is a status, not an interruption. */
export function settingsBannerCopy(status: "denied" | "undetermined"): { title: string; body: string; primaryLabel: string } {
  if (status === "denied") {
    return {
      title: "Notifications are off for DuoQueue",
      body: "Your choices below are saved. Turn notifications on in Settings to get them.",
      primaryLabel: "Open Settings",
    };
  }
  return {
    title: "Turn on notifications",
    body: "Know when a duo locks or a match messages you.",
    primaryLabel: "Turn on",
  };
}

export const PUSH_ON_TOAST = "Notifications on";

/** What is persisted on the phone (per device, because permission is per device). */
export interface PushAskRecord {
  /** When any surface last showed an ask. */
  lastOfferedAt: number | null;
  /** When this phone first liked someone (Duo Pops' "a like from an earlier launch" rule). */
  firstLikeAt: number | null;
}

function timestampOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parsePushAskRecord(raw: string | null | undefined): PushAskRecord {
  const empty: PushAskRecord = { lastOfferedAt: null, firstLikeAt: null };
  if (!raw) return empty;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
    const v = value as Record<string, unknown>;
    return { lastOfferedAt: timestampOrNull(v.lastOfferedAt), firstLikeAt: timestampOrNull(v.firstLikeAt) };
  } catch {
    return empty;
  }
}

export function serializePushAskRecord(record: PushAskRecord): string {
  return JSON.stringify({ lastOfferedAt: record.lastOfferedAt, firstLikeAt: record.firstLikeAt });
}

/** The stored record merged with anything that happened before it finished loading: the latest
 * offer and the earliest like win, so a slow read never erases either. */
export function mergePushAskRecord(stored: PushAskRecord, live: PushAskRecord): PushAskRecord {
  const latest = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.max(a, b));
  const earliest = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));
  return {
    lastOfferedAt: latest(stored.lastOfferedAt, live.lastOfferedAt),
    firstLikeAt: earliest(stored.firstLikeAt, live.firstLikeAt),
  };
}
