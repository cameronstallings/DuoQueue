import type { NotificationSettingsRow } from "@duoqueue/shared-types";

import type { PushPermissionState } from "../push/pushAsk";

/**
 * Settings > Notifications: which switches exist, in which order, and what they say
 * (notificationCategories.test.ts).
 *
 * A row shows only when the fetched settings row HAS its column, so the same build is honest
 * against every state of the database: today's table has seven columns and the screen shows
 * seven rows; `new_like` (0072), `announcements` (0081) and `queue_pop` (the Queue Up migration)
 * each appear the moment their column exists, with no app update. A switch for a column that is
 * not there would save nothing and snap back.
 */

export type NotificationCategory = Exclude<keyof NotificationSettingsRow, "profile_id">;

export interface NotificationCategoryRow {
  value: NotificationCategory;
  label: string;
  hint: string;
}

export const NOTIFICATION_CATEGORIES: readonly NotificationCategoryRow[] = [
  { value: "new_match", label: "New match", hint: "When someone you picked wants to duo with you too." },
  { value: "new_message", label: "New message", hint: "When a match sends you something." },
  // Beside the other person-driven rows: a person did something about you.
  {
    value: "new_like",
    label: "Someone wants to duo with you",
    hint: "When a player in your game and server duos you.",
  },
  { value: "super_ping", label: "Super Ping", hint: "When someone sends you a Super Ping." },
  {
    value: "new_player",
    label: "New players in your games",
    hint: "When someone who plays your games joins DuoQueue.",
  },
  // Opt-in (the column defaults to false), and the hint states both server rules: 3 a day, and
  // never between 1 am and 10 am local time.
  {
    value: "queue_pop",
    label: "Duo Pops",
    hint: "When someone who plays your game queues up. Up to 3 a day, never between 1 am and 10 am.",
  },
  // Same column as before ("Free to duo right now"); Queue up replaced the Online Now switch.
  { value: "nudge_online", label: "A match queues up", hint: "When one of your matches taps Queue up." },
  {
    value: "nudge_unread",
    label: "Your duo is waiting",
    hint: "A gentle nudge when you haven't read a match's message.",
  },
  // Since 0076 it only fires the morning after the player actually ran out.
  {
    value: "daily_swipes_refreshed",
    label: "Swipes refreshed",
    hint: "The morning after you use up your free swipes.",
  },
  {
    value: "announcements",
    label: "News from DuoQueue",
    hint: "Occasional updates from the DuoQueue team. Off until you turn it on.",
  },
];

/** The rows whose column is present in the fetched row as a boolean, in screen order. */
export function visibleCategories(row: Partial<Record<string, unknown>> | null | undefined): NotificationCategoryRow[] {
  if (!row) return [];
  return NOTIFICATION_CATEGORIES.filter((c) => typeof row[c.value] === "boolean");
}

/** Turning a switch on while iOS has never been asked is the moment to ask it: the player just
 * said they want that notification. Never for denied (iOS will not ask again; the banner above
 * the switches has the Settings path) or while the permission is still unknown. */
export function turningOnNeedsPermission(next: boolean, permission: PushPermissionState | undefined): boolean {
  return next && permission?.status === "undetermined";
}
