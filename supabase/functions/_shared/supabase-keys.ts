// Which Supabase API key an Edge Function hands to createClient.
//
// WHY THIS EXISTS. Supabase is retiring the legacy JWT keys (`anon` and `service_role`) "by
// the end of 2026", and DuoQueue plans to deactivate them in early December. The runtime has
// injected the replacements next to the legacy ones for a while:
//
//   SUPABASE_SECRET_KEYS       JSON dictionary of secret keys by name   ('default' -> sb_secret_...)
//   SUPABASE_PUBLISHABLE_KEYS  JSON dictionary of publishable keys       ('default' -> sb_publishable_...)
//   SUPABASE_SERVICE_ROLE_KEY  legacy service_role JWT (plain string)
//   SUPABASE_ANON_KEY          legacy anon JWT (plain string)
//
// Source: https://supabase.com/docs/guides/functions/secrets ("Default secrets") and
// https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys (Step 4), both
// read 14 Oct 2026. The docs' own example is JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)
// ['default']; 'default' is the name the project's first key pair was created under.
//
// Every function used to read the legacy variable directly, so the day the legacy keys go
// off, pushes, nudges, the RevenueCat webhook, chat send, photo moderation and account
// deletion would all stop at once. Every function now asks this module instead:
//
//   - The NEW key wins whenever its dictionary has a usable `default` entry (or, after a
//     rotation has deleted `default`, exactly one key; see pickNamedKey).
//   - The LEGACY variable is the fallback, so a missing, empty or malformed dictionary never
//     takes a function down before the switch-off. That fallback is logged (the variable
//     NAME only, never a value) so the function logs show whether anything still leans on
//     it before the legacy keys are deactivated.
//   - Neither present is a hard failure with a clear message, the same fail-closed stance as
//     requireSecret() in require-secret-auth.ts, rather than createClient's later and vaguer
//     "supabaseKey is required."
//
// Swapping the key does not change what the key can do: the secret key bypasses RLS exactly
// as service_role did, and the publishable key carries anon's privileges, so the user-scoped
// clients (a publishable key plus the caller's own JWT in Authorization) see the same rows.
// Callers into these functions are unaffected: the cron/trigger paths authenticate with
// INTERNAL_TRIGGER_AUTH_TOKEN, the app with a user session.
//
// Purity: everything that decides is a plain function over a `readEnv` callback, so
// apps/mobile's vitest runs the tests next to this file (see apps/mobile/vitest.config.ts).
// The only Deno reference is the default reader, which is evaluated only when a function is
// called WITHOUT a reader, which the tests never do.

/** Reads one environment variable; undefined when unset. */
export type EnvReader = (name: string) => string | undefined;

/** The name Supabase gives a project's first publishable and secret keys. */
export const DEFAULT_KEY_NAME = "default";

export type SupabaseKeyKind = "secret" | "publishable";

/** Where each kind of key lives: the new JSON dictionary first, the legacy string second. */
export const KEY_VARIABLES: Record<SupabaseKeyKind, { dictionary: string; legacy: string }> = {
  secret: { dictionary: "SUPABASE_SECRET_KEYS", legacy: "SUPABASE_SERVICE_ROLE_KEY" },
  publishable: { dictionary: "SUPABASE_PUBLISHABLE_KEYS", legacy: "SUPABASE_ANON_KEY" },
};

export interface ResolvedKey {
  key: string;
  /** "new" when it came from the JSON dictionary, "legacy" when from the old variable. */
  source: "new" | "legacy";
  /** The environment variable the key was read from (a name, never a value). */
  variable: string;
}

function usable(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Picks one key out of a SUPABASE_*_KEYS JSON dictionary.
 *
 * The entry called `name` ('default') wins. When there is NO entry by that name but the
 * dictionary holds exactly one key, that key is used instead: that is the state a rotation
 * leaves behind (Supabase's procedure is "create a new secret key, then delete the leaked
 * one", and the new key cannot be called 'default' while the old one still is), and without
 * this rule deleting a leaked 'default' key after the switch-off would take every function
 * down until a code change. Two or more keys with none called `name` is ambiguous, so null.
 *
 * Returns null (never throws) for anything else: unset, empty, malformed JSON, `null`, an
 * array, an empty map, or a non-string / empty value. Null means "fall back", so a surprise
 * in the new variable can never be worse than not having it.
 */
export function pickNamedKey(
  dictionaryJson: string | undefined,
  name: string = DEFAULT_KEY_NAME,
): string | null {
  if (!usable(dictionaryJson)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(dictionaryJson);
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const dictionary = parsed as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(dictionary, name)) {
    const value = dictionary[name];
    return usable(value) ? value : null;
  }
  const names = Object.keys(dictionary);
  if (names.length !== 1) return null;
  const only = dictionary[names[0]];
  return usable(only) ? only : null;
}

/** The new key if usable, else the legacy one, else null. Pure. */
export function resolveSupabaseKey(
  kind: SupabaseKeyKind,
  readEnv: EnvReader,
  name: string = DEFAULT_KEY_NAME,
): ResolvedKey | null {
  const vars = KEY_VARIABLES[kind];
  const fromDictionary = pickNamedKey(readEnv(vars.dictionary), name);
  if (fromDictionary !== null) {
    return { key: fromDictionary, source: "new", variable: vars.dictionary };
  }
  const legacy = readEnv(vars.legacy);
  if (usable(legacy)) return { key: legacy, source: "legacy", variable: vars.legacy };
  return null;
}

const denoEnv: EnvReader = (name) => Deno.env.get(name);

function requireKey(
  kind: SupabaseKeyKind,
  readEnv: EnvReader,
  warn: (message: string) => void,
): string {
  const resolved = resolveSupabaseKey(kind, readEnv);
  const vars = KEY_VARIABLES[kind];
  if (resolved === null) {
    throw new Error(
      `No Supabase ${kind} key: ${vars.dictionary} has no usable '${DEFAULT_KEY_NAME}' entry and ` +
        `${vars.legacy} is not set. Edge Functions receive both automatically; check the ` +
        `project's API keys (Settings > API Keys).`,
    );
  }
  if (resolved.source === "legacy") {
    warn(
      `[supabase-keys] ${vars.dictionary} has no usable '${DEFAULT_KEY_NAME}' key, so this ` +
        `function is using the legacy ${vars.legacy}. It stops working when the legacy keys ` +
        `are deactivated.`,
    );
  }
  return resolved.key;
}

/**
 * The key for a client that bypasses RLS (what SUPABASE_SERVICE_ROLE_KEY used to be).
 * Server-side only, never returned to a caller or logged.
 */
export function supabaseSecretKey(
  readEnv: EnvReader = denoEnv,
  warn: (message: string) => void = console.warn,
): string {
  return requireKey("secret", readEnv, warn);
}

/**
 * The key for a user-scoped client that carries the caller's JWT and so respects RLS (what
 * SUPABASE_ANON_KEY used to be).
 */
export function supabasePublishableKey(
  readEnv: EnvReader = denoEnv,
  warn: (message: string) => void = console.warn,
): string {
  return requireKey("publishable", readEnv, warn);
}
