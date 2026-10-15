import { describe, expect, it } from "vitest";

import {
  AUTH_COPY,
  authFailureOf,
  isNetworkFailure,
  resetRequestOutcome,
  signInMessage,
  signUpOutcome,
  updatePasswordOutcome,
  verifyRecoveryMessage,
} from "./authErrors";

/** The shape auth-js throws: an Error with code, status and name, and a message we never show. */
function authError(fields: { code?: string; status?: number; name?: string; message?: string }) {
  const err = new Error(fields.message ?? "raw server text that must never reach the screen") as Error & {
    code?: string;
    status?: number;
  };
  if (fields.name) err.name = fields.name;
  if (fields.code !== undefined) err.code = fields.code;
  if (fields.status !== undefined) err.status = fields.status;
  return err;
}

const NETWORK = authError({ name: "AuthRetryableFetchError", status: 0, message: "Failed to fetch" });

function allMessages(): string[] {
  const out: string[] = [];
  const errs = [
    authError({ code: "user_already_exists", status: 422, message: "User already registered" }),
    authError({ code: "weak_password", status: 422 }),
    authError({ code: "email_address_invalid", status: 400 }),
    authError({ code: "unexpected_failure", status: 500, message: "Database error saving new user" }),
    authError({ code: "otp_expired", status: 403, message: "Token has expired or is invalid" }),
    NETWORK,
    { message: "plain object" },
    "a string",
    null,
  ];
  for (const err of errs) {
    const up = signUpOutcome(err);
    if (up.kind === "message") out.push(up.message);
    const reset = resetRequestOutcome(err);
    if (reset) out.push(reset);
    out.push(verifyRecoveryMessage(err));
    const update = updatePasswordOutcome(err);
    if (update.kind === "message") out.push(update.message);
    out.push(signInMessage(err));
  }
  return out;
}

describe("authFailureOf", () => {
  it("reads code, status and name", () => {
    expect(authFailureOf(authError({ code: "weak_password", status: 422, name: "AuthWeakPasswordError" }))).toEqual({
      code: "weak_password",
      status: 422,
      name: "AuthWeakPasswordError",
    });
  });

  it("never carries the message", () => {
    expect(authFailureOf(authError({ code: "x", message: "secret" }))).not.toHaveProperty("message");
  });

  it("is empty for anything that is not an object", () => {
    expect(authFailureOf(null)).toEqual({});
    expect(authFailureOf("boom")).toEqual({});
    expect(authFailureOf(undefined)).toEqual({});
  });

  it("drops fields of the wrong type", () => {
    expect(authFailureOf({ code: 5, status: "422", name: null })).toEqual({});
  });
});

describe("isNetworkFailure", () => {
  it("is the retryable fetch error, or status 0", () => {
    expect(isNetworkFailure({ name: "AuthRetryableFetchError" })).toBe(true);
    expect(isNetworkFailure({ status: 0 })).toBe(true);
    expect(isNetworkFailure({ status: 400 })).toBe(false);
    expect(isNetworkFailure({})).toBe(false);
  });
});

describe("signUpOutcome", () => {
  it.each(["user_already_exists", "email_exists"])("%s is an existing account, never a message", (code) => {
    expect(signUpOutcome(authError({ code, status: 422, message: "User already registered" }))).toEqual({
      kind: "existing-account",
    });
  });

  it("maps each code to its own line", () => {
    const cases: [Parameters<typeof authError>[0], string][] = [
      [{ code: "weak_password", status: 422 }, AUTH_COPY.weakPassword],
      [{ code: "email_address_invalid", status: 400 }, AUTH_COPY.invalidEmail],
      [{ code: "validation_failed", status: 400 }, AUTH_COPY.invalidEmail],
      [{ code: "over_email_send_rate_limit", status: 429 }, AUTH_COPY.rateLimited],
      [{ code: "over_request_rate_limit", status: 429 }, AUTH_COPY.rateLimited],
      [{ status: 429 }, AUTH_COPY.rateLimited],
      [{ code: "captcha_failed", status: 400 }, AUTH_COPY.captcha],
      [{ name: "AuthRetryableFetchError", status: 0 }, AUTH_COPY.network],
    ];
    for (const [fields, message] of cases) {
      expect(signUpOutcome(authError(fields))).toEqual({ kind: "message", message });
    }
  });

  it("says nothing more than 'could not create' for a 500, which must never reveal a ban", () => {
    expect(signUpOutcome(authError({ code: "unexpected_failure", status: 500, message: "banned email" }))).toEqual({
      kind: "message",
      message: AUTH_COPY.signUpFailed,
    });
  });

  it("falls back to the same line for anything unknown", () => {
    expect(signUpOutcome(new Error("weird"))).toEqual({ kind: "message", message: AUTH_COPY.signUpFailed });
    expect(signUpOutcome(null)).toEqual({ kind: "message", message: AUTH_COPY.signUpFailed });
  });
});

describe("resetRequestOutcome", () => {
  it("is null on success, so the neutral 'sent' copy shows", () => {
    expect(resetRequestOutcome(null)).toBeNull();
  });

  it("is null for errors that would say whether the account exists", () => {
    expect(resetRequestOutcome(authError({ code: "user_not_found", status: 404 }))).toBeNull();
    expect(resetRequestOutcome(authError({ code: "unexpected_failure", status: 500 }))).toBeNull();
    expect(resetRequestOutcome(new Error("anything"))).toBeNull();
  });

  it("speaks only for a rate limit, the network, a bad email or a failed check", () => {
    expect(resetRequestOutcome(authError({ code: "over_email_send_rate_limit", status: 429 }))).toBe(AUTH_COPY.rateLimited);
    expect(resetRequestOutcome(NETWORK)).toBe(AUTH_COPY.network);
    expect(resetRequestOutcome(authError({ code: "email_address_invalid", status: 400 }))).toBe(AUTH_COPY.invalidEmail);
    expect(resetRequestOutcome(authError({ code: "validation_failed", status: 400 }))).toBe(AUTH_COPY.invalidEmail);
    expect(resetRequestOutcome(authError({ code: "captcha_failed", status: 400 }))).toBe(AUTH_COPY.captcha);
  });
});

describe("verifyRecoveryMessage", () => {
  it("gives the code line for an expired or wrong code", () => {
    expect(verifyRecoveryMessage(authError({ code: "otp_expired", status: 403 }))).toBe(AUTH_COPY.codeFailed);
    expect(verifyRecoveryMessage(authError({ status: 403 }))).toBe(AUTH_COPY.codeFailed);
  });

  it("gives the rate limit, network and generic lines", () => {
    expect(verifyRecoveryMessage(authError({ code: "over_request_rate_limit", status: 429 }))).toBe(AUTH_COPY.rateLimited);
    expect(verifyRecoveryMessage(NETWORK)).toBe(AUTH_COPY.network);
    expect(verifyRecoveryMessage(authError({ code: "unexpected_failure", status: 500 }))).toBe(AUTH_COPY.generic);
  });
});

describe("updatePasswordOutcome", () => {
  it("names the same-password case so the screen can offer to keep it", () => {
    expect(updatePasswordOutcome(authError({ code: "same_password", status: 422 }))).toEqual({ kind: "same-password" });
  });

  it("gives the policy, network and generic lines", () => {
    expect(updatePasswordOutcome(authError({ code: "weak_password", status: 422 }))).toEqual({
      kind: "message",
      message: AUTH_COPY.weakPassword,
    });
    expect(updatePasswordOutcome(NETWORK)).toEqual({ kind: "message", message: AUTH_COPY.network });
    expect(updatePasswordOutcome(new Error("x"))).toEqual({ kind: "message", message: AUTH_COPY.generic });
  });
});

describe("signInMessage", () => {
  it("gives every credential failure the same line, so the form is no account oracle", () => {
    const codes = ["invalid_credentials", "email_not_confirmed", "user_not_found", "user_banned", "unexpected_failure"];
    for (const code of codes) {
      expect(signInMessage(authError({ code, status: 400 }))).toBe(AUTH_COPY.signInFailed);
    }
    expect(signInMessage(new Error("Invalid login credentials"))).toBe(AUTH_COPY.signInFailed);
  });

  it("tells an offline phone it is offline, which says nothing about any account", () => {
    expect(signInMessage(NETWORK)).toBe(AUTH_COPY.network);
  });
});

describe("no raw message ever reaches the screen", () => {
  it("never echoes what the server said", () => {
    const shown = allMessages();
    const values = Object.values(AUTH_COPY) as string[];
    for (const message of shown) {
      expect(values).toContain(message);
      expect(message).not.toMatch(/registered|raw server text|Database error|Token has expired|banned email/i);
    }
  });
});

describe("AUTH_COPY", () => {
  const strings = Object.values(AUTH_COPY) as string[];

  it("holds the plan's words", () => {
    expect(AUTH_COPY.signInFailed).toBe("That email and password didn't work.");
    expect(AUTH_COPY.codeFailed).toBe("That code didn't work. Check the newest email, or send a new code.");
    expect(AUTH_COPY.network).toBe("Can't reach DuoQueue. Check your connection and try again.");
  });

  it.each(strings)("%s has no em or en dash", (s) => {
    // By code point (U+2014, U+2013), so this file holds neither character itself.
    expect(s).not.toContain(String.fromCharCode(0x2014));
    expect(s).not.toContain(String.fromCharCode(0x2013));
  });

  it.each(strings)("%s avoids the banned word (say moments)", (s) => {
    // Built from two halves so this file never contains the word itself.
    expect(s).not.toMatch(new RegExp("\\bbea" + "ts?\\b", "i"));
  });

  it.each(strings)("%s never reads as a dating app", (s) => {
    expect(s).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
  });

  it.each(strings)("%s never mentions a confirmation code", (s) => {
    expect(s).not.toMatch(/confirmation code/i);
  });
});
