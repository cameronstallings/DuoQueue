import { describe, expect, it } from "vitest";

import { displayNameSeed } from "./displayNameSeed";

const empty = { displayName: "", displayNameSeeded: false };

/**
 * The wizard's first step must show the name Apple already gave us instead of asking for it again
 * (Guideline 4.0), and must never overwrite anything the user typed. Those two sentences are the
 * whole spec.
 */
describe("displayNameSeed", () => {
  it("fills an empty field from the profile's name", () => {
    expect(displayNameSeed(empty, "Ada")).toEqual({ displayName: "Ada", displayNameSeeded: true });
  });

  it("treats a whitespace-only field as empty", () => {
    expect(displayNameSeed({ displayName: "   ", displayNameSeeded: false }, "Ada")).toEqual({
      displayName: "Ada",
      displayNameSeeded: true,
    });
  });

  it("never overwrites what the user typed", () => {
    expect(displayNameSeed({ displayName: "Nova", displayNameSeeded: false }, "Ada")).toEqual({
      displayNameSeeded: true,
    });
  });

  it("seeds only once per pass, so a deliberately cleared field stays cleared", () => {
    expect(displayNameSeed({ displayName: "", displayNameSeeded: true }, "Ada")).toBeNull();
  });

  it("does not spend its one chance while the profile has no name yet", () => {
    // An email signup, or a render before the profile arrived. Nothing is marked, so a name
    // that lands on a later render can still be seeded.
    expect(displayNameSeed(empty, null)).toBeNull();
    expect(displayNameSeed(empty, undefined)).toBeNull();
    expect(displayNameSeed(empty, "   ")).toBeNull();
  });

  it("trims the name the way Continue will", () => {
    expect(displayNameSeed(empty, "  Ada  ")).toEqual({ displayName: "Ada", displayNameSeeded: true });
  });

  it("never prefills a value Continue would refuse", () => {
    expect(displayNameSeed(empty, "A")).toEqual({ displayNameSeeded: true });
    expect(displayNameSeed(empty, "x".repeat(31))).toEqual({ displayNameSeeded: true });
  });
});
