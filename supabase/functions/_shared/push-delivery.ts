// One push to one profile, and the record of it. Every Edge Function that pushes a person goes
// through pushToProfile (send-push-notification, send-new-player-alerts,
// send-reengagement-nudges, daily-swipes-refreshed), so push_log cannot miss a sender.
//
// After the send, two writes with the service-role client the caller already holds:
//
//   * one push_log row (0080): recipient, category exactly as sent in data.category, the event
//     that produced it, tokens tried, tickets accepted, ticket status and Expo's error code. No
//     title, no body, no data payload.
//   * DELETE of this profile's push_tokens rows whose ticket said DeviceNotRegistered (the app
//     was uninstalled or the token rotated). The app registers its token again on every sign-in
//     (apps/mobile/src/lib/notifications.ts), so a phone that comes back heals itself.
//
// Neither write can stop or fail a push: they happen after it, and their errors are logged and
// dropped. Before 0080 is applied the push_log insert fails with "relation does not exist",
// which is exactly that case. push_log is monitoring only; every budget and dedupe lives in the
// SQL ledgers that decide to push.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { buildPushLogRow, type PushOutcome, sendExpoPush } from "./expo-push.ts";

export interface ProfilePush {
  recipientId: string;
  /** What produced it, for push_log.event: the send-push-notification event type, or the
   * sweep's name ("new_player_alert", "daily_swipes_refreshed", "nudge_unread"). */
  event: string;
  /** data.category: what the app routes and refreshes on. Spread LAST into data, so nothing in
   * `extra` can replace it (every shipped build routes on this one key). */
  category: string;
  tokens: string[];
  title: string;
  body: string;
  /** Rides in data next to category, for a tapped push to route by (matchId, partyId). */
  extra?: Record<string, string>;
  /** A real person reaching you. See ExpoPushOptions. */
  sound?: boolean;
}

/** This profile's push tokens; empty (and a console line) if the read fails. */
export async function tokensForProfile(supabase: SupabaseClient, profileId: string): Promise<string[]> {
  const { data, error } = await supabase.from("push_tokens").select("expo_push_token").eq("profile_id", profileId);
  if (error) {
    console.error("push token lookup failed:", error.message);
    return [];
  }
  return (data ?? []).map((t) => t.expo_push_token as string);
}

export async function pushToProfile(supabase: SupabaseClient, push: ProfilePush): Promise<PushOutcome> {
  const data: Record<string, string> = { ...(push.extra ?? {}), category: push.category };
  const outcome = await sendExpoPush(push.tokens, push.title, push.body, data, { sound: push.sound === true });
  await Promise.all([
    forgetDeadTokens(supabase, push.recipientId, outcome.deadTokens),
    logPush(supabase, push, outcome),
  ]);
  return outcome;
}

async function forgetDeadTokens(supabase: SupabaseClient, profileId: string, tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  try {
    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .eq("profile_id", profileId)
      .in("expo_push_token", tokens);
    if (error) console.error("dead push token cleanup failed:", error.message);
  } catch (err) {
    console.error("dead push token cleanup failed:", err);
  }
}

async function logPush(supabase: SupabaseClient, push: ProfilePush, outcome: PushOutcome): Promise<void> {
  try {
    const row = buildPushLogRow(push.recipientId, push.category, push.event, outcome);
    const { error } = await supabase.from("push_log").insert(row);
    if (error) console.error("push_log insert failed:", error.message);
  } catch (err) {
    console.error("push_log insert failed:", err);
  }
}
