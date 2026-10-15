// Internal-only: called by Postgres (via pg_net, through notify_via_edge_function) on new
// matches, new messages, Super Pings, "free to duo now", the party events (an invite, a started
// party, a new member, a party chat message), a like (0072), a proposed time and a shared
// Discord (0073), the first-message nudge (0075), and a Duo Pop (0085, which also enriches the
// new_match push of a match that came out of one); and by an operator for an announcement
// (0081). Never by the client directly. Authenticated with a shared secret
// (INTERNAL_TRIGGER_AUTH_TOKEN) rather than a user JWT, since there's no end-user session in a
// database trigger.
//
// What each event becomes (its switch, its category, its sound) is the PUSH_ROUTES table in
// events.ts, pinned by events.test.ts against the shipped 1.0.1 app. Every push goes out through
// pushToProfile (_shared/push-delivery.ts), which writes push_log (0080) and deletes tokens Expo
// says are dead.
import { createClient } from "npm:@supabase/supabase-js@2";

import { pushToProfile, tokensForProfile } from "../_shared/push-delivery.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";
import { supabaseSecretKey } from "../_shared/supabase-keys.ts";
import { readJsonBody } from "../_shared/validation.ts";

import {
  ANNOUNCEMENT_CATEGORY,
  type AnnouncementEvent,
  canDuoWith,
  type DiscordSharedEvent,
  DUO_LOCKED_LOG_EVENT,
  DUO_POP_CATEGORY,
  DUO_POP_SOUND,
  type DuoPopEvent,
  type DuoPopRow,
  duoPopTtlSeconds,
  type FirstMessageNudgeEvent,
  isDuoPopOpenFor,
  isLiveMatchBetween,
  isOptedInToDuoPops,
  isStillProposed,
  isStillShared,
  isValidEvent,
  type LockedPopRow,
  type LookingNowEvent,
  type MatchRow,
  type NewLikeEvent,
  type NewMatchEvent,
  type PartyInviteEvent,
  type PartyJoinedEvent,
  type PartyMessageEvent,
  type PartyStartedEvent,
  type PersonEventType,
  type PopLock,
  popLockFor,
  PUSH_ROUTES,
  type SessionProposedEvent,
  type SessionRow,
  type ShareRow,
} from "./events.ts";
import { duoLockedPush, duoPopPush, duoPopVariant, poppedInSeconds } from "./duoPopCopy.ts";
import { likeAlertPush } from "./likeAlertCopy.ts";
import {
  discordSharedPush,
  firstMessageNudgePush,
  formatPlayTime,
  lookingNowPush,
  sessionProposedPush,
} from "./matchPushCopy.ts";
import {
  lowercaseIds,
  partyInvitePush,
  partyJoinedPush,
  partyMessagePush,
  partyRecipients,
  partyStartedPush,
} from "./partyPush.ts";
import { type PushCopy, superPingPush } from "./superPingCopy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SECRET_KEY = supabaseSecretKey();
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");

/** How many announcement recipients are pushed at once. */
const ANNOUNCEMENT_CONCURRENCY = 10;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function getDisplayName(profileId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", profileId).single();
  return data?.display_name ?? "Someone";
}

// `event` decides everything about the push except its words: the notification_settings column
// that has to be on, the category in its `data`, and whether it makes a sound (PUSH_ROUTES).
//
// `extra` rides in the push's `data` next to `category`, for a tapped push to route by: `matchId`
// on the 1:1 pushes, so the app can open that chat instead of resuming wherever it was left (the
// decision is apps/mobile/src/lib/notificationRouting.ts), and `partyId` on the party pushes.
//
// STRICTLY ADDITIVE, because this deploys to every installed app at once and the app cannot be
// patched: a build that predates `matchId` reads only `data.category` and ignores the rest, so it
// behaves exactly as before. `category` is spread last (pushToProfile) so no extra field can ever
// replace it, since every shipped build routes and refreshes on that one key.
//
// `logEvent` replaces `event` in push_log only (the route is still `event`'s): the sender's
// "Duo locked" push is a new_match push in every way the app can see, logged as duo_locked.
async function notifyProfile(
  profileId: string,
  event: PersonEventType,
  copy: PushCopy,
  extra: Record<string, string> = {},
  logEvent?: string,
): Promise<string> {
  const route = PUSH_ROUTES[event];
  const { data: settings } = await supabase
    .from("notification_settings")
    .select(route.setting)
    .eq("profile_id", profileId)
    .maybeSingle();

  // Default to notifying when no settings row exists yet, rather than silently dropping the
  // notification (settings rows are created by the signup trigger, so a missing row is
  // unexpected, not an intentional opt-out). Announcements are the one exception and never come
  // through here.
  const enabled = settings ? (settings as Record<string, boolean>)[route.setting] !== false : true;
  if (!enabled) return "skipped:switched_off";

  const tokens = await tokensForProfile(supabase, profileId);
  const outcome = await pushToProfile(supabase, {
    recipientId: profileId,
    event: logEvent ?? event,
    category: route.category,
    tokens,
    title: copy.title,
    body: copy.body,
    extra,
    sound: route.sound,
  });
  return outcome.ticketStatus;
}

/** The match row, or null when it is gone or unreadable. */
async function getMatch(matchId: string): Promise<MatchRow | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("user_a_id, user_b_id, unmatched_at")
    .eq("id", matchId)
    .maybeSingle();
  if (error) {
    console.error("match lookup failed:", error.message);
    return null;
  }
  return (data as MatchRow | null) ?? null;
}

// ---------------------------------------------------------------------------------------------
// The pushes about one match (0073, 0074, 0075)
//
// Each returns what happened, in the response's `result`, for the hand-fire test before 0083 is
// applied: "ok" (or another push_log ticket status) when a push went out, "skipped:<why>" when
// a re-check dropped it. Nothing reads it in production; pg_net ignores the response body.
//
// The SQL that sent each of these already checked the match is live, nobody is blocked, the
// recipient's chat is unlocked and the per-hour or per-match budget. These re-read the rows the
// push is about, because pg_net sends after the write commits and things can change in between.
// ---------------------------------------------------------------------------------------------

async function notifySessionProposed(event: SessionProposedEvent): Promise<string> {
  const [{ data: session, error }, match] = await Promise.all([
    supabase.from("match_sessions").select("match_id, proposed_by, status, scheduled_at").eq("id", event.sessionId)
      .maybeSingle(),
    getMatch(event.matchId),
  ]);
  if (error) {
    console.error("session lookup failed:", error.message);
    return "skipped:lookup_failed";
  }
  if (!isStillProposed(session as SessionRow | null, event, new Date())) return "skipped:not_pending";
  if (!isLiveMatchBetween(match, event.proposerId, event.recipientId)) return "skipped:match_not_live";

  const [proposerName, { data: recipient }] = await Promise.all([
    getDisplayName(event.proposerId),
    supabase.from("profiles").select("timezone").eq("id", event.recipientId).maybeSingle(),
  ]);
  const playTime = formatPlayTime(new Date((session as SessionRow).scheduled_at), recipient?.timezone as string | null);
  return await notifyProfile(event.recipientId, "session_proposed", sessionProposedPush(proposerName, playTime), {
    matchId: event.matchId,
  });
}

async function notifyDiscordShared(event: DiscordSharedEvent): Promise<string> {
  const [{ data: share, error }, match] = await Promise.all([
    supabase.from("discord_shares").select("match_id, shared_by, revoked").eq("id", event.shareId).maybeSingle(),
    getMatch(event.matchId),
  ]);
  if (error) {
    console.error("discord share lookup failed:", error.message);
    return "skipped:lookup_failed";
  }
  if (!isStillShared(share as ShareRow | null, event)) return "skipped:not_shared";
  if (!isLiveMatchBetween(match, event.sharerId, event.recipientId)) return "skipped:match_not_live";

  const sharerName = await getDisplayName(event.sharerId);
  return await notifyProfile(event.recipientId, "discord_shared", discordSharedPush(sharerName), {
    matchId: event.matchId,
  });
}

async function notifyFirstMessageNudge(event: FirstMessageNudgeEvent): Promise<string> {
  const [match, { data: messages, error }] = await Promise.all([
    getMatch(event.matchId),
    supabase.from("messages").select("id").eq("match_id", event.matchId).limit(1),
  ]);
  if (error) {
    console.error("first message lookup failed:", error.message);
    return "skipped:lookup_failed";
  }
  // Still live, still these two, and still nobody has written.
  if (!isLiveMatchBetween(match, event.recipientId, event.otherId)) return "skipped:match_not_live";
  if ((messages ?? []).length > 0) return "skipped:already_talking";

  const { data: other } = await supabase.from("profiles").select("display_name").eq("id", event.otherId)
    .maybeSingle();
  return await notifyProfile(
    event.recipientId,
    "first_message_nudge",
    firstMessageNudgePush(other?.display_name as string | null),
    { matchId: event.matchId },
  );
}

async function notifyLookingNow(event: LookingNowEvent): Promise<string> {
  const match = await getMatch(event.matchId);
  if (!isLiveMatchBetween(match, event.togglerId, event.recipientId)) return "skipped:match_not_live";
  const togglerName = await getDisplayName(event.togglerId);
  // matchId since 0074, under category new_message (PUSH_ROUTES), so a tap opens the chat.
  return await notifyProfile(event.recipientId, "looking_now", lookingNowPush(togglerName), {
    matchId: event.matchId,
  });
}

// ---------------------------------------------------------------------------------------------
// The like alert (0072)
//
// Every gate is in SQL (dispatch_like_alert): same server group, a shared game, both deck gates,
// not demo, the shared one-a-day budget, quiet hours. The payload has no liker in it, so the push
// cannot name one. The new_like switch is checked again here by notifyProfile.
// ---------------------------------------------------------------------------------------------

async function notifyNewLike(event: NewLikeEvent): Promise<string> {
  return await notifyProfile(event.recipientId, "new_like", likeAlertPush(event.likeCount));
}

// ---------------------------------------------------------------------------------------------
// Announcements (0081)
//
// Only to claim_announcement_recipients(title, body): announcements = true (default false, App
// Store 4.5.4), onboarded, active, not banned, suspended or demo, with a token, AND inside
// 10:00-20:59 in their own time zone right now, AND not already sent this exact title and body.
// A player with no settings row is NOT opted in, the opposite of notifyProfile. Silent. The
// claim is written before the send, so a failure is a missed announcement, never a duplicate.
//
// Sent by hand, and ONCE AN HOUR through the day with the same text, byte for byte: each firing
// reaches the players whose local clock has just entered the window, and nobody twice (the
// ledger is keyed on the text). One firing reaches only the zones inside 10:00-21:00 right now.
//   curl -X POST .../functions/v1/send-push-notification -H "Authorization: Bearer <internal token>"
//     -H "Content-Type: application/json" -d '{"type":"announcement","title":"...","body":"..."}'
// ---------------------------------------------------------------------------------------------

async function sendAnnouncement(event: AnnouncementEvent): Promise<Response> {
  const { data: rows, error } = await supabase.rpc("claim_announcement_recipients", {
    p_title: event.title,
    p_body: event.body,
  });
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }
  const recipientIds = [
    ...new Set(((rows ?? []) as { profile_id: string }[]).map((r) => r.profile_id)),
  ];

  let notified = 0;
  for (let i = 0; i < recipientIds.length; i += ANNOUNCEMENT_CONCURRENCY) {
    const outcomes = await Promise.all(
      recipientIds.slice(i, i + ANNOUNCEMENT_CONCURRENCY).map(async (profileId) =>
        pushToProfile(supabase, {
          recipientId: profileId,
          event: "announcement",
          category: ANNOUNCEMENT_CATEGORY,
          tokens: await tokensForProfile(supabase, profileId),
          title: event.title,
          body: event.body,
          sound: false,
        })
      ),
    );
    notified += outcomes.filter((o) => o.accepted > 0).length;
  }
  return jsonResponse({ ok: true, recipients: recipientIds.length, notified }, 200);
}

// ---------------------------------------------------------------------------------------------
// Queue Up (0085, DuoQueue 1.0.2)
//
// THE DUO POP. start_queue_up decided the recipients in SQL (opted in, NA, the game, quiet hours
// for the whole pop, the 3-hour and 3-a-day caps, every pair rule) and queued one
// { type: "duo_pop", popId, recipientId } per recipient. pg_net sends it after the commit, and a
// pop is a 10-minute race,
// so this re-reads the row and drops the push unless it can still be won: not locked, not
// stopped, more than 30 seconds left, still a recipient, no Not now. Then the switch: the
// settings row must EXIST and say queue_pop = true (isOptedInToDuoPops), never notifyProfile's
// "missing row means notify". The push names nobody: the game, the sender's rank text and
// whether Riot's duo table lets the two queue together. data { category: "duo_pop", popId },
// the bundled Duo Pop sound, a ttl of the seconds the pop has left (duoPopTtlSeconds, at most
// 600, so a late delivery can never land after the pop closes, which 0085 keeps before 01:00
// local), high priority; push_log event duo_pop.
//
// "DUO LOCKED". answer_duo_pop inserts the match, so on_match_created sends the ordinary
// new_match event. Before the two "New match!" pushes go out, the match is looked up in
// queue_ups (popLockFor). For a pop, ONLY the sender is pushed ("Duo locked", "{name} grabbed
// your Duo Pop. Popped in m:ss.") under the new_match switch, sound and category, with matchId,
// popId, poppedIn and, when Riot's table lets them duo, duo "1" (the 1.0.2 app opens DUO LOCKED
// from these; 1.0.1 reads category + matchId and opens the chat). The player who tapped I'm in
// gets nothing: their Pop card is already playing the moment. Any lookup error, including the
// table not existing yet, means "not a pop", so every other match is exactly as before.
// ---------------------------------------------------------------------------------------------

async function notifyDuoPop(event: DuoPopEvent): Promise<string> {
  const { data: pop, error } = await supabase
    .from("queue_ups")
    .select("id, sender_id, game_id, recipients, declined, can_duo, locked_at, ended_at, pop_expires_at")
    .eq("id", event.popId)
    .maybeSingle();
  if (error) {
    console.error("duo pop lookup failed:", error.message);
    return "skipped:lookup_failed";
  }
  const row = pop as DuoPopRow | null;
  if (!row || !isDuoPopOpenFor(row, event.recipientId, new Date())) return "skipped:pop_closed";

  const { data: settings, error: settingsError } = await supabase
    .from("notification_settings")
    .select("queue_pop")
    .eq("profile_id", event.recipientId)
    .maybeSingle();
  if (settingsError) {
    console.error("duo pop settings lookup failed:", settingsError.message);
    return "skipped:lookup_failed";
  }
  if (!isOptedInToDuoPops(settings)) return "skipped:not_opted_in";

  const [{ data: game }, { data: senderGame }] = await Promise.all([
    supabase.from("games").select("name").eq("id", row.game_id).maybeSingle(),
    supabase.from("profile_games").select("rank_text").eq("profile_id", row.sender_id).eq("game_id", row.game_id)
      .maybeSingle(),
  ]);
  const gameName = (game?.name as string | undefined)?.trim();
  if (!gameName) return "skipped:no_game";

  const copy = duoPopPush({
    gameName,
    rankText: senderGame?.rank_text as string | null | undefined,
    canDuo: canDuoWith(row, event.recipientId),
    variant: duoPopVariant(event.popId),
  });
  const tokens = await tokensForProfile(supabase, event.recipientId);
  // The pop's remaining seconds, read after the lookups above, so the push dies with the pop.
  const ttl = duoPopTtlSeconds(row, new Date());
  if (ttl === null) return "skipped:pop_closed";
  const outcome = await pushToProfile(supabase, {
    recipientId: event.recipientId,
    event: "duo_pop",
    category: DUO_POP_CATEGORY,
    tokens,
    title: copy.title,
    body: copy.body,
    extra: { popId: event.popId },
    sound: DUO_POP_SOUND,
    ttl,
    priority: "high",
  });
  return outcome.ticketStatus;
}

/** The queue_ups row that locked into this match, or null: none, or any error at all (the table
 * may not exist yet when this deploys ahead of 0085). Never throws. */
async function findLockedPop(matchId: string): Promise<LockedPopRow | null> {
  try {
    const { data, error } = await supabase
      .from("queue_ups")
      .select("id, sender_id, locked_by, locked_at, created_at, can_duo")
      .eq("match_id", matchId)
      .not("locked_at", "is", null)
      .order("locked_at", { ascending: false })
      .limit(1);
    if (error) {
      // Before 0085 this is "relation does not exist": an ordinary match.
      console.error("duo pop match lookup failed:", error.message);
      return null;
    }
    return ((data ?? [])[0] as LockedPopRow | undefined) ?? null;
  } catch (err) {
    console.error("duo pop match lookup failed:", err);
    return null;
  }
}

async function notifyDuoLocked(event: NewMatchEvent, pop: LockedPopRow, lock: PopLock): Promise<string> {
  const seconds = poppedInSeconds(pop.created_at, pop.locked_at) ?? 1;
  const lockerName = await getDisplayName(lock.lockerId);
  const extra: Record<string, string> = { matchId: event.matchId, popId: lock.popId, poppedIn: String(seconds) };
  if (lock.canDuo) extra.duo = "1";
  return await notifyProfile(lock.senderId, "new_match", duoLockedPush(lockerName, seconds), extra, DUO_LOCKED_LOG_EVENT);
}

// ---------------------------------------------------------------------------------------------
// Parties
//
// Every party push re-reads the party before it goes out, because pg_net sends it after the
// write commits and the party can have moved on in between: a block (handle_new_block, 0031)
// removes the blocked member and deletes invites between the two, an account deletion removes
// a member, an invite can be answered or expire. So a push goes only to people who are members
// NOW, names only people who are members now, and an invite push only for an invite that is
// still this party's, for this person, and unanswered. Each check that fails drops the push
// quietly; the caller is a trigger that has nothing to retry.
//
// Display names are read with the service client (as getDisplayName does), never anything
// else from the profile, and never the message.

/** The party's current members, oldest first; ties (the two founders join in one transaction)
 * broken by id so the order is the same on every push. Empty when the party is gone. */
async function getPartyMemberIds(partyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("party_members")
    .select("profile_id")
    .eq("party_id", partyId)
    .order("joined_at", { ascending: true })
    .order("profile_id", { ascending: true });
  if (error) {
    console.error("party member lookup failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => (row.profile_id as string).toLowerCase());
}

/** Display names for `ids`, in the same order, "Someone" for any without one. */
async function getDisplayNames(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  const byId = new Map(
    (data ?? []).map((p) => [(p.id as string).toLowerCase(), p.display_name as string | null]),
  );
  return ids.map((id) => byId.get(id) ?? "Someone");
}

/** Pushes the same copy to each recipient, each under their own settings. */
async function notifyEach(
  recipientIds: string[],
  event: "party_invite" | "party_started" | "party_joined" | "party_message",
  copy: PushCopy,
  partyId: string,
) {
  await Promise.all(recipientIds.map((id) => notifyProfile(id, event, copy, { partyId })));
}

async function notifyPartyInvite(event: PartyInviteEvent) {
  const { data: invite } = await supabase
    .from("party_invites")
    .select("party_id, target_id, status")
    .eq("id", event.inviteId)
    .maybeSingle();
  if (
    !invite ||
    (invite.party_id as string).toLowerCase() !== event.partyId ||
    (invite.target_id as string).toLowerCase() !== event.targetId ||
    invite.status !== "pending"
  ) {
    return;
  }
  // The party as it stands, without the person invited (who is not a member yet anyway).
  const memberIds = partyRecipients(await getPartyMemberIds(event.partyId), event.targetId);
  if (memberIds.length === 0) return;
  const copy = partyInvitePush(await getDisplayNames(memberIds));
  await notifyEach([event.targetId], "party_invite", copy, event.partyId);
}

async function notifyPartyStarted(event: PartyStartedEvent) {
  if (event.creatorId === event.partnerId) return;
  const memberIds = await getPartyMemberIds(event.partyId);
  if (!memberIds.includes(event.creatorId) || !memberIds.includes(event.partnerId)) return;
  const copy = partyStartedPush(await getDisplayName(event.creatorId));
  await notifyEach([event.partnerId], "party_started", copy, event.partyId);
}

async function notifyPartyJoined(event: PartyJoinedEvent) {
  const memberIds = await getPartyMemberIds(event.partyId);
  if (!memberIds.includes(event.joinerId)) return;
  const copy = partyJoinedPush(await getDisplayName(event.joinerId));
  const recipients = partyRecipients(memberIds, event.joinerId);
  await notifyEach(recipients, "party_joined", copy, event.partyId);
}

async function notifyPartyMessage(event: PartyMessageEvent) {
  // Ids only: the message's words never leave the database in a push.
  const { data: message } = await supabase
    .from("party_messages")
    .select("party_id, sender_id")
    .eq("id", event.messageId)
    .maybeSingle();
  if (
    !message ||
    (message.party_id as string).toLowerCase() !== event.partyId ||
    (message.sender_id as string).toLowerCase() !== event.senderId
  ) {
    return;
  }
  const memberIds = await getPartyMemberIds(event.partyId);
  if (!memberIds.includes(event.senderId)) return;
  const copy = partyMessagePush(await getDisplayName(event.senderId));
  const recipients = partyRecipients(memberIds, event.senderId);
  await notifyEach(recipients, "party_message", copy, event.partyId);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const unauthorized = await checkBearerAuth(req, INTERNAL_TRIGGER_AUTH_TOKEN);
  if (unauthorized) return unauthorized;

  const bodyResult = await readJsonBody(req);
  if (!bodyResult.ok) return bodyResult.response;
  if (!isValidEvent(bodyResult.data)) {
    return jsonResponse({ error: "Invalid payload" }, 400);
  }
  const event = bodyResult.data;
  // What happened, for the events that push one person (see "The pushes about one match").
  let result: string | undefined;

  switch (event.type) {
    case "new_match": {
      // A match that came out of a Duo Pop: "Duo locked" to the sender only (Queue Up, above).
      const pop = await findLockedPop(event.matchId);
      const lock = popLockFor(pop, event);
      if (pop && lock && poppedInSeconds(pop.created_at, pop.locked_at) !== null) {
        result = await notifyDuoLocked(event, pop, lock);
        break;
      }
      const [nameA, nameB] = await Promise.all([
        getDisplayName(event.userAId),
        getDisplayName(event.userBId),
      ]);
      // Both sides get the match id: either one tapping it lands in the new chat.
      const tapData = { matchId: event.matchId };
      await Promise.all([
        notifyProfile(event.userAId, "new_match", { title: "New match!", body: `You matched with ${nameB}.` }, tapData),
        notifyProfile(event.userBId, "new_match", { title: "New match!", body: `You matched with ${nameA}.` }, tapData),
      ]);
      break;
    }
    case "new_message": {
      const { data: match } = await supabase
        .from("matches")
        .select("user_a_id, user_b_id")
        .eq("id", event.matchId)
        .single();
      if (match) {
        const recipientId = match.user_a_id === event.senderId ? match.user_b_id : match.user_a_id;
        const senderName = await getDisplayName(event.senderId);
        await notifyProfile(recipientId, "new_message", { title: senderName, body: "Sent you a message" }, {
          matchId: event.matchId,
        });
      }
      break;
    }
    case "super_ping": {
      const senderName = await getDisplayName(event.senderId);
      await notifyProfile(event.receiverId, "super_ping", superPingPush(senderName));
      break;
    }
    case "looking_now":
      result = await notifyLookingNow(lowercaseIds(event));
      break;
    case "new_like":
      result = await notifyNewLike(lowercaseIds(event));
      break;
    case "session_proposed":
      result = await notifySessionProposed(lowercaseIds(event));
      break;
    case "discord_shared":
      result = await notifyDiscordShared(lowercaseIds(event));
      break;
    case "first_message_nudge":
      result = await notifyFirstMessageNudge(lowercaseIds(event));
      break;
    case "announcement":
      // Never lowercaseIds: its strings are the words.
      return await sendAnnouncement(event);
    case "duo_pop":
      result = await notifyDuoPop(lowercaseIds(event));
      break;
    case "party_invite":
      await notifyPartyInvite(lowercaseIds(event));
      break;
    case "party_started":
      await notifyPartyStarted(lowercaseIds(event));
      break;
    case "party_joined":
      await notifyPartyJoined(lowercaseIds(event));
      break;
    case "party_message":
      await notifyPartyMessage(lowercaseIds(event));
      break;
  }

  return jsonResponse(result === undefined ? { ok: true } : { ok: true, result }, 200);
});
