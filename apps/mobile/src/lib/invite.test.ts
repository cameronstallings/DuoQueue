import { describe, expect, it } from "vitest";

import {
  isInviteCodeShape as edgeIsInviteCodeShape,
  inviteRedirectTarget,
  normalizeInviteCode as edgeNormalizeInviteCode,
  parseInviteCodeFromUrl,
  WAITLIST_URL,
} from "../../../../supabase/functions/_shared/invite-link";

import {
  INVITE_CODE_LENGTH,
  INVITE_LINK_UNUSABLE,
  inviteErrorMessage,
  inviteRouteAction,
  inviteShareMessage,
  inviteUrl,
  inviterConfirmation,
  isInviteCodeShape,
  normalizeInviteCode,
  parseInviteCode,
  shouldRedeemInvite,
  type InviteRedemptionGateInput,
  type InviteRouteInput,
} from "./invite";

const CODE = "HKT98T1B9J";
const SUPABASE_URL = "https://oflexcazqfuvcikrewnb.supabase.co";

describe("normalizeInviteCode", () => {
  it("uppercases", () => {
    expect(normalizeInviteCode("hkt98t1b9j")).toBe(CODE);
  });

  it("strips separators people add when they retype a code", () => {
    expect(normalizeInviteCode(" hkt98-t1b9j ")).toBe(CODE);
    expect(normalizeInviteCode("HKT98 T1B9J")).toBe(CODE);
    expect(normalizeInviteCode("HKT98_T1B9J")).toBe(CODE);
  });

  it("maps the three characters the alphabet excludes but people type anyway", () => {
    // I, L and O cannot appear in a real code, so folding them onto 1, 1 and 0 can only
    // ever repair a misreading.
    expect(normalizeInviteCode("IL0")).toBe("110");
    expect(normalizeInviteCode("oO")).toBe("00");
  });

  it("leaves U alone, because there is no digit it obviously means", () => {
    expect(normalizeInviteCode("U")).toBe("U");
    expect(isInviteCodeShape(normalizeInviteCode("UUUUUUUUUU"))).toBe(false);
  });

  it("returns an empty string for nothing", () => {
    expect(normalizeInviteCode(null)).toBe("");
    expect(normalizeInviteCode(undefined)).toBe("");
    expect(normalizeInviteCode("")).toBe("");
  });
});

describe("isInviteCodeShape", () => {
  it("accepts exactly ten Crockford symbols", () => {
    expect(isInviteCodeShape(CODE)).toBe(true);
    expect(CODE).toHaveLength(INVITE_CODE_LENGTH);
  });

  it("rejects the wrong length", () => {
    expect(isInviteCodeShape("HKT98T1B9")).toBe(false);
    expect(isInviteCodeShape("HKT98T1B9JJ")).toBe(false);
    expect(isInviteCodeShape("")).toBe(false);
  });

  it("rejects symbols outside the alphabet", () => {
    expect(isInviteCodeShape("HKT98T1B9U")).toBe(false);
    expect(isInviteCodeShape("hkt98t1b9j")).toBe(false);
  });
});

describe("normalisation agrees across the three runtimes", () => {
  // Postgres holds the third copy (public.normalize_invite_code) and is checked against the
  // live database rather than from here. These two are the ones that can drift in a commit.
  const inputs = [
    "hkt98t1b9j",
    " HKT98-T1B9J ",
    "hkt98 t1b9j",
    "ILO",
    "abc",
    "",
    "0123456789",
    "not a code at all",
    "U-U-U",
    "HKT98T1B9J",
  ];

  it("produces identical output for every input", () => {
    for (const input of inputs) {
      expect(edgeNormalizeInviteCode(input), `input: ${JSON.stringify(input)}`).toBe(
        normalizeInviteCode(input),
      );
    }
  });

  it("agrees on what is code-shaped", () => {
    for (const input of inputs) {
      const normalized = normalizeInviteCode(input);
      expect(edgeIsInviteCodeShape(normalized), `input: ${JSON.stringify(input)}`).toBe(
        isInviteCodeShape(normalized),
      );
    }
  });
});

describe("parseInviteCode", () => {
  it("reads the deep link the app registers", () => {
    expect(parseInviteCode(`duoqueue://invite/${CODE}`)).toBe(CODE);
  });

  it("reads the shared https link", () => {
    expect(parseInviteCode(`${SUPABASE_URL}/functions/v1/invite/${CODE}`)).toBe(CODE);
  });

  it("reads the query form", () => {
    expect(parseInviteCode(`${SUPABASE_URL}/functions/v1/invite?c=${CODE}`)).toBe(CODE);
    expect(parseInviteCode(`${SUPABASE_URL}/functions/v1/invite?x=1&c=${CODE}#frag`)).toBe(CODE);
  });

  it("normalises what it finds, so a lowercased or hyphenated link still works", () => {
    expect(parseInviteCode("duoqueue://invite/hkt98-t1b9j")).toBe(CODE);
  });

  it("ignores a URL that is not an invite link", () => {
    expect(parseInviteCode("duoqueue://link-steam-result?result=success")).toBeNull();
    expect(parseInviteCode(`https://duoqueue.io/privacy?c=${CODE}`)).toBeNull();
  });

  it("ignores an invite link carrying something that is not a code", () => {
    expect(parseInviteCode("duoqueue://invite/")).toBeNull();
    expect(parseInviteCode("duoqueue://invite/short")).toBeNull();
    expect(parseInviteCode(`${SUPABASE_URL}/functions/v1/invite`)).toBeNull();
  });

  it("handles nothing", () => {
    expect(parseInviteCode(null)).toBeNull();
    expect(parseInviteCode(undefined)).toBeNull();
    expect(parseInviteCode("")).toBeNull();
  });

  it("agrees with the Edge Function's parser on the https shapes it also sees", () => {
    for (const url of [
      `${SUPABASE_URL}/functions/v1/invite/${CODE}`,
      `${SUPABASE_URL}/functions/v1/invite?c=hkt98-t1b9j`,
      `${SUPABASE_URL}/functions/v1/invite`,
      `${SUPABASE_URL}/functions/v1/invite/short`,
    ]) {
      expect(parseInviteCodeFromUrl(url), `url: ${url}`).toBe(parseInviteCode(url));
    }
  });
});

describe("inviteUrl", () => {
  it("builds the link from the project the app is pointed at", () => {
    expect(inviteUrl(CODE, SUPABASE_URL)).toBe(`${SUPABASE_URL}/functions/v1/invite/${CODE}`);
  });

  it("tolerates a trailing slash on the configured URL", () => {
    expect(inviteUrl(CODE, `${SUPABASE_URL}/`)).toBe(`${SUPABASE_URL}/functions/v1/invite/${CODE}`);
  });

  it("round-trips through the parser", () => {
    expect(parseInviteCode(inviteUrl(CODE, SUPABASE_URL))).toBe(CODE);
  });
});

describe("inviteShareMessage", () => {
  const message = inviteShareMessage(CODE, inviteUrl(CODE, SUPABASE_URL));

  it("carries the code on its own, because that is the part that survives the App Store", () => {
    expect(message).toContain(CODE);
    expect(parseInviteCode(message)).toBe(CODE);
  });

  it("says 18+ and says it is not dating", () => {
    expect(message).toContain("18+");
    expect(message).toContain("not dates");
  });

  it("never reads as a dating app", () => {
    // Guideline 2.3.6 rejected this app once. The one allowed occurrence of the substring
    // "date" is inside "not dates", which is the disclaimer itself.
    expect(message.replace(/not dates/g, "")).not.toMatch(
      /dating|singles|hookup|nearby|meet people|match with singles/i,
    );
  });

  it("uses no em dashes", () => {
    expect(message).not.toContain("—");
  });
});

describe("inviterConfirmation", () => {
  it("names the inviter and promises only what the arrival screen delivers", () => {
    expect(inviterConfirmation("Cameron")).toBe(
      "Cameron invited you. Finish signing up and they are the first player you see.",
    );
  });
});

describe("INVITE_LINK_UNUSABLE", () => {
  it("says the link changed nothing and why, without blaming anyone", () => {
    expect(INVITE_LINK_UNUSABLE).toBe(
      "That invite link didn't change anything here. Invite links are for new players.",
    );
  });

  it("follows the copy rules", () => {
    const enOrEmDash = String.fromCharCode(0x2013) + "|" + String.fromCharCode(0x2014);
    expect(INVITE_LINK_UNUSABLE).not.toMatch(new RegExp(enOrEmDash));
    expect(INVITE_LINK_UNUSABLE).not.toMatch(/beats/i);
    expect(INVITE_LINK_UNUSABLE).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
  });
});

describe("inviteRouteAction", () => {
  const base: InviteRouteInput = {
    codeValid: true,
    sessionStatus: "signed_in",
    profileStatus: "loaded",
    onboardingCompleted: true,
    redemption: "done",
  };

  it("sends a link with no code straight into the app, whatever the session is doing", () => {
    for (const sessionStatus of ["loading", "signed_out", "signed_in"] as const) {
      expect(inviteRouteAction({ ...base, codeValid: false, sessionStatus })).toBe("home");
    }
  });

  it("holds a tap that arrived before the session resolved", () => {
    expect(inviteRouteAction({ ...base, sessionStatus: "loading" })).toBe("wait");
  });

  it("sends a signed-out visitor to the front door, code stored", () => {
    expect(inviteRouteAction({ ...base, sessionStatus: "signed_out" })).toBe("sign-in");
  });

  it("holds while the profile row is still in flight", () => {
    for (const profileStatus of ["unknown", "error"] as const) {
      expect(inviteRouteAction({ ...base, profileStatus, onboardingCompleted: undefined })).toBe("wait");
    }
  });

  it("sends a signed-in session with no profile row to the age gate at /", () => {
    // The bug this closes: `onboardingCompleted` is undefined for a MISSING profile too, and
    // it never becomes defined, because the thing that would define it is the age gate this
    // screen was standing in front of. A deep link tapped by a half-finished Apple signup
    // rendered the held Logo frame with no back gesture and no timer that could ever change
    // the answer -- force-quit was the only way out.
    expect(inviteRouteAction({ ...base, profileStatus: "missing", onboardingCompleted: undefined })).toBe("home");
  });

  it("routes on the profile STATUS, not on a stale onboarding flag", () => {
    // "missing" is authoritative and outranks anything still held in memory, in both
    // directions -- otherwise a signed-out-and-back-in-as-somebody-else session routes on the
    // previous account's answer for a frame.
    expect(inviteRouteAction({ ...base, profileStatus: "missing", onboardingCompleted: true })).toBe("home");
    expect(inviteRouteAction({ ...base, profileStatus: "missing", onboardingCompleted: false })).toBe("home");
  });

  it("still holds a link that arrived before the session resolved, whatever the profile says", () => {
    // Session first. A profileStatus left over from the account that just signed out says
    // nothing about the one signing in, so it must not be able to answer ahead of the session.
    expect(inviteRouteAction({ ...base, sessionStatus: "loading", profileStatus: "missing" })).toBe("wait");
    expect(inviteRouteAction({ ...base, sessionStatus: "signed_out", profileStatus: "missing" })).toBe("sign-in");
  });

  it("leaves somebody mid-wizard in the wizard", () => {
    expect(inviteRouteAction({ ...base, onboardingCompleted: false })).toBe("onboarding");
  });

  it("holds until redemption has answered", () => {
    expect(inviteRouteAction({ ...base, redemption: "idle" })).toBe("wait");
    expect(inviteRouteAction({ ...base, redemption: "pending" })).toBe("wait");
  });

  it("shows the arrival once there is an inviter to show", () => {
    expect(inviteRouteAction({ ...base, redemption: "done" })).toBe("arrival");
  });

  it("does not strand anyone on a failed redemption", () => {
    expect(inviteRouteAction({ ...base, redemption: "failed" })).toBe("home");
  });
});

describe("shouldRedeemInvite", () => {
  const ready: InviteRedemptionGateInput = {
    sessionStatus: "signed_in",
    profileStatus: "loaded",
    pendingCode: "ABCDE12345",
    redemption: "idle",
  };

  it("redeems as soon as there is a profile to attach the attribution to", () => {
    expect(shouldRedeemInvite(ready)).toBe(true);
  });

  it("does not fire for a session that has no profile row yet", () => {
    // THE REGRESSION THIS FILE EXISTS TO STOP. An Apple session arrives before the age gate,
    // `redeem_invite_code` reads profiles.created_at for its 14 day window, finds nothing, and
    // raises invite_window_closed. The hook reads any failure as settled and deletes the code
    // from AsyncStorage, so the invite is gone before the account it belongs to exists.
    expect(shouldRedeemInvite({ ...ready, profileStatus: "missing" })).toBe(false);
  });

  it("waits rather than guessing while the profile read is unresolved", () => {
    // "error" is a read that failed, not an answer. The store retries it on a timer; spending
    // the code on a guess is not retryable at all.
    for (const profileStatus of ["unknown", "error"] as const) {
      expect(shouldRedeemInvite({ ...ready, profileStatus })).toBe(false);
    }
  });

  it("needs a session, whatever a stale profile status says", () => {
    for (const sessionStatus of ["loading", "signed_out"] as const) {
      expect(shouldRedeemInvite({ ...ready, sessionStatus })).toBe(false);
    }
  });

  it("does nothing for an install that did not arrive from a link", () => {
    expect(shouldRedeemInvite({ ...ready, pendingCode: null })).toBe(false);
    expect(shouldRedeemInvite({ ...ready, pendingCode: "" })).toBe(false);
  });

  it("attempts a code exactly once", () => {
    // The effect re-runs on every store change, and profileStatus now changes under it more
    // often than status ever did. Only "idle" may start a call.
    for (const redemption of ["pending", "done", "failed"] as const) {
      expect(shouldRedeemInvite({ ...ready, redemption })).toBe(false);
    }
  });
});

describe("inviteRedirectTarget", () => {
  it("points at the waitlist before there is an App Store listing", () => {
    expect(inviteRedirectTarget("")).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget("   ")).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget(null)).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget(undefined)).toBe(WAITLIST_URL);
  });

  it("points at the App Store once the config row is set", () => {
    expect(inviteRedirectTarget("https://apps.apple.com/us/app/duoqueue/id123")).toBe(
      "https://apps.apple.com/us/app/duoqueue/id123",
    );
  });

  it("refuses anything that is not https, because that row is edited by hand", () => {
    expect(inviteRedirectTarget("javascript:alert(1)")).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget("http://example.com")).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget("duoqueue://invite/HKT98T1B9J")).toBe(WAITLIST_URL);
    expect(inviteRedirectTarget("not a url")).toBe(WAITLIST_URL);
  });
});

describe("inviteErrorMessage", () => {
  // The real object: PostgrestError extends Error, so `err instanceof Error` is true and
  // `err.message` is the bare token Postgres raised. That is what made the alert on the
  // arrival screen read "Something went wrong / inviter_unavailable".
  class PostgrestErrorLike extends Error {
    hint: string;
    code: string;
    constructor(message: string, hint = "", code = "P0001") {
      super(message);
      this.hint = hint;
      this.code = code;
    }
  }

  it("never lets a raised token reach a user", () => {
    for (const token of ["inviter_unavailable", "no_invite", "account_banned"]) {
      const shown = inviteErrorMessage(new PostgrestErrorLike(token));
      expect(shown).not.toContain("_");
      expect(shown).not.toBe(token);
      expect(shown).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("says what actually happened for each thing accept_invite can raise", () => {
    expect(inviteErrorMessage(new PostgrestErrorLike("inviter_unavailable"))).toBe(
      "That player is not available right now.",
    );
    expect(inviteErrorMessage(new PostgrestErrorLike("no_invite"))).toBe(
      "There is no invite on this account.",
    );
    expect(inviteErrorMessage(new PostgrestErrorLike("account_banned"))).toBe(
      "This account cannot do that right now.",
    );
  });

  it("does not echo a hint it did not write", () => {
    // Observed over the wire from PostgREST during the anon grant check. Showing `.hint`
    // blindly would have put a schema name and a GRANT statement in an alert.
    const leaky = new PostgrestErrorLike(
      "permission denied for table invite_codes",
      "Grant the required privileges to the current role with: GRANT SELECT ON public.invite_codes TO anon;",
      "42501",
    );
    const shown = inviteErrorMessage(leaky);
    expect(shown).toBe("Please try again.");
    expect(shown).not.toMatch(/GRANT|public\.|anon/i);
  });

  it("degrades to one plain sentence for anything unexpected", () => {
    expect(inviteErrorMessage(new Error("Network request failed"))).toBe("Please try again.");
    expect(inviteErrorMessage("inviter_unavailable")).toBe("Please try again.");
    expect(inviteErrorMessage(null)).toBe("Please try again.");
    expect(inviteErrorMessage(undefined)).toBe("Please try again.");
    expect(inviteErrorMessage({ message: "no_invite" })).toBe("Please try again.");
  });

  it("reads as platonic and carries no em dash, like the rest of the copy", () => {
    for (const token of ["inviter_unavailable", "no_invite", "account_banned", "anything-else"]) {
      const shown = inviteErrorMessage(new PostgrestErrorLike(token));
      expect(shown).not.toMatch(/date|dating|singles|hookup|match with|meet people/i);
      expect(shown).not.toContain("—");
    }
  });
});
