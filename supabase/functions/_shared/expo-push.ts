/** Minimal client for the Expo Push API — no SDK dependency needed, it's one POST. */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_TOKENS_PER_REQUEST = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
}

/**
 * `sound: "default"` asks iOS to play the system sound with the banner. Until 15 Oct 2026 no push
 * set it, so every DuoQueue push arrived silent, including a new match or a message from the
 * person you were waiting on. Only pushes about a real person reaching you ask for it (the ones
 * sent through notifyProfile in send-push-notification); the scheduled ones (daily swipes, new
 * player alerts, re-engagement nudges) stay silent, so a sound always means someone.
 *
 * Additive for every shipped build: `sound` is a plain APNs field the app never reads. While
 * the app is open, its own handler (apps/mobile/src/lib/notifications.ts) still decides, and it
 * keeps the in-app banner quiet.
 */
export interface ExpoPushOptions {
  sound?: boolean;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The request bodies sendExpoPush posts, one array per batch of at most 100 tokens. Pure, so
 * it is tested by the mobile vitest runner like new-player-alert.ts. */
export function buildPushBatches(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options: ExpoPushOptions = {},
): ExpoPushMessage[][] {
  const validTokens = tokens.filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"));
  return chunk(validTokens, MAX_TOKENS_PER_REQUEST).map((batch) =>
    batch.map((to) => ({ to, title, body, data, ...(options.sound ? { sound: "default" as const } : {}) })),
  );
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options: ExpoPushOptions = {},
): Promise<void> {
  for (const messages of buildPushBatches(tokens, title, body, data, options)) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
    } catch (err) {
      console.error("Expo push send failed:", err);
    }
  }
}
