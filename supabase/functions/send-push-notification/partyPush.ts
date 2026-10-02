// The party pushes' words, who receives them, and the shape of every push's `data`. Pure (no
// Deno globals, no npm: imports), so apps/mobile's vitest runs partyPush.test.ts the way it
// runs superPingCopy.test.ts (its vitest.config.mts includes supabase/functions/**/*.test.ts).
//
// Four party events, all sent by Postgres (migration 0070) and all opt-outable through the
// EXISTING toggles rather than new ones: an invite, a started party and a new member ride on
// "New match", a party chat message on "New message". That is Cameron's call, and it is also
// what keeps the store build honest: its Settings screen already shows those two switches, so
// a person who turned one off is not pushed by a category that build has never heard of.
//
// No em or en dashes anywhere in this copy (his standing rule for every user-visible string).

import type { PushCopy } from "./superPingCopy.ts";

export type PartyPushCategory = "party_invite" | "party_started" | "party_joined" | "party_message";

/** "Alex & Sam". Every name the push carries, in the order given (oldest member first). */
export function joinNames(names: string[]): string {
  return names.join(" & ");
}

/** To the person the party just invited. `memberNames` is the party as it stands, without them. */
export function partyInvitePush(memberNames: string[]): PushCopy {
  // A party invites only at two members, so this is nearly always "want". One name is the
  // leftover of a member deleting their account in between, and "Alex want you" would read
  // as a typo.
  const verb = memberNames.length === 1 ? "wants" : "want";
  return {
    title: "Party invite",
    body: `${joinNames(memberNames)} ${verb} you in their party. Open Matches to accept.`,
  };
}

/** To the match the creator started the party with. */
export function partyStartedPush(creatorName: string): PushCopy {
  return {
    title: `${creatorName} started a party`,
    body: "Swipe together to find a third. It's under Your parties on Matches.",
  };
}

/** To every member already in the party when someone accepts an invite. */
export function partyJoinedPush(joinerName: string): PushCopy {
  return { title: `${joinerName} joined your party`, body: "Say hi in the party chat." };
}

/** To every other member when someone writes in the party chat. Never the message itself. */
export function partyMessagePush(senderName: string): PushCopy {
  return { title: senderName, body: "Sent a message in your party chat" };
}

/** Everyone in `memberIds` except the person who acted, each once. */
export function partyRecipients(memberIds: string[], actorId: string): string[] {
  return [...new Set(memberIds)].filter((id) => id !== actorId);
}

/**
 * The push's `data`: whatever the event adds for a tap to route by (`matchId` on the chat and
 * match pushes, `partyId` on the party ones), then `category` LAST, so no extra field can ever
 * replace it. Every shipped build routes and refreshes on `category` alone, and a party push
 * never carries `matchId`, so no build can mistake one for a 1:1 chat push.
 */
export function pushData(extra: Record<string, string>, category: string): Record<string, string> {
  return { ...extra, category };
}

/**
 * The same event with every id lowercased. Postgres always sends lowercase uuids, so this
 * changes nothing in practice; it is here because the app accepts a party push's `partyId`
 * only as a lowercase UUID, and because the checks below compare these ids with `===` against
 * what Postgres returns.
 */
export function lowercaseIds<T extends { type: string }>(event: T): T {
  const out: Record<string, unknown> = { ...event };
  for (const [key, value] of Object.entries(out)) {
    if (key !== "type" && typeof value === "string") out[key] = value.toLowerCase();
  }
  return out as T;
}
