/** Minimal client for the Expo Push API: no SDK dependency needed, it's one POST.
 *
 * Pure apart from the one fetch in sendExpoPush (no Deno globals, no npm: imports), so the mobile
 * vitest runner tests the batching, the ticket reading and the push_log row in expo-push.test.ts.
 * The database side (writing push_log, deleting dead tokens) is in push-delivery.ts. */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_TOKENS_PER_REQUEST = 100;

/** Expo's delivery priority. "high" wakes the phone at once (APNs priority 10). */
export type ExpoPushPriority = "default" | "normal" | "high";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** "default" (the system sound) or a sound file bundled in the app, by its file name. */
  sound?: string;
  /** Seconds Expo and APNs keep trying to deliver before dropping the push. */
  ttl?: number;
  priority?: ExpoPushPriority;
}

/**
 * `sound: "default"` asks iOS to play the system sound with the banner. Until 15 Oct 2026 no push
 * set it, so every DuoQueue push arrived silent, including a new match or a message from the
 * person you were waiting on. Only pushes about a real person reaching you ask for it (the ones
 * sent through notifyProfile in send-push-notification, see PUSH_ROUTES in its events.ts); the
 * scheduled ones (daily swipes, new player alerts, re-engagement and first-message nudges,
 * announcements) stay silent, so a sound always means someone.
 *
 * `sound` is `true` for the system sound (sent as "default", exactly as before 1.0.2), or a
 * string: the file name, WITH its extension, of a sound bundled in the app ("duo-pop.wav", the
 * Duo Pop, 1.0.2). An empty string is no sound. Apple documents that a sound file the app does
 * not bundle plays the default alert sound instead, so naming a 1.0.2 sound cannot silence an
 * older build (and only 1.0.2 can opt in to Duo Pops anyway).
 *
 * `ttl` (whole seconds, at least 1) and `priority` go in the message only when given, so every
 * push that does not ask for them is byte-for-byte what it was (the Duo Pop asks for both: it
 * is worthless after its 10 minutes, and it has to arrive now).
 *
 * Additive for every shipped build: these are plain APNs fields the app never reads. While
 * the app is open, its own handler (apps/mobile/src/lib/notifications.ts) still decides, and it
 * keeps the in-app banner quiet.
 */
export interface ExpoPushOptions {
  sound?: boolean | string;
  ttl?: number;
  priority?: ExpoPushPriority;
}

/** The message fields ExpoPushOptions turns into: only the ones that apply. Pure. */
export function pushOptionFields(options: ExpoPushOptions = {}): Pick<ExpoPushMessage, "sound" | "ttl" | "priority"> {
  const out: Pick<ExpoPushMessage, "sound" | "ttl" | "priority"> = {};
  if (options.sound === true) out.sound = "default";
  else if (typeof options.sound === "string" && options.sound.trim() !== "") out.sound = options.sound.trim();
  if (typeof options.ttl === "number" && Number.isFinite(options.ttl) && options.ttl >= 1) {
    out.ttl = Math.floor(options.ttl);
  }
  if (options.priority === "default" || options.priority === "normal" || options.priority === "high") {
    out.priority = options.priority;
  }
  return out;
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
  const extra = pushOptionFields(options);
  return chunk(validTokens, MAX_TOKENS_PER_REQUEST).map((batch) =>
    batch.map((to) => ({ to, title, body, data, ...extra })),
  );
}

// ---------------------------------------------------------------------------------------------
// Tickets
//
// Expo answers a POST of N messages with `{ "data": [ticket, ...] }`, one ticket per message in
// the order sent: `{ "status": "ok", "id": ... }` or
// `{ "status": "error", "message": ..., "details": { "error": "DeviceNotRegistered" } }`.
// A request Expo refuses as a whole (too many projects in one batch, rate limited, a 5xx)
// answers `{ "errors": [{ "code": ..., "message": ... }] }` and no tickets.
//
// Until 15 Oct 2026 all of this was thrown away, so nothing knew whether a push had been
// accepted, and a token for an uninstalled app stayed in push_tokens forever. 0080 adds push_log.
// ---------------------------------------------------------------------------------------------

/** push_log.ticket_status (0080's check constraint allows exactly these). */
export type TicketStatus = "ok" | "partial" | "error" | "no_token" | "transport_error";

/** What happened to one message. */
export interface MessageResult {
  token: string;
  /** Expo's ticket said "ok". */
  accepted: boolean;
  /** No ticket came back for this message at all: the POST failed or Expo refused the request. */
  transport: boolean;
  /** The ticket says the token is dead ("DeviceNotRegistered"): stop sending to it. */
  deviceNotRegistered: boolean;
  /** Expo's error code, or why there is no ticket. Never contains a token; at most 200 chars. */
  error: string | null;
}

/** The whole push to one recipient, summed over every batch. */
export interface PushOutcome {
  /** How many tokens were tried (only Expo-shaped tokens are sent). */
  tokens: number;
  /** How many tickets came back "ok". */
  accepted: number;
  ticketStatus: TicketStatus;
  /** The first failed message's error, or null when every ticket was ok. */
  error: string | null;
  /** Tokens whose ticket said DeviceNotRegistered, for the caller to delete from push_tokens. */
  deadTokens: string[];
}

export const PUSH_LOG_ERROR_MAX = 200;
const EXPO_TOKEN_IN_TEXT = /Expo(?:nent)?PushToken\[[^\]]*\]/g;

/** Text that is safe to store in push_log.error: a string, any push token in it replaced (Expo's
 * `message` quotes the token), trimmed, and cut to 200 characters. Null for anything else. */
export function safeErrorText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(EXPO_TOKEN_IN_TEXT, "<token>").trim();
  return text ? text.slice(0, PUSH_LOG_ERROR_MAX) : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Pairs each message of one POST with its ticket. `body` is the parsed response (null when it
 * was not JSON). */
export function readTickets(messages: ExpoPushMessage[], httpStatus: number, body: unknown): MessageResult[] {
  const record = asRecord(body);
  const tickets = Array.isArray(record.data) ? (record.data as unknown[]) : null;

  if (!tickets) {
    const errors = Array.isArray(record.errors) ? (record.errors as unknown[]) : [];
    const first = asRecord(errors[0]);
    const error = safeErrorText(first.code) ?? safeErrorText(first.message) ?? `http_${httpStatus}`;
    return messages.map((m) => ({
      token: m.to,
      accepted: false,
      transport: true,
      deviceNotRegistered: false,
      error,
    }));
  }

  return messages.map((m, i) => {
    const ticket = tickets[i];
    if (!ticket || typeof ticket !== "object") {
      return { token: m.to, accepted: false, transport: true, deviceNotRegistered: false, error: "no_ticket" };
    }
    const t = asRecord(ticket);
    if (t.status === "ok") {
      return { token: m.to, accepted: true, transport: false, deviceNotRegistered: false, error: null };
    }
    const details = asRecord(t.details);
    return {
      token: m.to,
      accepted: false,
      transport: false,
      deviceNotRegistered: details.error === "DeviceNotRegistered",
      error: safeErrorText(details.error) ?? safeErrorText(t.message) ?? "ticket_error",
    };
  });
}

/** Every message of a batch whose POST threw (network down, DNS, a timeout). */
export function transportFailure(messages: ExpoPushMessage[], err: unknown): MessageResult[] {
  const error = safeErrorText(err instanceof Error ? err.message : String(err)) ?? "transport_error";
  return messages.map((m) => ({ token: m.to, accepted: false, transport: true, deviceNotRegistered: false, error }));
}

export function summarizePush(results: MessageResult[]): PushOutcome {
  const tokens = results.length;
  const accepted = results.filter((r) => r.accepted).length;
  const failures = results.filter((r) => !r.accepted);

  let ticketStatus: TicketStatus;
  if (tokens === 0) ticketStatus = "no_token";
  else if (accepted === tokens) ticketStatus = "ok";
  else if (accepted > 0) ticketStatus = "partial";
  else if (failures.every((r) => r.transport)) ticketStatus = "transport_error";
  else ticketStatus = "error";

  return {
    tokens,
    accepted,
    ticketStatus,
    error: failures[0]?.error ?? null,
    deadTokens: [...new Set(results.filter((r) => r.deviceNotRegistered).map((r) => r.token))],
  };
}

/**
 * Sends one push to every token and says what Expo made of it. Never throws: a failed POST
 * becomes a transport_error outcome (and a console line), because every caller is a trigger or a
 * sweep with nothing to retry and other recipients still to serve.
 *
 * Callers that only await it and ignore the result keep working exactly as before.
 */
export async function sendExpoPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
  options: ExpoPushOptions = {},
): Promise<PushOutcome> {
  const results: MessageResult[] = [];
  for (const messages of buildPushBatches(tokens, title, body, data, options)) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(messages),
      });
      let parsed: unknown = null;
      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }
      results.push(...readTickets(messages, response.status, parsed));
    } catch (err) {
      console.error("Expo push send failed:", err);
      results.push(...transportFailure(messages, err));
    }
  }
  return summarizePush(results);
}

// ---------------------------------------------------------------------------------------------
// push_log (0080)
// ---------------------------------------------------------------------------------------------

/** One push_log row. No title, no body, no data payload: who, what kind, and what Expo said. */
export interface PushLogRow {
  recipient_id: string;
  category: string;
  event: string | null;
  tokens: number;
  accepted: number;
  ticket_status: TicketStatus;
  error: string | null;
}

const SMALLINT_MAX = 32767;
const LOG_LABEL_MAX = 40;

function clampCount(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.min(SMALLINT_MAX, Math.trunc(n))) : 0;
}

/** The row, already inside every check constraint 0080 declares, so an odd value can only ever
 * be clipped, never make the insert fail. */
export function buildPushLogRow(
  recipientId: string,
  category: string,
  event: string | null,
  outcome: PushOutcome,
): PushLogRow {
  const tokens = clampCount(outcome.tokens);
  const label = (event ?? "").trim().slice(0, LOG_LABEL_MAX);
  return {
    recipient_id: recipientId,
    category: (category.trim() || "unknown").slice(0, LOG_LABEL_MAX),
    event: label || null,
    tokens,
    accepted: Math.min(clampCount(outcome.accepted), tokens),
    ticket_status: outcome.ticketStatus,
    error: outcome.error ? outcome.error.slice(0, PUSH_LOG_ERROR_MAX) : null,
  };
}
