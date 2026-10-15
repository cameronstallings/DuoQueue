import { describe, expect, it } from "vitest";

import { inviteRedirectTarget, inviteResponse, parseInviteCodeFromUrl, WAITLIST_URL } from "./invite-link";

// The value 0082 stores in app_config.app_store_url.
const STORE_URL = "https://apps.apple.com/app/apple-store/id6798837181?pt=129274943&ct=invite&mt=8";
const BASE = "https://oflexcazqfuvcikrewnb.supabase.co/functions/v1/invite";

describe("inviteRedirectTarget", () => {
  it("sends the browser to the stored App Store link exactly as stored, ct=invite included", () => {
    expect(inviteRedirectTarget(STORE_URL)).toBe(STORE_URL);
  });

  it("falls back to the waitlist site when the row is empty, not https, or not a URL", () => {
    expect(inviteRedirectTarget("")).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget(null)).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget("http://apps.apple.com/app/id6798837181")).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget("javascript:alert(1)")).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget("not a url")).toBe(WAITLIST_URL);
  });
});

describe("inviteResponse: every invite link ever sent lands on the store", () => {
  it("a live code is a 302 to the store, reported live", () => {
    const { status, headers } = inviteResponse(STORE_URL, "live");
    expect(status).toBe(302);
    expect(headers.Location).toBe(STORE_URL);
    expect(headers["X-Invite-Code"]).toBe("live");
  });

  it("a dead, mistyped or missing code is ALSO a 302 (a browser ignores Location on a 404)", () => {
    const { status, headers } = inviteResponse(STORE_URL, "unknown");
    expect(status).toBe(302);
    expect(headers.Location).toBe(STORE_URL);
    expect(headers["X-Invite-Code"]).toBe("unknown");
  });

  it("is never cached and never leaks the invite path as a referrer", () => {
    const { headers } = inviteResponse(STORE_URL, "live");
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });
});

describe("parseInviteCodeFromUrl: both published link shapes still parse", () => {
  it("path form and query form", () => {
    expect(parseInviteCodeFromUrl(`${BASE}/ABCDE12345`)).toBe("ABCDE12345");
    expect(parseInviteCodeFromUrl(`${BASE}?c=abcde12345`)).toBe("ABCDE12345");
  });

  it("no code is null (and still redirects, see inviteResponse)", () => {
    expect(parseInviteCodeFromUrl(BASE)).toBeNull();
  });
});
