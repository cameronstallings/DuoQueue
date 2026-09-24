import { describe, expect, it } from "vitest";

import { initialOf } from "./initialOf";

describe("initialOf", () => {
  it("takes the first letter, uppercased", () => {
    expect(initialOf("dae")).toBe("D");
  });

  it("skips leading spaces", () => {
    expect(initialOf("  wren")).toBe("W");
  });

  it("keeps an emoji whole instead of splitting its surrogate pair", () => {
    expect(initialOf("😀 gamer")).toBe("😀");
  });

  it("handles accents and other scripts", () => {
    expect(initialOf("élodie")).toBe("É");
    expect(initialOf("李明")).toBe("李");
    expect(initialOf("алекс")).toBe("А");
  });

  it("falls back to ? for an empty name", () => {
    expect(initialOf("")).toBe("?");
    expect(initialOf("   ")).toBe("?");
    expect(initialOf(null)).toBe("?");
    expect(initialOf(undefined)).toBe("?");
  });
});
