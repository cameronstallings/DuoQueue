import { describe, expect, it } from "vitest";

import { hasAppleIdentity } from "./appleIdentity";

/**
 * The one question deletion asks before deciding whether to show Apple's sheet. A false negative
 * leaves a Sign in with Apple grant alive after the account is gone (Guideline 5.1.1(v)); a false
 * positive shows an email user an Apple sheet they can dismiss. The tests lean on the first.
 */
describe("hasAppleIdentity", () => {
  it("recognises an Apple signup from the providers list", () => {
    expect(hasAppleIdentity({ app_metadata: { provider: "apple", providers: ["apple"] } })).toBe(true);
  });

  it("recognises an email account that was later linked to Apple", () => {
    // GoTrue's automatic linking keeps `provider` as the FIRST identity, so this account's
    // `provider` still says email. Only `providers` knows about Apple.
    expect(hasAppleIdentity({ app_metadata: { provider: "email", providers: ["email", "apple"] } })).toBe(true);
  });

  it("falls back to the single provider field on an older session", () => {
    expect(hasAppleIdentity({ app_metadata: { provider: "apple" } })).toBe(true);
  });

  it("falls back to the identities list", () => {
    expect(hasAppleIdentity({ app_metadata: {}, identities: [{ provider: "email" }, { provider: "apple" }] })).toBe(
      true,
    );
  });

  it("leaves an email account alone, so its deletion is exactly what it was", () => {
    expect(
      hasAppleIdentity({
        app_metadata: { provider: "email", providers: ["email"] },
        identities: [{ provider: "email" }],
      }),
    ).toBe(false);
  });

  it("answers false for no user, and for shapes it cannot read", () => {
    expect(hasAppleIdentity(null)).toBe(false);
    expect(hasAppleIdentity(undefined)).toBe(false);
    expect(hasAppleIdentity({})).toBe(false);
    expect(hasAppleIdentity({ app_metadata: null, identities: null })).toBe(false);
    expect(hasAppleIdentity({ app_metadata: { providers: "apple" } })).toBe(false);
    expect(hasAppleIdentity({ app_metadata: { provider: "Apple" } })).toBe(false);
  });
});
