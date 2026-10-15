import { describe, expect, it, vi } from "vitest";
import { dobSchema, MIN_AGE as SHARED_MIN_AGE } from "@duoqueue/shared-types";

import {
  checkDob,
  COMPLETE_SIGNUP_RAISES,
  completeSignupOutcome,
  dobProblemMessage,
  fromIsoDate,
  toIsoDate,
} from "./completeSignup";

const MIN_AGE = 18;

// The tests hard-code the floor so they read as an 18+ gate rather than as arithmetic about a
// variable. This is the line that stops that from becoming a lie if the app's floor ever moves.
it("uses the app's own minimum age", () => {
  expect(MIN_AGE).toBe(SHARED_MIN_AGE);
});

// The real object: PostgrestError extends Error, so `err instanceof Error` holds and
// `err.message` is the sentence Postgres raised.
class PostgrestErrorLike extends Error {
  hint: string;
  code: string;
  constructor(message: string, hint = "", code = "P0001") {
    super(message);
    this.hint = hint;
    this.code = code;
  }
}

describe("toIsoDate", () => {
  it("keeps the calendar date the picker was showing", () => {
    // Local midnight on the 3rd. toISOString() would have made this the 2nd anywhere east of
    // UTC, which is how a birthdate could arrive a day early and a user read a day older.
    expect(toIsoDate(new Date(1994, 2, 3, 0, 0, 0))).toBe("1994-03-03");
    expect(toIsoDate(new Date(1994, 2, 3, 23, 59, 59))).toBe("1994-03-03");
  });

  it("pads to the shape Postgres accepts as a date", () => {
    expect(toIsoDate(new Date(2001, 0, 9))).toBe("2001-01-09");
    expect(toIsoDate(new Date(2001, 11, 31))).toBe("2001-12-31");
  });

  it("does not slide across a year boundary at either end of the day", () => {
    // The same hazard as the day boundary, one size up: 31 December at 23:00 in Tokyo is
    // 1 January in UTC, and a birth year is the one field an age gate is entirely made of.
    expect(toIsoDate(new Date(2000, 11, 31, 23, 0, 0))).toBe("2000-12-31");
    expect(toIsoDate(new Date(2001, 0, 1, 0, 30, 0))).toBe("2001-01-01");
  });

  it("hands checkDob something it accepts", () => {
    // The two are always used together: the picker's Date goes through toIsoDate and straight
    // into checkDob, so a shape disagreement between them would refuse every real birthdate.
    expect(checkDob(toIsoDate(new Date(1994, 2, 3)), MIN_AGE)).toBeNull();
  });
});

describe("fromIsoDate", () => {
  it("gives a Date at LOCAL midnight with the same year, month and day", () => {
    const date = fromIsoDate("1994-03-03");
    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(1994);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(3);
    expect(date?.getHours()).toBe(0);
    expect(date?.getMinutes()).toBe(0);
  });

  it("round-trips with toIsoDate, across year ends and Feb 29", () => {
    for (const iso of ["1994-03-03", "2000-12-31", "2001-01-01", "2004-02-29", "1970-01-01"]) {
      const date = fromIsoDate(iso);
      expect(date && toIsoDate(date)).toBe(iso);
    }
  });

  it("gives null for anything that is not a real calendar date", () => {
    for (const garbage of ["", "1994-3-3", "1994-02-30", "2001-02-29", "yesterday", "1994-13-01", "1994-03-03T00:00"]) {
      expect(fromIsoDate(garbage)).toBeNull();
    }
    expect(fromIsoDate(null)).toBeNull();
    expect(fromIsoDate(undefined)).toBeNull();
  });
});

describe("checkDob", () => {
  const now = new Date("2026-09-02T12:00:00.000Z");

  it("accepts an adult", () => {
    expect(checkDob("1994-03-03", MIN_AGE, now)).toBeNull();
  });

  it("accepts somebody whose birthday is today", () => {
    expect(checkDob("2008-09-02", MIN_AGE, now)).toBeNull();
  });

  it("refuses somebody whose birthday is tomorrow", () => {
    expect(checkDob("2008-09-03", MIN_AGE, now)).toBe("under-age");
  });

  it("refuses somebody who is obviously too young", () => {
    expect(checkDob("2015-06-01", MIN_AGE, now)).toBe("under-age");
    expect(checkDob("2026-01-01", MIN_AGE, now)).toBe("under-age");
    // Born this morning. The one input the picker cannot produce and an RPC can.
    expect(checkDob("2026-09-02", MIN_AGE, now)).toBe("under-age");
  });

  it("refuses a date in the future", () => {
    // Refused by the same branch and with the same sentence as any other under-age date, which
    // is also what the server does: `v_parsed_dob > (current_date - interval '18 years')` is
    // true for the year 2199 exactly as it is true for last week.
    expect(checkDob("2027-01-01", MIN_AGE, now)).toBe("under-age");
    expect(checkDob("2199-01-01", MIN_AGE, now)).toBe("under-age");
    expect(checkDob("9999-12-31", MIN_AGE, now)).toBe("under-age");
  });

  it("does not care how long ago the past was", () => {
    // Nothing here is an age gate's business below the floor, and a four-digit year that
    // Postgres accepts as a date must not throw on the way to being accepted.
    expect(checkDob("1900-01-01", MIN_AGE, now)).toBeNull();
    expect(checkDob("0001-01-01", MIN_AGE, now)).toBeNull();
  });

  it("refuses anything that is not a date", () => {
    expect(checkDob("", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("03/03/1994", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("1994-03-03T00:00:00Z", MIN_AGE, now)).toBe("invalid");
  });

  it("refuses a date that is nearly the right shape", () => {
    // All of these are things a hand-written RPC call or a future caller could send, and all of
    // them would reach Postgres as something its ::date cast either rejects or silently reads
    // differently. The shape check is the reason complete_signup only ever sees one format.
    expect(checkDob("1994-3-3", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("19940303", MIN_AGE, now)).toBe("invalid");
    expect(checkDob(" 1994-03-03", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("1994-03-03 ", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("not-a-date", MIN_AGE, now)).toBe("invalid");
  });

  it("refuses a date that looks right and does not exist", () => {
    // JS rolls this forward to March 3 rather than rejecting it.
    expect(checkDob("2025-02-31", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("2025-13-01", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("2025-00-10", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("2025-04-31", MIN_AGE, now)).toBe("invalid");
    expect(checkDob("0000-00-00", MIN_AGE, now)).toBe("invalid");
  });

  it("accepts a leap day as a birthdate", () => {
    expect(checkDob("2008-02-29", MIN_AGE, now)).toBeNull();
    expect(checkDob("2009-02-29", MIN_AGE, now)).toBe("invalid");
  });

  it("does not let anybody through on a leap day", () => {
    // The bug this replaced: shifting `now` back eighteen years with setUTCFullYear has nowhere
    // to land on 29 February, so JS rolled the cutoff forward to 1 March and somebody one day
    // short of eighteen passed. Postgres clamps the other way -- `date '2028-02-29' - interval
    // '18 years'` is 2010-02-28 -- so the server refused what the screen had just accepted.
    const leapDay = new Date("2028-02-29T12:00:00.000Z");
    expect(checkDob("2010-03-01", MIN_AGE, leapDay)).toBe("under-age");
    expect(checkDob("2010-02-28", MIN_AGE, leapDay)).toBeNull();
    // And the day after, the same person is eighteen.
    expect(checkDob("2010-03-01", MIN_AGE, new Date("2028-03-01T12:00:00.000Z"))).toBeNull();
  });

  it("answers on the calendar date, not on the time of day", () => {
    // Postgres compares against current_date, which has no clock in it. Two calls a second
    // apart either side of midnight UTC would otherwise disagree with the server for an hour.
    for (const t of ["T00:00:00.000Z", "T12:00:00.000Z", "T23:59:59.999Z"]) {
      expect(checkDob("2008-09-02", MIN_AGE, new Date(`2026-09-02${t}`))).toBeNull();
      expect(checkDob("2008-09-03", MIN_AGE, new Date(`2026-09-02${t}`))).toBe("under-age");
    }
  });

  it("reads the clock when it is not handed one", () => {
    // The screen calls it with two arguments. Nothing else would notice a broken default.
    expect(checkDob("1990-01-01", MIN_AGE)).toBeNull();
    expect(checkDob(toIsoDate(new Date()), MIN_AGE)).toBe("under-age");
  });

  it("agrees with the schema the email path is gated on", () => {
    // Two client-side gates now ask the same question: dobSchema before sign-up, checkDob after
    // authentication. A user who is refused on one path and accepted on the other would be a
    // bug report nobody could reproduce, because it depends on which button they tapped.
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      for (const iso of ["1994-03-03", "2008-09-02", "2008-09-03", "2015-06-01", "2199-01-01"]) {
        expect(checkDob(iso, MIN_AGE) === null).toBe(dobSchema.safeParse(iso).success);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("dobProblemMessage", () => {
  it("says what to do, and carries no em dash", () => {
    for (const problem of ["invalid", "under-age"] as const) {
      const shown = dobProblemMessage(problem, MIN_AGE);
      expect(shown).toMatch(/^[A-Z].*\.$/);
      expect(shown).not.toContain("—");
    }
  });

  it("names the floor rather than leaving somebody to guess it", () => {
    expect(dobProblemMessage("under-age", MIN_AGE)).toContain(String(MIN_AGE));
  });

  it("says two different things for the two different problems", () => {
    expect(dobProblemMessage("invalid", MIN_AGE)).not.toBe(dobProblemMessage("under-age", MIN_AGE));
  });
});

describe("COMPLETE_SIGNUP_RAISES", () => {
  it("is pinned to the sentences 0067 actually raises", () => {
    // These are copied from supabase/migrations/0067_post_auth_age_gate.sql. A `raise exception`
    // reaches the client as nothing but its message text, so the sentence IS the protocol: if
    // the migration is reworded and this is not, every mapping below silently becomes "unknown"
    // and a banned account gets "Something went wrong. Please try again." forever.
    expect(COMPLETE_SIGNUP_RAISES).toEqual({
      invalidDob: "A valid date of birth is required to create an account",
      underAge: "You must be at least 18 to create an account",
      banned: "This account has been banned and cannot be re-created.",
      alreadyComplete: "This account already has a profile",
    });
  });

  it("cannot have one raise match another's rule", () => {
    // The mapping is a chain of `includes`, so a sentence that contains another sentence would
    // be decided by the order of the ifs rather than by what happened.
    const raises = Object.values(COMPLETE_SIGNUP_RAISES);
    for (const a of raises) {
      for (const b of raises) {
        if (a !== b) expect(a.includes(b)).toBe(false);
      }
    }
  });
});

describe("completeSignupOutcome", () => {
  it("treats an already-completed account as a success to carry on from", () => {
    const outcome = completeSignupOutcome(new PostgrestErrorLike(COMPLETE_SIGNUP_RAISES.alreadyComplete), MIN_AGE);
    expect(outcome).toEqual({ kind: "already-complete" });
  });

  it("marks a banned account as the one outcome with nowhere to go", () => {
    const outcome = completeSignupOutcome(new PostgrestErrorLike(COMPLETE_SIGNUP_RAISES.banned), MIN_AGE);
    expect(outcome.kind).toBe("banned");
  });

  it("keeps a refused date on the screen so it can be corrected", () => {
    expect(completeSignupOutcome(new PostgrestErrorLike(COMPLETE_SIGNUP_RAISES.underAge), MIN_AGE)).toEqual({
      kind: "rejected",
      message: dobProblemMessage("under-age", MIN_AGE),
    });
    expect(completeSignupOutcome(new PostgrestErrorLike(COMPLETE_SIGNUP_RAISES.invalidDob), MIN_AGE)).toEqual({
      kind: "rejected",
      message: dobProblemMessage("invalid", MIN_AGE),
    });
  });

  it("maps every pinned raise to something other than the fallback", () => {
    // The four sentences are the entire vocabulary of the RPC. Any one of them landing in
    // "unknown" would be an outcome the screen handles by asking the user to try again, which
    // for a banned account or a rejected date is an instruction that can never work.
    for (const raised of Object.values(COMPLETE_SIGNUP_RAISES)) {
      expect(completeSignupOutcome(new PostgrestErrorLike(raised), MIN_AGE).kind).not.toBe("unknown");
    }
  });

  it("still recognises a raise that arrives decorated", () => {
    // PostgREST has prefixed and suffixed plpgsql messages in the past, which is the reason the
    // mapping is `includes` rather than equality.
    expect(
      completeSignupOutcome(new PostgrestErrorLike(`P0001: ${COMPLETE_SIGNUP_RAISES.banned}`), MIN_AGE).kind,
    ).toBe("banned");
    expect(
      completeSignupOutcome(new PostgrestErrorLike(`${COMPLETE_SIGNUP_RAISES.underAge}.`), MIN_AGE).kind,
    ).toBe("rejected");
  });

  it("does not match a sentence that has been reworded", () => {
    // Not pedantry: this is what makes the pinning test above load-bearing. A migration that
    // changes the case or the wording must be caught by a failing test, not absorbed quietly.
    expect(completeSignupOutcome(new PostgrestErrorLike("this account has been banned"), MIN_AGE).kind).toBe(
      "unknown",
    );
    expect(completeSignupOutcome(new PostgrestErrorLike("You must be at least 21 to create an account"), MIN_AGE).kind)
      .toBe("unknown");
  });

  it("reads a bare PostgREST object as well as an Error", () => {
    expect(completeSignupOutcome({ message: COMPLETE_SIGNUP_RAISES.banned }, MIN_AGE).kind).toBe("banned");
  });

  it("never echoes a message it did not write", () => {
    const leaky = new PostgrestErrorLike(
      "permission denied for function complete_signup",
      "Grant the required privileges to the current role with: GRANT EXECUTE ON FUNCTION public.complete_signup TO anon;",
      "42501",
    );
    const outcome = completeSignupOutcome(leaky, MIN_AGE);
    expect(outcome.kind).toBe("unknown");
    expect(outcome.kind === "unknown" && outcome.message).toBe("Something went wrong. Please try again.");
  });

  it("shows a person nothing a database wrote", () => {
    // Everything the RPC can fail with that is not one of its own four sentences. A raw
    // constraint name or a search_path is not an instruction anybody can act on, and half of
    // them name a table or a function that is not supposed to be public knowledge.
    const raw = [
      'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"',
      'new row for relation "profiles" violates check constraint "profile_must_be_18"',
      "date/time field value out of range: \"2026-02-30\"",
      "Not authenticated",
      "permission denied for schema auth",
      "JWT expired",
      "duplicate key value violates unique constraint \"profiles_pkey\"",
    ];
    for (const message of raw) {
      const outcome = completeSignupOutcome(new PostgrestErrorLike(message), MIN_AGE);
      expect(outcome.kind).toBe("unknown");
      expect(outcome.kind === "unknown" && outcome.message).toBe("Something went wrong. Please try again.");
    }
  });

  it("degrades to one plain sentence for anything unexpected", () => {
    for (const err of [new Error("Network request failed"), null, undefined, "banned", {}]) {
      expect(completeSignupOutcome(err, MIN_AGE)).toEqual({
        kind: "unknown",
        message: "Something went wrong. Please try again.",
      });
    }
  });

  it("survives an error whose message is not a string", () => {
    // Nothing guarantees the shape of what a rejected promise carries, and a screen that throws
    // while handling an error shows a red box instead of a sentence.
    for (const err of [{ message: 42 }, { message: null }, { message: { text: "banned" } }, new Error()]) {
      expect(completeSignupOutcome(err, MIN_AGE).kind).toBe("unknown");
    }
  });

  it("shows a sentence, not a raised token, and carries no em dash", () => {
    for (const raised of Object.values(COMPLETE_SIGNUP_RAISES)) {
      const outcome = completeSignupOutcome(new PostgrestErrorLike(raised), MIN_AGE);
      if (outcome.kind === "already-complete") continue;
      expect(outcome.message).toMatch(/^[A-Z].*\.$/);
      expect(outcome.message).not.toContain("—");
      expect(outcome.message).not.toBe(raised);
    }
  });

  it("does not tell a banned account that it was recognised as one", () => {
    // The server's own sentence names the ban. Repeating it confirms to somebody working
    // through identities which one is on the list.
    const outcome = completeSignupOutcome(new PostgrestErrorLike(COMPLETE_SIGNUP_RAISES.banned), MIN_AGE);
    expect(outcome.kind === "banned" && outcome.message).not.toMatch(/banned/i);
  });
});
