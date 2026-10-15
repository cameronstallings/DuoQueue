// What send-push-notification accepts, and what each event becomes: the notification_settings
// switch that gates it, the data.category it is sent under, and whether it makes a sound. Plus
// the re-checks a push makes against the rows it is about before it goes out.
//
// Pure (its one import, validation.ts, has no Deno globals and no npm: imports), so
// apps/mobile's vitest runs events.test.ts. That test is where the SHIPPED CLIENT CONTRACT is
// pinned: every request body a deployed trigger sends today must stay valid, and every new event
// must ride a category the 1.0.1 app already routes (apps/mobile/src/lib/notificationRouting.ts:
// new_player opens the deck; new_message, new_match and nudge_unread with a matchId open that
// chat; the party categories with a partyId) or one it safely ignores (announcement, and
// duo_pop, which only a 1.0.2 phone can opt in to).
//
// A deploy reaches every installed app at once and the app cannot be patched, so changes here are
// additive: never rename an event, a field or a category that a trigger or a shipped build uses.

import { isUuid } from "../_shared/validation.ts";

/** The boolean columns of notification_settings (0001, 0038, 0063, 0072, 0081): the switch that
 * decides whether a push goes out at all. Deliberately a separate thing from the push's
 * category, which is what the app routes and refreshes on. They were one value until the party
 * pushes, and the party categories are not columns: selecting "party_message" from
 * notification_settings would error, the settings row would read as missing, and a missing row
 * means "notify", so a person who had switched messages off would be pushed anyway. */
export type SettingsColumn =
  | "new_match"
  | "new_message"
  | "super_ping"
  | "daily_swipes_refreshed"
  | "nudge_unread"
  | "nudge_online"
  | "new_player"
  | "new_like"
  | "announcements"
  | "queue_pop";

export interface NewMatchEvent {
  type: "new_match";
  matchId: string;
  userAId: string;
  userBId: string;
}
export interface NewMessageEvent {
  type: "new_message";
  matchId: string;
  messageId: string;
  senderId: string;
}
export interface SuperPingEvent {
  type: "super_ping";
  senderId: string;
  receiverId: string;
}
/** 0038, payload unchanged by 0074. */
export interface LookingNowEvent {
  type: "looking_now";
  matchId: string;
  togglerId: string;
  recipientId: string;
}
// The party events (migration 0070). Their pushes carry `partyId`, never `matchId`.
export interface PartyInviteEvent {
  type: "party_invite";
  partyId: string;
  inviteId: string;
  targetId: string;
}
export interface PartyStartedEvent {
  type: "party_started";
  partyId: string;
  creatorId: string;
  partnerId: string;
}
export interface PartyJoinedEvent {
  type: "party_joined";
  partyId: string;
  joinerId: string;
}
export interface PartyMessageEvent {
  type: "party_message";
  partyId: string;
  messageId: string;
  senderId: string;
}
/** 0072: someone who shares a game and a server group liked the recipient. No liker id. */
export interface NewLikeEvent {
  type: "new_like";
  recipientId: string;
  likeCount: number;
}
/** 0073: a match proposed a time to play. */
export interface SessionProposedEvent {
  type: "session_proposed";
  matchId: string;
  sessionId: string;
  proposerId: string;
  recipientId: string;
}
/** 0073: a match shared their Discord in the chat. */
export interface DiscordSharedEvent {
  type: "discord_shared";
  matchId: string;
  shareId: string;
  sharerId: string;
  recipientId: string;
}
/** 0075: a new match nobody has written in yet, to one side. */
export interface FirstMessageNudgeEvent {
  type: "first_message_nudge";
  matchId: string;
  recipientId: string;
  otherId: string;
}
/** 0081: news about the app itself, to opted-in players only. Sent by hand, never by a trigger. */
export interface AnnouncementEvent {
  type: "announcement";
  title: string;
  body: string;
}
/** 0085: one Duo Pop to one recipient, from start_queue_up. Names nobody: the push re-reads the
 * queue_ups row (popId) for everything it says. */
export interface DuoPopEvent {
  type: "duo_pop";
  popId: string;
  recipientId: string;
}

export type NotificationEvent =
  | NewMatchEvent
  | NewMessageEvent
  | SuperPingEvent
  | LookingNowEvent
  | PartyInviteEvent
  | PartyStartedEvent
  | PartyJoinedEvent
  | PartyMessageEvent
  | NewLikeEvent
  | SessionProposedEvent
  | DiscordSharedEvent
  | FirstMessageNudgeEvent
  | AnnouncementEvent
  | DuoPopEvent;

/** Every event sent to one person through notifyProfile: everything but the announcement and the
 * Duo Pop, which are both opt-in and so never take notifyProfile's "a missing settings row means
 * notify" default. */
export type PersonEventType = Exclude<NotificationEvent["type"], "announcement" | "duo_pop">;

export interface PushRoute {
  /** The switch that has to be on. A missing settings row means "notify" for these. */
  setting: SettingsColumn;
  /** data.category, exactly as sent and as logged in push_log. */
  category: string;
  /** A real person reaching you makes a sound; a scheduled nudge stays silent. */
  sound: boolean;
}

/**
 * THE CONTRACT, one row per event. The categories of the new events are chosen so the shipped
 * 1.0.1 app does the right thing on a tap without an update:
 *
 *   new_like             -> "new_player": 1.0.1 opens and refreshes the deck, where 0071 puts
 *                           the liker on top. Its own switch, new_like (0072).
 *   session_proposed,
 *   discord_shared       -> "new_message" + matchId: 1.0.1 opens that chat. A Discord share then
 *                           shows even in a chat that was already open (its re-read on a
 *                           new_message push covers discord_shares). A proposal shows when the tap
 *                           opens the chat, but NOT in a chat that was already open: 1.0.1 never
 *                           refetches ["match-sessions", matchId] on a push, a resume or an
 *                           "already-open" tap, so the Confirm banner appears only after leaving
 *                           and re-entering the chat. The 1.0.1 OTA has to invalidate that query
 *                           in those three places (0073's header has the detail).
 *   first_message_nudge  -> "new_match" + matchId: opens that chat. Silent: a scheduled nudge.
 *   looking_now          -> "new_message" + matchId since 0074 (it was "nudge_online", which
 *                           1.0.1 does not route, so a tap opened nothing). Switch unchanged.
 */
export const PUSH_ROUTES: Record<PersonEventType, PushRoute> = {
  new_match: { setting: "new_match", category: "new_match", sound: true },
  new_message: { setting: "new_message", category: "new_message", sound: true },
  super_ping: { setting: "super_ping", category: "super_ping", sound: true },
  looking_now: { setting: "nudge_online", category: "new_message", sound: true },
  // The party pushes reuse the "New match" and "New message" switches under categories of their
  // own (partyPush.ts).
  party_invite: { setting: "new_match", category: "party_invite", sound: true },
  party_started: { setting: "new_match", category: "party_started", sound: true },
  party_joined: { setting: "new_match", category: "party_joined", sound: true },
  party_message: { setting: "new_message", category: "party_message", sound: true },
  new_like: { setting: "new_like", category: "new_player", sound: true },
  session_proposed: { setting: "new_message", category: "new_message", sound: true },
  discord_shared: { setting: "new_message", category: "new_message", sound: true },
  first_message_nudge: { setting: "nudge_unread", category: "new_match", sound: false },
};

/** Announcements: not a routed category in 1.0.1 (a tap just opens the app), silent, and gated
 * by claim_announcement_recipients() (opted in, inside 10:00-20:59 local, not yet sent this
 * text) rather than by notifyProfile's "missing row means notify". */
export const ANNOUNCEMENT_CATEGORY = "announcement";

/**
 * The Duo Pop (0085, DuoQueue 1.0.2). Its own category, "duo_pop" (the 1.0.2 app's
 * DUO_POP_PUSH_CATEGORY opens the Pop card from it; 1.0.1 does not route it, so a tap just opens
 * the app, and 1.0.1 cannot opt in anyway). Its own sound, bundled in 1.0.2 as
 * assets/sounds/duo-pop.wav. A ttl of the seconds the pop has left (duoPopTtlSeconds, at most its
 * 10 minutes), because after that it is worthless and, near midnight, against the quiet hours;
 * and high priority, because it is a race. Sent only when the recipient's settings row EXISTS
 * and says queue_pop = true: the opposite of notifyProfile's default (App Store 4.5.4).
 */
export const DUO_POP_CATEGORY = "duo_pop";
export const DUO_POP_SOUND = "duo-pop.wav";
export const DUO_POP_TTL_SECONDS = 600;
/** A pop with less than this left is not pushed: by the time it lands and is opened, it is gone. */
export const DUO_POP_MIN_SECONDS_LEFT = 30;
/** push_log.event for the sender's push when a pop locks (category new_match). */
export const DUO_LOCKED_LOG_EVENT = "duo_locked";
export const ANNOUNCEMENT_TITLE_MAX = 60;
export const ANNOUNCEMENT_BODY_MAX = 180;

/** A like alert counts the pairs dispatch_like_alert marked sent in one go. */
const LIKE_COUNT_MAX = 10000;

const CONTROL_CHARS = /[\x00-\x1F\x7F]/;
const EN_DASH = String.fromCharCode(0x2013);
const EM_DASH = String.fromCharCode(0x2014);

/** Announcement text: 1..max characters, not blank, one line, and no em or en dash (Cameron's
 * standing rule for every user-visible string, enforced here because this copy is typed by hand
 * and goes to everyone opted in at once). */
export function isAnnouncementText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= 1 &&
    value.length <= max &&
    !CONTROL_CHARS.test(value) &&
    !value.includes(EN_DASH) &&
    !value.includes(EM_DASH)
  );
}

function isLikeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= LIKE_COUNT_MAX;
}

// Its callers are Postgres triggers and sweeps (via pg_net) and an operator with the internal
// token, never the client, but "holds the right bearer token" isn't the same guarantee as "sent
// well-formed IDs", and every field below ends up in a query that would otherwise surface a
// malformed value as a raw 500 deep in that lookup instead of a clean 400 here. Strict: an
// unknown type, or a known type missing any field, is refused.
export function isValidEvent(data: unknown): data is NotificationEvent {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  switch (d.type) {
    case "new_match":
      return isUuid(d.matchId) && isUuid(d.userAId) && isUuid(d.userBId);
    case "new_message":
      return isUuid(d.matchId) && isUuid(d.messageId) && isUuid(d.senderId);
    case "super_ping":
      return isUuid(d.senderId) && isUuid(d.receiverId);
    case "looking_now":
      return isUuid(d.matchId) && isUuid(d.togglerId) && isUuid(d.recipientId);
    case "party_invite":
      return isUuid(d.partyId) && isUuid(d.inviteId) && isUuid(d.targetId);
    case "party_started":
      return isUuid(d.partyId) && isUuid(d.creatorId) && isUuid(d.partnerId);
    case "party_joined":
      return isUuid(d.partyId) && isUuid(d.joinerId);
    case "party_message":
      return isUuid(d.partyId) && isUuid(d.messageId) && isUuid(d.senderId);
    case "new_like":
      return isUuid(d.recipientId) && isLikeCount(d.likeCount);
    case "session_proposed":
      return isUuid(d.matchId) && isUuid(d.sessionId) && isUuid(d.proposerId) && isUuid(d.recipientId);
    case "discord_shared":
      return isUuid(d.matchId) && isUuid(d.shareId) && isUuid(d.sharerId) && isUuid(d.recipientId);
    case "first_message_nudge":
      return isUuid(d.matchId) && isUuid(d.recipientId) && isUuid(d.otherId);
    case "announcement":
      return (
        isAnnouncementText(d.title, ANNOUNCEMENT_TITLE_MAX) && isAnnouncementText(d.body, ANNOUNCEMENT_BODY_MAX)
      );
    case "duo_pop":
      return isUuid(d.popId) && isUuid(d.recipientId);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Re-checks. pg_net sends the request after the write commits, and the row can move on in
// between (an unmatch, a block, which sets unmatched_at, a cancelled proposal, a revoked share, a
// first message). Each check that fails drops the push quietly; the caller is a trigger or a
// sweep with nothing to retry. Ids arrive lowercased (lowercaseIds), Postgres may return either.
// ---------------------------------------------------------------------------------------------

export interface MatchRow {
  user_a_id: string;
  user_b_id: string;
  unmatched_at: string | null;
}

/** The match exists, is not unmatched (or blocked), and is between exactly these two people. */
export function isLiveMatchBetween(match: MatchRow | null | undefined, personA: string, personB: string): boolean {
  if (!match || match.unmatched_at) return false;
  const a = personA.toLowerCase();
  const b = personB.toLowerCase();
  if (a === b) return false;
  const sides = [String(match.user_a_id).toLowerCase(), String(match.user_b_id).toLowerCase()];
  return sides.includes(a) && sides.includes(b);
}

export interface SessionRow {
  match_id: string;
  proposed_by: string;
  status: string;
  scheduled_at: string;
}

/** The proposal is still pending, still this match's and this proposer's, and still ahead. */
export function isStillProposed(
  session: SessionRow | null | undefined,
  event: Pick<SessionProposedEvent, "matchId" | "proposerId">,
  now: Date,
): boolean {
  if (!session || session.status !== "pending") return false;
  if (String(session.match_id).toLowerCase() !== event.matchId.toLowerCase()) return false;
  if (String(session.proposed_by).toLowerCase() !== event.proposerId.toLowerCase()) return false;
  const at = Date.parse(session.scheduled_at);
  return Number.isFinite(at) && at > now.getTime();
}

export interface ShareRow {
  match_id: string;
  shared_by: string;
  revoked: boolean;
}

/** The share is not revoked and is still this match's and this sharer's. */
export function isStillShared(
  share: ShareRow | null | undefined,
  event: Pick<DiscordSharedEvent, "matchId" | "sharerId">,
): boolean {
  if (!share || share.revoked !== false) return false;
  return (
    String(share.match_id).toLowerCase() === event.matchId.toLowerCase() &&
    String(share.shared_by).toLowerCase() === event.sharerId.toLowerCase()
  );
}

// ---------------------------------------------------------------------------------------------
// Queue Up (0085)
// ---------------------------------------------------------------------------------------------

/** The queue_ups columns the Duo Pop push re-reads. */
export interface DuoPopRow {
  id: string;
  sender_id: string;
  game_id: string;
  recipients: string[] | null;
  declined: string[] | null;
  can_duo: string[] | null;
  locked_at: string | null;
  ended_at: string | null;
  pop_expires_at: string;
}

function hasId(ids: string[] | null | undefined, id: string): boolean {
  const want = id.toLowerCase();
  return Array.isArray(ids) && ids.some((x) => String(x).toLowerCase() === want);
}

/** The pop can still be answered by this recipient when the push lands: nobody has locked it,
 * the sender has not stopped, at least 30 seconds are left, and the recipient is one of its
 * recipients and has not said Not now. */
export function isDuoPopOpenFor(pop: DuoPopRow | null | undefined, recipientId: string, now: Date): boolean {
  if (!pop || pop.locked_at || pop.ended_at) return false;
  const expires = Date.parse(String(pop.pop_expires_at));
  if (!Number.isFinite(expires) || expires <= now.getTime() + DUO_POP_MIN_SECONDS_LEFT * 1000) return false;
  return hasId(pop.recipients, recipientId) && !hasId(pop.declined, recipientId);
}

/** The Duo Pop push's ttl: the whole seconds the pop has left, at most DUO_POP_TTL_SECONDS, read
 * right before the push leaves. APNs and FCM then drop an undelivered pop when the pop closes,
 * not up to 10 minutes later. With 0085's duo_pop_clock_ok (the whole pop inside 10:00-00:59 on
 * the recipient's clock) this is what keeps Cameron's decision 6 true for a phone that was
 * briefly unreachable: no Duo Pop ARRIVES between 01:00 and 09:59. Floored, so the push never
 * outlives the pop. Null when the time is unreadable or under 1 second is left: do not send. */
export function duoPopTtlSeconds(pop: Pick<DuoPopRow, "pop_expires_at"> | null | undefined, now: Date): number | null {
  if (!pop) return null;
  const expires = Date.parse(String(pop.pop_expires_at));
  if (!Number.isFinite(expires)) return null;
  const left = Math.floor((expires - now.getTime()) / 1000);
  if (left < 1) return null;
  return Math.min(DUO_POP_TTL_SECONDS, left);
}

/** Riot's duo table let this recipient and the sender queue together (queue_ups.can_duo). */
export function canDuoWith(pop: Pick<DuoPopRow, "can_duo"> | null | undefined, recipientId: string): boolean {
  return hasId(pop?.can_duo, recipientId);
}

/** Opted in to Duo Pops: the settings row exists and queue_pop is exactly true. A missing row,
 * a missing column (0085 not applied yet: the select errors and this sees null) or anything but
 * `true` is NOT opted in. */
export function isOptedInToDuoPops(settings: unknown): boolean {
  return !!settings && typeof settings === "object" && (settings as Record<string, unknown>).queue_pop === true;
}

/** The queue_ups columns the new_match enrichment reads, for a row whose match_id is the match. */
export interface LockedPopRow {
  id: string;
  sender_id: string;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  can_duo: string[] | null;
}

export interface PopLock {
  popId: string;
  /** Gets "Duo locked". */
  senderId: string;
  /** Tapped I'm in; gets nothing (their Pop card plays the moment). */
  lockerId: string;
  /** Riot's duo table let the two queue together: data.duo = "1". */
  canDuo: boolean;
}

/** A new match that came out of a Duo Pop: the row is locked, and its sender and locker are
 * exactly the match's two players. Anything else (no row, a lookup error, a row that does not
 * fit) is an ordinary match and gets the ordinary two pushes. */
export function popLockFor(
  pop: LockedPopRow | null | undefined,
  match: Pick<NewMatchEvent, "userAId" | "userBId">,
): PopLock | null {
  if (!pop || !pop.locked_at || !pop.locked_by) return null;
  const sender = String(pop.sender_id).toLowerCase();
  const locker = String(pop.locked_by).toLowerCase();
  const a = match.userAId.toLowerCase();
  const b = match.userBId.toLowerCase();
  if (sender === locker) return null;
  const sides = [a, b];
  if (!sides.includes(sender) || !sides.includes(locker)) return null;
  return { popId: String(pop.id).toLowerCase(), senderId: sender, lockerId: locker, canDuo: hasId(pop.can_duo, locker) };
}
