import { describe, expect, it, vi } from "vitest";

import {
  pickNamedKey,
  resolveSupabaseKey,
  supabasePublishableKey,
  supabaseSecretKey,
} from "./supabase-keys";

// Obviously fake values with the real prefixes. No real key belongs in a test.
const NEW_SECRET = "sb_secret_test-only-not-a-key";
const NEW_PUBLISHABLE = "sb_publishable_test-only-not-a-key";
const LEGACY_SERVICE = "legacy-service-role-test-only";
const LEGACY_ANON = "legacy-anon-test-only";

function env(vars: Record<string, string | undefined>) {
  return (name: string) => vars[name];
}

describe("pickNamedKey", () => {
  it("reads the default entry of the JSON dictionary", () => {
    expect(pickNamedKey(JSON.stringify({ default: NEW_SECRET }))).toBe(NEW_SECRET);
  });

  it("reads another name when asked", () => {
    expect(pickNamedKey(JSON.stringify({ default: "a", billing: "b" }), "billing")).toBe("b");
  });

  it("prefers default over other keys", () => {
    expect(pickNamedKey(JSON.stringify({ rotated: "b", default: "a" }))).toBe("a");
  });

  it("uses the only key when none is called default (after a rotation deletes default)", () => {
    expect(pickNamedKey(JSON.stringify({ rotated_2027: NEW_SECRET }))).toBe(NEW_SECRET);
  });

  it("returns null when several keys exist and none is called default", () => {
    expect(pickNamedKey(JSON.stringify({ a: "x", b: "y" }))).toBeNull();
  });

  it("does not fall through to another key when default exists but is empty", () => {
    expect(pickNamedKey(JSON.stringify({ default: "" }))).toBeNull();
  });

  it.each([
    ["unset", undefined],
    ["empty string", ""],
    ["malformed JSON", "{default: sb_secret_x"],
    ["a bare key instead of a dictionary", NEW_SECRET],
    ["JSON null", "null"],
    ["a JSON array", JSON.stringify([NEW_SECRET])],
    ["a JSON string", JSON.stringify(NEW_SECRET)],
    ["an empty map", "{}"],
    ["several entries, none default", JSON.stringify({ billing: NEW_SECRET, ops: NEW_SECRET })],
    ["an empty sole entry", JSON.stringify({ billing: "" })],
    ["an empty default", JSON.stringify({ default: "" })],
    ["a blank default", JSON.stringify({ default: "   " })],
    ["a non-string default", JSON.stringify({ default: 42 })],
    ["a nested object default", JSON.stringify({ default: { key: NEW_SECRET } })],
  ])("returns null for %s", (_label, input) => {
    expect(pickNamedKey(input)).toBeNull();
  });

  it("does not pick up inherited properties", () => {
    expect(pickNamedKey("{}", "toString")).toBeNull();
  });
});

describe("resolveSupabaseKey", () => {
  it("prefers the new secret key when both are present", () => {
    const read = env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: NEW_SECRET }),
      SUPABASE_SERVICE_ROLE_KEY: LEGACY_SERVICE,
    });
    expect(resolveSupabaseKey("secret", read)).toEqual({
      key: NEW_SECRET,
      source: "new",
      variable: "SUPABASE_SECRET_KEYS",
    });
  });

  it("prefers the new publishable key when both are present", () => {
    const read = env({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: NEW_PUBLISHABLE }),
      SUPABASE_ANON_KEY: LEGACY_ANON,
    });
    expect(resolveSupabaseKey("publishable", read)).toEqual({
      key: NEW_PUBLISHABLE,
      source: "new",
      variable: "SUPABASE_PUBLISHABLE_KEYS",
    });
  });

  it("uses the new key with no legacy key at all (after the switch-off)", () => {
    const read = env({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: NEW_SECRET }) });
    expect(resolveSupabaseKey("secret", read)?.key).toBe(NEW_SECRET);
  });

  it("falls back to the legacy service_role key when only it is present", () => {
    const read = env({ SUPABASE_SERVICE_ROLE_KEY: LEGACY_SERVICE });
    expect(resolveSupabaseKey("secret", read)).toEqual({
      key: LEGACY_SERVICE,
      source: "legacy",
      variable: "SUPABASE_SERVICE_ROLE_KEY",
    });
  });

  it("falls back to the legacy anon key when only it is present", () => {
    const read = env({ SUPABASE_ANON_KEY: LEGACY_ANON });
    expect(resolveSupabaseKey("publishable", read)).toEqual({
      key: LEGACY_ANON,
      source: "legacy",
      variable: "SUPABASE_ANON_KEY",
    });
  });

  it("falls back to legacy when the dictionary is malformed JSON", () => {
    const read = env({
      SUPABASE_SECRET_KEYS: "{not json",
      SUPABASE_SERVICE_ROLE_KEY: LEGACY_SERVICE,
    });
    expect(resolveSupabaseKey("secret", read)?.source).toBe("legacy");
  });

  it("falls back to legacy when the dictionary is an empty map", () => {
    const read = env({
      SUPABASE_PUBLISHABLE_KEYS: "{}",
      SUPABASE_ANON_KEY: LEGACY_ANON,
    });
    expect(resolveSupabaseKey("publishable", read)?.key).toBe(LEGACY_ANON);
  });

  it("never crosses kinds: a secret lookup ignores the publishable keys and anon", () => {
    const read = env({
      SUPABASE_PUBLISHABLE_KEYS: JSON.stringify({ default: NEW_PUBLISHABLE }),
      SUPABASE_ANON_KEY: LEGACY_ANON,
    });
    expect(resolveSupabaseKey("secret", read)).toBeNull();
  });

  it("returns null when neither is usable", () => {
    const read = env({ SUPABASE_SECRET_KEYS: "{}", SUPABASE_SERVICE_ROLE_KEY: "" });
    expect(resolveSupabaseKey("secret", read)).toBeNull();
  });
});

describe("supabaseSecretKey / supabasePublishableKey", () => {
  it("returns the new key without warning", () => {
    const warn = vi.fn();
    const read = env({
      SUPABASE_SECRET_KEYS: JSON.stringify({ default: NEW_SECRET }),
      SUPABASE_SERVICE_ROLE_KEY: LEGACY_SERVICE,
    });
    expect(supabaseSecretKey(read, warn)).toBe(NEW_SECRET);
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns the legacy key and warns by variable name, never by value", () => {
    const warn = vi.fn();
    const read = env({ SUPABASE_ANON_KEY: LEGACY_ANON });
    expect(supabasePublishableKey(read, warn)).toBe(LEGACY_ANON);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain("SUPABASE_ANON_KEY");
    expect(message).toContain("SUPABASE_PUBLISHABLE_KEYS");
    expect(message).not.toContain(LEGACY_ANON);
  });

  it("throws a clear error, without any key value, when neither is present", () => {
    const read = env({ SUPABASE_SECRET_KEYS: "{bad" });
    expect(() => supabaseSecretKey(read, vi.fn())).toThrow(
      /SUPABASE_SECRET_KEYS.*SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(() => supabasePublishableKey(env({}), vi.fn())).toThrow(
      /SUPABASE_PUBLISHABLE_KEYS.*SUPABASE_ANON_KEY/,
    );
  });
});
