/** Minimal client for the Expo Push API — no SDK dependency needed, it's one POST. */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_TOKENS_PER_REQUEST = 100;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const validTokens = tokens.filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken"));
  if (validTokens.length === 0) return;

  for (const batch of chunk(validTokens, MAX_TOKENS_PER_REQUEST)) {
    const messages: ExpoPushMessage[] = batch.map((to) => ({ to, title, body, data }));
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
