// The like alert's words (0072_like_alerts.sql). Pure (no Deno globals, no npm: imports), so
// apps/mobile's vitest runs likeAlertCopy.test.ts the way it runs superPingCopy.test.ts.
//
// No name and no id of the liker, here or in the payload: the event carries only the recipient
// and a count. The deck is where identity belongs, and 0071 puts the liker on top of it, so
// "Open your deck to see who" is true. Sent under category "new_player", which is what makes
// the 1.0.1 app open and refresh the deck on a tap.
//
// No em or en dashes, no dating line (Cameron's standing rules for every user-visible string).

import type { PushCopy } from "./superPingCopy.ts";

export function likeAlertPush(likeCount: number): PushCopy {
  const n = Number.isFinite(likeCount) ? Math.max(1, Math.trunc(likeCount)) : 1;
  return {
    title: n === 1 ? "Someone wants to duo with you" : `${n} players want to duo with you`,
    body: "Open your deck to see who.",
  };
}
