// Shared bearer-token gate for the functions deployed with `verify_jwt = false`.
//
// These endpoints have no gateway JWT check, so this comparison is the only thing
// standing between the public internet and a service-role client. Two properties
// matter, and the previous inline `if (TOKEN) { ... }` pattern had neither:
//
//  1. Fail CLOSED. `Deno.env.get()` returns undefined for an unset secret, so wrapping
//     the check in `if (TOKEN)` skipped authentication entirely and answered 200 —
//     silently, and exactly in the situations you'd expect it (fresh project, renamed
//     secret, `secrets unset`). A missing secret must be a hard failure, not an open door.
//  2. Compare in constant time. `a !== b` on strings exits at the first differing byte.
//     Remote timing attacks over network jitter are impractical, but comparing digests
//     of equal length costs nothing and removes the question.

/** Reads a required secret, throwing at module-load time if it isn't configured. */
export function requireSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(
      `${name} is not set. This function authenticates callers with that shared secret and refuses to run without it.`,
    );
  }
  return value;
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(digest);
}

/** Constant-time equality over SHA-256 digests, so neither length nor content leaks. */
async function secureEquals(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

/** Returns null when the caller presented the right bearer token, or a 401 Response. */
export async function checkBearerAuth(req: Request, expectedToken: string): Promise<Response | null> {
  const presented = req.headers.get("Authorization") ?? "";
  if (await secureEquals(presented, `Bearer ${expectedToken}`)) return null;
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
