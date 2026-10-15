/**
 * The app's Supabase API key: what kind it is, and how to notice when Supabase stops accepting it.
 *
 * Supabase is replacing the legacy JWT keys (anon and service_role) with publishable and secret
 * keys, and switches the legacy ones off in December. The publishable key needs no code change at
 * all: it goes in the same variable (EXPO_PUBLIC_SUPABASE_ANON_KEY keeps its old name, because a
 * renamed variable that is missing at build time throws at import and blanks the launch). What this
 * file adds is the two things that can go wrong:
 *
 * 1. A SECRET key in the app (sb_secret_..., or a legacy JWT whose role is service_role) would
 *    hand every player full database access. `supabaseKeyKind` names it so supabase.ts can refuse
 *    to start.
 * 2. A key that has been switched off makes every request fail with 401 {"message":"Invalid API
 *    key"} (the live gateway's answer, checked 14 Oct 2026). `createKeyAwareFetch` notices that one
 *    answer and hands it to the update gate, which tries an OTA and otherwise shows "Update
 *    DuoQueue". An expired session also answers 401, but it says "JWT", and it must never match:
 *    supabase-js refreshes those by itself.
 *
 * Pure (no imports), so vitest runs it in node.
 */

export type SupabaseKeyKind = "publishable" | "legacy" | "secret" | "unknown";

function decodeJwtPayload(part: string): unknown {
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

export function supabaseKeyKind(key: unknown): SupabaseKeyKind {
  if (typeof key !== "string" || key === "") return "unknown";
  if (key.startsWith("sb_publishable_")) return "publishable";
  if (key.startsWith("sb_secret_")) return "secret";
  if (!key.startsWith("eyJ")) return "unknown";

  // A legacy JWT key. Its role says whether it is the public anon key or the service_role key.
  // Anything that cannot be decoded is still a legacy-shaped key; it is only "secret" when the
  // payload says so outright.
  const parts = key.split(".");
  if (parts.length !== 3) return "legacy";
  try {
    const payload = decodeJwtPayload(parts[1] ?? "");
    if (payload !== null && typeof payload === "object" && (payload as { role?: unknown }).role === "service_role") {
      return "secret";
    }
  } catch {
    // Undecodable: fall through.
  }
  return "legacy";
}

const API_KEY_WORDS = /\bapi ?keys?\b/i;
const JWT_WORD = /jwt/i;

/** A 401 whose body names the API key and does not mention a JWT. */
export function isApiKeyRejection(status: number, body: string): boolean {
  return status === 401 && API_KEY_WORDS.test(body) && !JWT_WORD.test(body);
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Wraps fetch so a 401 "Invalid API key" from any Supabase request (auth, PostgREST, Storage,
 * Functions all use `global.fetch`) calls `onKeyRejected`. The caller gets the ORIGINAL response
 * at once; the body is read from a clone in the background, and any failure there is swallowed.
 */
export function createKeyAwareFetch(baseFetch: FetchLike, onKeyRejected: () => void | Promise<void>): FetchLike {
  return async (input, init) => {
    const res = await baseFetch(input, init);
    if (res.status === 401) {
      void (async () => {
        try {
          const body = await res.clone().text();
          if (isApiKeyRejection(res.status, body)) await onKeyRejected();
        } catch {
          // Inspection is best effort; it must never surface as an unhandled rejection.
        }
      })();
    }
    return res;
  };
}
