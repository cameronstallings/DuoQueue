// What send-push-notification accepts, and what each event becomes: the notification_settings
// switch that gates it, the data.category it is sent under, and whether it makes a sound. Plus
// the re-checks a push makes against the rows it is about before it goes out.
//
// Pure (its one import, validation.ts, has no Deno globals and no npm: imports), so
// apps/mobile's vitest runs events.test.ts. That test is where the SHIPPED CLIENT CONTRACT is
// pinned: every request body a deployed trigger sends today must stay valid, and every new event
// must ride a category the 1.0.1 app already routes (apps/mobile/src/lib/notificationRouting.ts:
// new_player opens the deck; new_message, new_match and nudge_unread with a matchId open that
// chat; the party categories with a partyId) or one it safely ignores (announcement).
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
  | "announcements";

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
  | AnnouncementEvent;

/** Every event sent to one person through notifyProfile (everything but the announcement). */
export type PersonEventType = Exclude<NotificationEvent["type"], "announcement">;

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
