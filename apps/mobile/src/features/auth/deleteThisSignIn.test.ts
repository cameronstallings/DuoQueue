import { describe, expect, it } from "vitest";

import {
  accountDeletionFinalMessage,
  APPLE_DELETION_HEADS_UP,
  DELETE_THIS_SIGN_IN_LABEL,
  deleteThisSignInFailure,
  deleteThisSignInPrompt,
} from "./deleteThisSignIn";

class FunctionsLikeError extends Error {
  constructor(message: string, name: string) {
    super(message);
    this.name = name;
  }
}

describe("deleteThisSignInPrompt", () => {
  it("says the deletion is permanent before anything happens", () => {
    const prompt = deleteThisSignInPrompt(false);
    expect(prompt.title).toBe("Delete this sign-in?");
    expect(prompt.message).toMatch(/permanently/);
    expect(prompt.message).toMatch(/cannot be undone/);
    expect(prompt.confirm).toBe("Delete");
    expect(prompt.cancel).toBe("Keep going");
  });

  it("warns an Apple account that Apple's own sheet comes next", () => {
    // Without the warning, a system sheet appearing mid-deletion reads like an error and gets
    // dismissed, and the grant is then only revocable from the token stored at sign-in.
    expect(deleteThisSignInPrompt(true).message).toContain(APPLE_DELETION_HEADS_UP);
  });

  it("does not mention Apple to an email account", () => {
    expect(deleteThisSignInPrompt(false).message).not.toMatch(/Apple/);
  });
});

describe("accountDeletionFinalMessage", () => {
  it("is unchanged for an email account", () => {
    expect(accountDeletionFinalMessage(false)).toBe("Your account will be deleted immediately.");
  });

  it("adds the Apple heads-up for an Apple account", () => {
    expect(accountDeletionFinalMessage(true)).toBe(`Your account will be deleted immediately. ${APPLE_DELETION_HEADS_UP}`);
  });
});

describe("deleteThisSignInFailure", () => {
  it("shows delete-account's own refusal as it was written", () => {
    const banned =
      "This account has been banned and cannot be deleted. Contact support if you believe this is a mistake.";
    expect(deleteThisSignInFailure(new Error(banned))).toBe(banned);
  });

  it("never shows supabase-js's own function error text", () => {
    for (const err of [
      new FunctionsLikeError("Edge Function returned a non-2xx status code", "FunctionsHttpError"),
      new FunctionsLikeError("Failed to send a request to the Edge Function", "FunctionsFetchError"),
      new FunctionsLikeError("Relay Error invoking the Edge Function", "FunctionsRelayError"),
    ]) {
      expect(deleteThisSignInFailure(err)).toBe("We could not delete this sign-in. Please try again.");
    }
  });

  it("says one plain sentence for anything that is not an Error", () => {
    for (const err of [null, undefined, "boom", { message: "boom" }, new Error("   ")]) {
      expect(deleteThisSignInFailure(err)).toBe("We could not delete this sign-in. Please try again.");
    }
  });
});

describe("the copy", () => {
  it("has no em dash anywhere a user can read it", () => {
    const strings = [
      DELETE_THIS_SIGN_IN_LABEL,
      APPLE_DELETION_HEADS_UP,
      ...Object.values(deleteThisSignInPrompt(true)),
      ...Object.values(deleteThisSignInPrompt(false)),
      accountDeletionFinalMessage(true),
      deleteThisSignInFailure(null),
    ];
    for (const text of strings) {
      expect(text).not.toContain("—");
    }
  });
});
