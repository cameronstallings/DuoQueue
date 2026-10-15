import { describe, expect, it } from "vitest";

import { describePasswordProblem, PASSWORD_MIN_LENGTH, passwordsMatchProblem } from "./passwordPolicy";

describe("describePasswordProblem", () => {
  it("mirrors the hosted policy's floor of 10", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
  });

  it("refuses 9 characters with the length line", () => {
    expect(describePasswordProblem("Abcdefgh1")).toBe("Password must be at least 10 characters.");
  });

  it.each(["abcdefghi1", "ABCDEFGHI1", "Abcdefghij"])(
    "refuses %s (10 characters missing an uppercase, a lowercase or a digit) with the combined line",
    (password) => {
      expect(describePasswordProblem(password)).toBe(
        "Password must include a lowercase letter, an uppercase letter, and a number.",
      );
    },
  );

  it("accepts a password that meets every rule", () => {
    expect(describePasswordProblem("Abcdefghi1")).toBeNull();
  });
});

describe("passwordsMatchProblem", () => {
  it("says so when the two differ", () => {
    expect(passwordsMatchProblem("Abcdefghi1", "Abcdefghi2")).toBe("Passwords don't match.");
  });

  it("is null when they match", () => {
    expect(passwordsMatchProblem("Abcdefghi1", "Abcdefghi1")).toBeNull();
  });
});
