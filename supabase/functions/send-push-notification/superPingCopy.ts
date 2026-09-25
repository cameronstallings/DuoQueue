// The Super Ping push's words. Pure (no Deno globals, no npm: imports), so apps/mobile's vitest
// runs superPingCopy.test.ts (its vitest.config.mts includes supabase/functions/**/*.test.ts).
// Build 17: "{name} is very interested in you" was a dating line, and the paywall now sells
// Super Ping, so it says what a Super Ping is: someone wants to duo.

export interface PushCopy {
  title: string;
  body: string;
}

export function superPingPush(senderName: string): PushCopy {
  return { title: "Super Ping", body: `${senderName} wants to duo with you.` };
}
