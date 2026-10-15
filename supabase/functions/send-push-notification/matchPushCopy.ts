// The words of the pushes about one match: a proposed time and a shared Discord (0073), the
// first-message nudge (0075), and "free to duo right now" (0074). Pure (no Deno globals, no npm:
// imports), so apps/mobile's vitest runs matchPushCopy.test.ts the way it runs
// superPingCopy.test.ts.
//
// Every one of these is sent with data.matchId, so a tap opens that chat on the shipped 1.0.1
// app (see PUSH_ROUTES in events.ts for the category each rides under).
//
// No em or en dashes, no dating line, nothing that names a game's publisher (Cameron's standing
// rules for every user-visible string).

import type { PushCopy } from "./superPingCopy.ts";

/** profiles.timezone is a validated IANA name but nullable; the SQL falls back to New York
 * everywhere, and so does this. */
export const FALLBACK_TIMEZONE = "America/New_York";

function playTimeIn(scheduledAt: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(scheduledAt);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const minute = part("minute");
  const clock = minute && minute !== "00" ? `${part("hour")}:${minute}` : part("hour");
  return `${part("weekday")} ${clock}${part("dayPeriod").toLowerCase()}`;
}

/** "Sat 7pm", "Sun 12:30am": the proposed time on the RECIPIENT's clock. An unknown or invalid
 * zone falls back to New York rather than failing the push. */
export function formatPlayTime(scheduledAt: Date, timeZone: string | null | undefined): string {
  const zone = timeZone?.trim();
  if (zone) {
    try {
      return playTimeIn(scheduledAt, zone);
    } catch {
      // RangeError: not a zone this runtime knows. Fall through.
    }
  }
  return playTimeIn(scheduledAt, FALLBACK_TIMEZONE);
}

/** To the other player when someone proposes a time. */
export function sessionProposedPush(proposerName: string, playTime: string): PushCopy {
  return { title: `${proposerName} wants to play ${playTime}`, body: "Tap to confirm or pick another time." };
}

/** To the other player when someone shares their Discord in the chat. Never the username. */
export function discordSharedPush(sharerName: string): PushCopy {
  return { title: `${sharerName} shared their Discord`, body: "Copy it from the chat." };
}

/** To one side of a new match nobody has written in yet. `otherName` null or blank (a profile
 * with no display name) still reads as a sentence. */
export function firstMessageNudgePush(otherName: string | null | undefined): PushCopy {
  const name = otherName?.trim();
  return {
    title: name ? `Say hi to ${name}` : "Say hi to your new duo",
    body: "You matched. Send the first message and pick a time to play.",
  };
}

/** To each match when someone switches on "free to duo right now". Same words as before 0074;
 * only its category and matchId changed (events.ts). */
export function lookingNowPush(togglerName: string): PushCopy {
  return { title: `${togglerName} is free to duo right now`, body: "Jump in before the window closes." };
}
