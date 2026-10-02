import { describe, expect, it } from "vitest";

import {
  INVITE_CLOSED_MESSAGE,
  INVITE_EXPIRED_MESSAGE,
  INVITE_FALLBACK_MESSAGE,
  PARTY_FULL_MESSAGE,
  TOO_MANY_TRIES_MESSAGE,
  joinNames,
  partyInviteErrorMessage,
} from "./partyCopy";

describe("joinNames", () => {
  it("reads like a sentence at every length", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Sam"])).toBe("Sam");
    expect(joinNames(["Sam", "Alex"])).toBe("Sam & Alex");
    expect(joinNames(["Sam", "Alex", "Jo"])).toBe("Sam, Alex & Jo");
    expect(joinNames(["Sam", "Alex", "Jo", "Kai"])).toBe("Sam, Alex, Jo & Kai");
  });
});

/** The plain object PostgREST hands back for a RAISE. */
function raise(message: string, hint: string | null = null, details: string | null = null) {
  return { code: "P0001", message, details, hint };
}

describe("partyInviteErrorMessage", () => {
  it("shows the server's own sentence when a RAISE carries one in its hint", () => {
    expect(partyInviteErrorMessage(raise("invite_expired", "This invite ran out after a week."))).toBe(
      "This invite ran out after a week.",
    );
  });

  it("recognises 0070's two refusals exactly as respond_party_invite raises them", () => {
    expect(
      partyInviteErrorMessage(raise("This party invite expired. Invites last 7 days.", null, "party_invite_expired")),
    ).toBe(INVITE_EXPIRED_MESSAGE);
    expect(
      partyInviteErrorMessage(raise("This party is already full. Parties hold 3 players.", null, "party_full")),
    ).toBe(PARTY_FULL_MESSAGE);
  });

  it("recognises them by their detail token alone, so a reworded message still reads right", () => {
    expect(partyInviteErrorMessage(raise("Cannot accept", null, "party_invite_expired"))).toBe(INVITE_EXPIRED_MESSAGE);
    expect(partyInviteErrorMessage(raise("Cannot accept", null, "party_full"))).toBe(PARTY_FULL_MESSAGE);
  });

  it("recognises an expired invite or a full party by what the message says", () => {
    expect(partyInviteErrorMessage(raise("This invite has expired"))).toBe(INVITE_EXPIRED_MESSAGE);
    expect(partyInviteErrorMessage(raise("party_full"))).toBe(PARTY_FULL_MESSAGE);
  });

  it("does not read 'full' inside another word", () => {
    expect(partyInviteErrorMessage(raise("Something failed successfully"))).toBe(INVITE_FALLBACK_MESSAGE);
  });

  it("says an answered or swept invite is closed", () => {
    expect(partyInviteErrorMessage(raise("No pending invite"))).toBe(INVITE_CLOSED_MESSAGE);
  });

  it("never shows the rate limit's machine token", () => {
    expect(partyInviteErrorMessage(raise("rate_limit_exceeded:respond_party_invite"))).toBe(TOO_MANY_TRIES_MESSAGE);
  });

  it("falls back for anything else, an Error or nothing at all", () => {
    expect(partyInviteErrorMessage(raise("account_banned"))).toBe(INVITE_FALLBACK_MESSAGE);
    expect(partyInviteErrorMessage(new TypeError("Network request failed"))).toBe(INVITE_FALLBACK_MESSAGE);
    expect(partyInviteErrorMessage(undefined)).toBe(INVITE_FALLBACK_MESSAGE);
    expect(partyInviteErrorMessage("boom")).toBe(INVITE_FALLBACK_MESSAGE);
    // A hint only counts on a RAISE; anything else might be Postgres internals.
    expect(partyInviteErrorMessage({ code: "42501", message: "permission denied", hint: "grant it" })).toBe(
      INVITE_FALLBACK_MESSAGE,
    );
  });

  it("writes every sentence without an em dash", () => {
    for (const sentence of [
      INVITE_EXPIRED_MESSAGE,
      PARTY_FULL_MESSAGE,
      INVITE_CLOSED_MESSAGE,
      TOO_MANY_TRIES_MESSAGE,
      INVITE_FALLBACK_MESSAGE,
    ]) {
      expect(sentence).not.toContain("—");
    }
  });
});
