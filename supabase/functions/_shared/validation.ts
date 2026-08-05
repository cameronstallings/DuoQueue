// One shared body-reading + validation layer for every Edge Function that accepts a
// JSON request body from a caller this project doesn't fully trust — that's every
// function invoked directly by the mobile client (send-message, moderate-photo) and,
// defensively, the ones invoked by internal callers too (a Postgres trigger via pg_net,
// or RevenueCat's webhook), since "internal" here just means "holds the right bearer
// token," not "can't send malformed or oversized JSON."
//
// Three problems this closes, all present in every function before this file existed:
//   1. No cap on request body size before parsing. A multi-MB body is a cheap
//      memory/CPU DoS against a Deno isolate — reading and parsing it costs real work
//      before any field is even looked at, and Content-Length alone isn't a safe guard
//      (it's caller-supplied and can be absent or wrong for a streamed body).
//   2. `req.json().catch(() => ({}))` (the pattern every function used before this)
//      swallows a parse failure into an empty object, which then fails downstream
//      validation with a generic "X is required" instead of a clean "malformed JSON" —
//      indistinguishable from a client bug, useless as a signal that a caller sent
//      garbage on purpose.
//   3. Every function trusted the shape of `body` via a TypeScript interface cast with
//      no runtime check that fields are actually the right type/length/format, so a
//      wrong-typed or malformed field (a non-UUID matchId, a 10MB content string) slid
//      straight through to a Postgres query and surfaced as a raw 500 instead of a
//      clean 400.

const DEFAULT_MAX_BODY_BYTES = 16 * 1024; // Generous for every JSON body this project sends today — the largest is a ~2000-char chat message.

export function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Reads and JSON-parses a request body with a hard byte cap enforced during the read
 * itself, not just a header check. Returns a clean 413/400 Response on any failure
 * (oversized, empty, unreadable, malformed JSON, or a top-level non-object) instead of
 * letting an exception reach the caller as a raw 500, or letting a parse failure get
 * silently swallowed into `{}`.
 */
export async function readJsonBody<T = Record<string, unknown>>(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<BodyResult<T>> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    return { ok: false, response: jsonError("Request body too large", 413) };
  }

  if (!req.body) {
    return { ok: false, response: jsonError("Request body is required", 400) };
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, response: jsonError("Request body too large", 413) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: jsonError("Failed to read request body", 400) };
  }

  if (total === 0) {
    return { ok: false, response: jsonError("Request body is required", 400) };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, response: jsonError("Malformed JSON", 400) };
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, response: jsonError("Request body must be a JSON object", 400) };
  }

  return { ok: true, data: data as T };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True for a syntactically valid (RFC 4122-shaped) UUID string. Every id this project
 * passes across an Edge Function boundary is a Postgres-generated uuid, always this
 * shape — this exists to reject a caller-supplied value before it reaches a query
 * (where a malformed one would otherwise surface as a raw `22P02` Postgres error),
 * not to be a general-purpose UUID parser. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

const DISALLOWED_CONTROL_CHARS_NO_NEWLINE = /[\x01-\x1F\x7F]/;
const DISALLOWED_CONTROL_CHARS_ALLOW_NEWLINE = /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/;

/** Same rule the 0049 migration's has_disallowed_control_chars() enforces at the
 * database layer, mirrored here so a bad request gets a clean 400 from the Edge
 * Function itself instead of surfacing as a raw Postgres constraint-violation error
 * further down the call. `minLength` is measured against the trimmed value (so an
 * all-whitespace string never passes); `maxLength` against the raw value (so padding
 * can't be used to sneak past a length cap the way it could past a trim-only check). */
export function isCleanText(
  value: unknown,
  opts: { minLength?: number; maxLength: number; allowNewlines?: boolean },
): value is string {
  if (typeof value !== "string") return false;
  const min = opts.minLength ?? 1;
  if (value.trim().length < min) return false;
  if (value.length > opts.maxLength) return false;
  const pattern = opts.allowNewlines ? DISALLOWED_CONTROL_CHARS_ALLOW_NEWLINE : DISALLOWED_CONTROL_CHARS_NO_NEWLINE;
  return !pattern.test(value);
}

/** Loose bound for fields this project doesn't own the format of (a RevenueCat event
 * id, a product id, an external provider's identifier) — just a type + length guard
 * against an absent/oversized value, no character-class opinion. */
export function isBoundedString(value: unknown, maxLength: number, minLength = 1): value is string {
  return typeof value === "string" && value.length >= minLength && value.length <= maxLength;
}
