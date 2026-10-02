// Internal-only: called by Postgres triggers (via pg_net) on new matches, new
// messages, Super Pings, "free to duo now", and the party events (an invite, a started
// party, a new member, a party chat message), never by the client directly.
// Authenticated with a shared secret (INTERNAL_TRIGGER_AUTH_TOKEN) rather than a user
// JWT, since there's no end-user session in a database trigger.
import { createClient } from "npm:@supabase/supabase-js@2";

import { sendExpoPush } from "../_shared/expo-push.ts";
import { checkBearerAuth, requireSecret } from "../_shared/require-secret-auth.ts";
import { isUuid, readJsonBody } from "../_shared/validation.ts";

import {
  lowercaseIds,
  partyInvitePush,
  partyJoinedPush,
  partyMessagePush,
  partyRecipients,
  partyStartedPush,
  pushData,
  type PartyPushCategory,
} from "./partyPush.ts";
import { superPingPush } from "./superPingCopy.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TRIGGER_AUTH_TOKEN = requireSecret("INTERNAL_TRIGGER_AUTH_TOKEN");

// The boolean columns of notification_settings (0001, 0038, 0063): the switch that decides
// whether a push goes out at all. Deliberately a separate thing from the push's category,
// which is what the app routes and refreshes on. They were one value until the party pushes,
// and the party categories are not columns: selecting "party_message" from
// notification_settings would error, the settings row would read as missing, and a missing
// row means "notify", so a person who had switched messages off would be pushed anyway.
type SettingsColumn =
  | "new_match"
  | "new_message"
  | "super_ping"
  | "daily_swipes_refreshed"
  | "nudge_unread"
  | "nudge_online"
  | "new_player";

type NotificationCategory =
  | "new_match"
  | "new_message"
  | "super_ping"
  | "daily_swipes_refreshed"
  | "nudge_online"
  | PartyPushCategory;

interface NewMatchEvent {
  type: "new_match";
  matchId: string;
  userAId: string;
  userBId: string;
}
interface NewMessageEvent {
  type: "new_message";
  matchId: string;
  messageId: string;
  senderId: string;
}
interface SuperPingEvent {
  type: "super_ping";
  senderId: string;
  receiverId: string;
}
interface LookingNowEvent {
  type: "looking_now";
  matchId: string;
  togglerId: string;
  recipientId: string;
}
// The party events (migration 0070). Their pushes carry `partyId`, never `matchId`.
interface PartyInviteEvent {
  type: "party_invite";
  partyId: string;
  inviteId: string;
  targetId: string;
}
interface PartyStartedEvent {
  type: "party_started";
  partyId: string;
  creatorId: string;
  partnerId: string;
}
interface PartyJoinedEvent {
  type: "party_joined";
  partyId: string;
  joinerId: string;
}
interface PartyMessageEvent {
  type: "party_message";
  partyId: string;
  messageId: string;
  senderId: string;
}
type NotificationEvent =
  | NewMatchEvent
  | NewMessageEvent
  | SuperPingEvent
  | LookingNowEvent
  | PartyInviteEvent
  | PartyStartedEvent
  | PartyJoinedEvent
  | PartyMessageEvent;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// This function only ever runs behind checkBearerAuth — its callers are Postgres
// triggers (via pg_net) and other server-side code, never the client directly — but
// "holds the right bearer token" isn't the same guarantee as "sent well-formed IDs",
// and every field below ends up in a query (get_display_name, a push-token lookup) that
// would otherwise surface a malformed value as a raw 500 deep in that lookup instead of
// a clean 400 here.
function isValidEvent(data: unknown): data is NotificationEvent {
  if (!data || typeof data !== "object") return false;
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
    default:
      return false;
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getDisplayName(profileId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", profileId).single();
  return data?.display_name ?? "Someone";
}

// `setting` is the notification_settings column that has to be on for this push to go out;
// `category` is what the push says it is, in its `data`. For every push before the party ones
// the two are the same word. The party pushes reuse the "New match" and "New message"
// switches under categories of their own (see SettingsColumn above, and partyPush.ts).
//
// `extra` rides in the push's `data` next to `category`, for a tapped push to route by. Today
// that is `matchId` on new_match and new_message, so the app can open that chat instead of
// resuming wherever it was left (the decision is apps/mobile/src/lib/notificationRouting.ts),
// and `partyId` on the party pushes.
//
// STRICTLY ADDITIVE, because this deploys to every installed app at once and the app cannot be
// patched: a build that predates `matchId` reads only `data.category` and ignores the rest, so
// it behaves exactly as before. `category` is spread last (pushData) so no extra field can ever
// replace it, since every shipped build routes and refreshes on that one key.
async function notifyProfile(
  profileId: string,
  setting: SettingsColumn,
  category: NotificationCategory,
  title: string,
  body: string,
  extra: Record<string, string> = {},
) {
  const { data: settings } = await supabase
    .from("notification_settings")
    .select(setting)
    .eq("profile_id", profileId)
    .maybeSingle();

  // Default to notifying when no settings row exists yet, rather than silently
  // dropping the notification (settings rows are created by the signup trigger, so
  // a missing row is unexpected, not an intentional opt-out).
  const enabled = settings ? (settings as Record<string, boolean>)[setting] !== false : true;
  if (!enabled) return;

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("profile_id", profileId);

  const tokenList = (tokens ?? []).map((t) => t.expo_push_token as string);
  await sendExpoPush(tokenList, title, body, pushData(extra, category));
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
  setting: SettingsColumn,
  category: PartyPushCategory,
  copy: { title: string; body: string },
  partyId: string,
) {
  await Promise.all(
    recipientIds.map((id) => notifyProfile(id, setting, category, copy.title, copy.body, { partyId })),
  );
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
  await notifyEach([event.targetId], "new_match", "party_invite", copy, event.partyId);
}

async function notifyPartyStarted(event: PartyStartedEvent) {
  if (event.creatorId === event.partnerId) return;
  const memberIds = await getPartyMemberIds(event.partyId);
  if (!memberIds.includes(event.creatorId) || !memberIds.includes(event.partnerId)) return;
  const copy = partyStartedPush(await getDisplayName(event.creatorId));
  await notifyEach([event.partnerId], "new_match", "party_started", copy, event.partyId);
}

async function notifyPartyJoined(event: PartyJoinedEvent) {
  const memberIds = await getPartyMemberIds(event.partyId);
  if (!memberIds.includes(event.joinerId)) return;
  const copy = partyJoinedPush(await getDisplayName(event.joinerId));
  const recipients = partyRecipients(memberIds, event.joinerId);
  await notifyEach(recipients, "new_match", "party_joined", copy, event.partyId);
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
  await notifyEach(recipients, "new_message", "party_message", copy, event.partyId);
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

  switch (event.type) {
    case "new_match": {
      const [nameA, nameB] = await Promise.all([
        getDisplayName(event.userAId),
        getDisplayName(event.userBId),
      ]);
      // Both sides get the match id: either one tapping it lands in the new chat.
      const tapData = { matchId: event.matchId };
      await Promise.all([
        notifyProfile(
          event.userAId,
          "new_match",
          "new_match",
          "New match!",
          `You matched with ${nameB}.`,
          tapData,
        ),
        notifyProfile(
          event.userBId,
          "new_match",
          "new_match",
          "New match!",
          `You matched with ${nameA}.`,
          tapData,
        ),
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
        await notifyProfile(recipientId, "new_message", "new_message", senderName, "Sent you a message", {
          matchId: event.matchId,
        });
      }
      break;
    }
    case "super_ping": {
      const senderName = await getDisplayName(event.senderId);
      const copy = superPingPush(senderName);
      await notifyProfile(event.receiverId, "super_ping", "super_ping", copy.title, copy.body);
      break;
    }
    case "looking_now": {
      const togglerName = await getDisplayName(event.togglerId);
      await notifyProfile(
        event.recipientId,
        "nudge_online",
        "nudge_online",
        `${togglerName} is free to duo right now`,
        "Jump in before the window closes.",
      );
      break;
    }
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

  return jsonResponse({ ok: true }, 200);
});
