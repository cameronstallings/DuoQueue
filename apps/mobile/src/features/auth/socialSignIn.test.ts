import { describe, expect, it } from "vitest";

import {
  APPLE_SIGN_IN_ENABLED,
  appleButtonStyleFor,
  appleSignInMessage,
  GOOGLE_SIGN_IN_ENABLED,
  isAppleCancellation,
} from "./socialSignIn";

class NativeError extends Error {
  code: string;
  constructor(message: string, code = "") {
    super(message);
    this.code = code;
  }
}

describe("the provider flags", () => {
  // Guideline 4.8 is triggered by a third-party login service, and Google Sign-In is one of the
  // ones Apple names. Sign in with Apple satisfies 4.8 on its own; Google without Apple is a
  // rejection. This is the assertion that fails loudly if somebody flips Google on alone.
  it("never has Google on without Apple", () => {
    if (GOOGLE_SIGN_IN_ENABLED) expect(APPLE_SIGN_IN_ENABLED).toBe(true);
  });

  it("is a compile-time answer, not a maybe", () => {
    // There is no EAS Update channel in this project, so both of these are baked into a build
    // and a submission. A truthy string or an undefined env read would render a button whose
    // state nobody could explain from the outside.
    expect(typeof APPLE_SIGN_IN_ENABLED).toBe("boolean");
    expect(typeof GOOGLE_SIGN_IN_ENABLED).toBe("boolean");
  });
});

describe("appleButtonStyleFor", () => {
  it("draws the white button on the dark theme, which is the default one", () => {
    // Volt's dark background is #0A0B09. A black button there is the thing Apple's design
    // guidelines say not to do, on the first screen a reviewer sees.
    expect(appleButtonStyleFor("dark")).toBe("WHITE");
  });

  it("draws the black button on the light theme", () => {
    expect(appleButtonStyleFor("light")).toBe("BLACK");
  });

  it("agrees with useTheme's palette for anything that is not exactly dark", () => {
    // useTheme picks darkColors only for `scheme === "dark"`, so every other value renders the
    // light palette, and the button has to be the one that reads on it.
    for (const scheme of [null, undefined, "unspecified", "Dark", ""]) {
      expect(appleButtonStyleFor(scheme)).toBe("BLACK");
    }
  });
});

describe("isAppleCancellation", () => {
  it("recognises the sheet being dismissed, however the error carries it", () => {
    expect(isAppleCancellation(new NativeError("The operation couldn't be completed. ERR_REQUEST_CANCELED"))).toBe(true);
    expect(isAppleCancellation(new NativeError("canceled", "ERR_REQUEST_CANCELED"))).toBe(true);
  });

  it("does not swallow a real failure", () => {
    expect(isAppleCancellation(new NativeError("Database error saving new user"))).toBe(false);
    expect(isAppleCancellation("ERR_REQUEST_CANCELED")).toBe(false);
    expect(isAppleCancellation(null)).toBe(false);
  });

  it("does not treat a network failure as a change of mind", () => {
    // The two are one tap apart on the same screen, and the difference is whether the user is
    // shown anything at all. Silently swallowing a failed sign-in is a button that does nothing.
    for (const err of [
      new NativeError("Network request failed"),
      new NativeError("Unable to exchange external code"),
      new NativeError("", "ERR_INVALID_RESPONSE"),
      undefined,
      {},
      { code: "ERR_REQUEST_CANCELED" },
    ]) {
      expect(isAppleCancellation(err)).toBe(false);
    }
  });
});

describe("appleSignInMessage", () => {
  it("replaces GoTrue's generic trigger failure with something a person can act on", () => {
    const shown = appleSignInMessage(new Error("Database error saving new user"));
    expect(shown).toContain("sign in with your email");
    expect(shown).not.toMatch(/database/i);
  });

  it("names the missing token case, since retrying is the actual fix", () => {
    expect(appleSignInMessage(new Error("No identity token returned from Apple."))).toMatch(/try again/i);
  });

  it("says one plain sentence for anything else, with no em dash", () => {
    for (const err of [new Error("Network request failed"), null, undefined, { message: "boom" }]) {
      const shown = appleSignInMessage(err);
      expect(shown).toMatch(/^[A-Z].*\.$/);
      expect(shown).not.toContain("—");
    }
  });

  it("never repeats what the provider said", () => {
    // sign-in.tsx used to render `err.message` verbatim, which is how "Database error saving new
    // user" reached users in the first place. Anything from GoTrue, PostgREST or the native
    // module is a string written for a log, not for the person holding the phone.
    const raw = [
      "AuthApiError: Invalid login credentials",
      "invalid_client: audience mismatch com.duoqueue.app",
      "permission denied for table profiles",
      "fetch failed: ECONNREFUSED 127.0.0.1:54321",
    ];
    for (const message of raw) {
      const shown = appleSignInMessage(new Error(message));
      expect(shown).not.toContain(message);
      expect(shown).toMatch(/^[A-Z].*\.$/);
    }
  });
});
