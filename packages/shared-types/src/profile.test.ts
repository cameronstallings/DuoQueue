import { describe, expect, it, vi } from "vitest";

import { dobSchema, meetsMinAge, MIN_AGE } from "./profile";

/**
 * The pre-authentication age gate. `dobSchema` is what the email sign-up path is gated on, and
 * `meetsMinAge` is the whole of its second refinement.
 *
 * WHY AN INJECTED `now` RATHER THAN FAKE TIMERS, mostly. `meetsMinAge(dob, now)` takes the day
 * as an argument, exactly the way `checkDob(iso, minAge, now)` does on the post-authentication
 * path, so every case below can name the date it is about (29 February included) while the
 * function under test stays pure: no global clock is moved, nothing leaks into a neighbouring
 * test, and a failure reads as arithmetic rather than as a timer somebody forgot to restore.
 * Fake timers appear only where the thing being tested IS the default argument, which is the
 * path zod takes: `dobSchema` calls `meetsMinAge(val)` with one argument and no way to pass a
 * second.
 *
 * The floor is written as 18 below rather than as MIN_AGE, so the cases read as an 18+ gate
 * instead of as arithmetic about a variable that could quietly move. This first test is the line
 * that stops that from becoming a lie.
 */
it("is an 18+ gate", () => {
  expect(MIN_AGE).toBe(18);
});

describe("meetsMinAge", () => {
  describe("on an ordinary day", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");

    it("accepts somebody whose eighteenth birthday is today", () => {
      // The cutoff is inclusive, because Postgres's is:
      // `v_parsed_dob > (current_date - interval '18 years')::date` refuses only what is later.
      expect(meetsMinAge("2008-09-02", now)).toBe(true);
    });

    it("refuses somebody whose eighteenth birthday is tomorrow", () => {
      expect(meetsMinAge("2008-09-03", now)).toBe(false);
    });

    it("accepts the day before the boundary and refuses the day after", () => {
      expect(meetsMinAge("2008-09-01", now)).toBe(true);
      expect(meetsMinAge("2008-09-04", now)).toBe(false);
    });

    it("accepts an adult and refuses a child", () => {
      expect(meetsMinAge("1994-03-03", now)).toBe(true);
      expect(meetsMinAge("2015-06-01", now)).toBe(false);
    });

    it("refuses a date in the future", () => {
      expect(meetsMinAge("2026-09-03", now)).toBe(false);
      expect(meetsMinAge("2199-01-01", now)).toBe(false);
    });
  });

  describe("across a year boundary", () => {
    // The month and day half of the comparison has to survive being packed alongside the year in
    // both directions: 1231 is the largest it gets, 0101 the smallest.
    it("holds on 1 January", () => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      expect(meetsMinAge("2008-01-01", now)).toBe(true);
      expect(meetsMinAge("2008-01-02", now)).toBe(false);
      expect(meetsMinAge("2007-12-31", now)).toBe(true);
    });

    it("holds on 31 December", () => {
      const now = new Date("2025-12-31T23:00:00.000Z");
      expect(meetsMinAge("2007-12-31", now)).toBe(true);
      expect(meetsMinAge("2008-01-01", now)).toBe(false);
    });
  });

  describe("on 29 February", () => {
    // THE BUG THIS FILE EXISTS FOR. The old implementation copied `now` and called
    // `setUTCFullYear(year - 18)` on it. 29 February has no counterpart in a non-leap year, so
    // JS rolled the cutoff forward to 2010-03-01, and somebody born 2010-03-01, who is seventeen
    // years and 364 days old that day, was told they were eighteen. Postgres clamps the other
    // way (`date '2028-02-29' - interval '18 years'` is 2010-02-28) and refused them, so the 18+
    // floor itself never opened. The two client gates just disagreed by a day.
    const leapDay = new Date("2028-02-29T12:00:00.000Z");

    it("refuses somebody one day short of eighteen", () => {
      expect(meetsMinAge("2010-03-01", leapDay)).toBe(false);
    });

    it("accepts somebody who is exactly eighteen", () => {
      expect(meetsMinAge("2010-02-28", leapDay)).toBe(true);
    });

    it("lets the same person through the very next day", () => {
      expect(meetsMinAge("2010-03-01", new Date("2028-03-01T12:00:00.000Z"))).toBe(true);
    });

    it("refuses 29 February eighteen years earlier, which is not a day that exists", () => {
      // 2010 is not a leap year, so this is not a birthdate anybody has. Worth pinning because
      // the packed cutoff on this run is literally 20100229: a bound may name a day that does
      // not exist, and that must still not make it a date the gate accepts as real.
      expect(meetsMinAge("2010-02-29", leapDay)).toBe(false);
    });

    it("gives a leap-day baby their eighteenth on 1 March in a non-leap year", () => {
      // Which is what Postgres says too: 2008-02-29 is later than
      // `date '2026-02-28' - interval '18 years'` (2008-02-28), and not later than 2008-03-01.
      expect(meetsMinAge("2008-02-29", new Date("2026-02-28T12:00:00.000Z"))).toBe(false);
      expect(meetsMinAge("2008-02-29", new Date("2026-03-01T12:00:00.000Z"))).toBe(true);
    });

    it("still accepts a leap-day birthdate in a year that has one", () => {
      expect(meetsMinAge("2008-02-29", leapDay)).toBe(true);
    });
  });

  it("answers on the calendar date, not on the time of day", () => {
    // Postgres compares against current_date, which has no clock in it. Two calls a second apart
    // either side of midnight UTC would otherwise disagree with the server for a whole hour.
    for (const t of ["T00:00:00.000Z", "T12:00:00.000Z", "T23:59:59.999Z"]) {
      expect(meetsMinAge("2008-09-02", new Date(`2026-09-02${t}`))).toBe(true);
      expect(meetsMinAge("2008-09-03", new Date(`2026-09-02${t}`))).toBe(false);
    }
  });

  describe("refuses anything that is not a calendar date", () => {
    const now = new Date("2026-09-02T12:00:00.000Z");

    it("refuses a shape that is not YYYY-MM-DD", () => {
      // `profiles.dob` is a Postgres `date`. A birthdate carrying a clock or a timezone is a
      // timestamp somebody guessed at, and guessing is what puts a day on the wrong side of a
      // boundary.
      const bad = ["", "03/03/1994", "1994-3-3", "19940303", " 1994-03-03", "1994-03-03 ", "not-a-date"];
      for (const value of bad) {
        expect(meetsMinAge(value, now)).toBe(false);
      }
      expect(meetsMinAge("1994-03-03T00:00:00Z", now)).toBe(false);
    });

    it("refuses a day that does not exist", () => {
      // JS rolls 2025-02-31 forward to 3 March rather than refusing it, which is why the
      // implementation round-trips the string instead of trusting the parse.
      const bad = ["2025-02-31", "2025-13-01", "2025-00-10", "2025-04-31", "0000-00-00", "2009-02-29"];
      for (const value of bad) {
        expect(meetsMinAge(value, now)).toBe(false);
      }
    });
  });

  it("reads the clock when it is not handed one", () => {
    // zod calls it with one argument, so nothing else would notice a broken default.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2028-02-29T12:00:00.000Z"));
    try {
      expect(meetsMinAge("2010-03-01")).toBe(false);
      expect(meetsMinAge("2010-02-28")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("dobSchema", () => {
  it("carries the leap-day fix through to the schema the sign-up path is gated on", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2028-02-29T12:00:00.000Z"));
    try {
      expect(dobSchema.safeParse("2010-03-01").success).toBe(false);
      expect(dobSchema.safeParse("2010-02-28").success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says which of the two things is wrong", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    try {
      // A real date that is too recent gets the age sentence; something that is not a date at
      // all gets the other one. The same two sentences dobProblemMessage shows post-auth.
      const underAge = dobSchema.safeParse("2008-09-03");
      expect(underAge.success).toBe(false);
      expect(underAge.error?.issues[0]?.message).toBe("You must be 18 or older to use DuoQueue.");

      const invalid = dobSchema.safeParse("03/03/1994");
      expect(invalid.success).toBe(false);
      expect(invalid.error?.issues[0]?.message).toBe("Enter a valid date.");
    } finally {
      vi.useRealTimers();
    }
  });

  it("names the floor, and neither sentence carries an em dash", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T12:00:00.000Z"));
    try {
      for (const value of ["2008-09-03", "03/03/1994"]) {
        const message = dobSchema.safeParse(value).error?.issues[0]?.message ?? "";
        expect(message).toMatch(/^[A-Z].*\.$/);
        expect(message).not.toContain("—");
      }
      expect(dobSchema.safeParse("2008-09-03").error?.issues[0]?.message).toContain("18");
    } finally {
      vi.useRealTimers();
    }
  });
});
