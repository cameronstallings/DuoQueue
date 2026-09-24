import { describe, expect, it } from "vitest";

import { APPLE_ISSUER, appleIdTokenSubject, appleSubjectsOf, isCallersAppleSubject } from "./apple-id-token";

const CLIENT_ID = "com.duoqueue.app";

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** An unsigned JWT with the given claims. The signature is never read, by design. */
function idToken(claims: Record<string, unknown>): string {
  return `${base64Url(JSON.stringify({ alg: "RS256", kid: "test" }))}.${base64Url(JSON.stringify(claims))}.sig`;
}

const appleIdentity = {
  provider: "apple",
  id: "001234.abcdef.0987",
  identity_data: { sub: "001234.abcdef.0987", provider_id: "001234.abcdef.0987", email: "x@privaterelay.appleid.com" },
};

describe("appleIdTokenSubject", () => {
  it("reads the subject of a token Apple minted for this app", () => {
    expect(appleIdTokenSubject(idToken({ iss: APPLE_ISSUER, aud: CLIENT_ID, sub: "001234.abcdef.0987" }), CLIENT_ID)).toBe(
      "001234.abcdef.0987",
    );
  });

  it("accepts an audience given as a list", () => {
    expect(appleIdTokenSubject(idToken({ iss: APPLE_ISSUER, aud: [CLIENT_ID], sub: "s" }), CLIENT_ID)).toBe("s");
  });

  it("decodes a payload that needs base64url padding and non-ASCII", () => {
    // Real Apple payloads are not a multiple of three bytes, and names in them need not be ASCII.
    const token = idToken({ iss: APPLE_ISSUER, aud: CLIENT_ID, sub: "s", note: "Zoë 李" });
    expect(appleIdTokenSubject(token, CLIENT_ID)).toBe("s");
  });

  it("refuses a token minted for another client", () => {
    expect(appleIdTokenSubject(idToken({ iss: APPLE_ISSUER, aud: "com.other.app", sub: "s" }), CLIENT_ID)).toBeNull();
  });

  it("refuses a token from another issuer", () => {
    expect(appleIdTokenSubject(idToken({ iss: "https://accounts.google.com", aud: CLIENT_ID, sub: "s" }), CLIENT_ID)).toBeNull();
  });

  it("answers null, never throws, for anything that is not a token", () => {
    for (const value of [undefined, null, 42, "", "a.b", "a.b.c.d", "a..c", "a.!!!.c", `x.${base64Url("not json")}.y`]) {
      expect(appleIdTokenSubject(value, CLIENT_ID)).toBeNull();
    }
    expect(appleIdTokenSubject(`x.${base64Url("null")}.y`, CLIENT_ID)).toBeNull();
    expect(appleIdTokenSubject(idToken({ iss: APPLE_ISSUER, aud: CLIENT_ID }), CLIENT_ID)).toBeNull();
    expect(appleIdTokenSubject(idToken({ iss: APPLE_ISSUER, aud: CLIENT_ID, sub: "" }), CLIENT_ID)).toBeNull();
    expect(appleIdTokenSubject(idToken({ iss: APPLE_ISSUER, aud: CLIENT_ID, sub: 7 }), CLIENT_ID)).toBeNull();
  });
});

describe("appleSubjectsOf", () => {
  it("collects the Apple subject from every place GoTrue has kept it", () => {
    expect(appleSubjectsOf([{ provider: "apple", id: "a" }])).toEqual(["a"]);
    expect(appleSubjectsOf([{ provider: "apple", identity_data: { sub: "b" } }])).toEqual(["b"]);
    expect(appleSubjectsOf([{ provider: "apple", identity_data: { provider_id: "c" } }])).toEqual(["c"]);
    expect(appleSubjectsOf([appleIdentity])).toEqual(["001234.abcdef.0987"]);
  });

  it("ignores every other provider", () => {
    expect(appleSubjectsOf([{ provider: "email", id: "u", identity_data: { sub: "u" } }])).toEqual([]);
    expect(appleSubjectsOf(null)).toEqual([]);
    expect(appleSubjectsOf(undefined)).toEqual([]);
  });
});

describe("isCallersAppleSubject", () => {
  it("matches the caller's own Apple ID", () => {
    expect(isCallersAppleSubject("001234.abcdef.0987", [{ provider: "email", id: "u" }, appleIdentity])).toBe(true);
  });

  it("refuses somebody else's Apple ID", () => {
    // The case the check exists for: a code from whatever Apple ID the phone is signed in to,
    // posted by an account made with a different one.
    expect(isCallersAppleSubject("009999.other.1111", [appleIdentity])).toBe(false);
  });

  it("refuses any code posted by an account with no Apple identity at all", () => {
    expect(isCallersAppleSubject("001234.abcdef.0987", [{ provider: "email", id: "u", identity_data: { sub: "u" } }])).toBe(false);
    expect(isCallersAppleSubject("001234.abcdef.0987", [])).toBe(false);
    expect(isCallersAppleSubject("001234.abcdef.0987", undefined)).toBe(false);
  });

  it("never matches a missing subject", () => {
    expect(isCallersAppleSubject(null, [appleIdentity])).toBe(false);
    expect(isCallersAppleSubject("", [{ provider: "apple", id: "" }])).toBe(false);
  });
});
