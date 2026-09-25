import { describe, expect, it } from "vitest";

import { superPingPush } from "./superPingCopy";

describe("superPingPush", () => {
  it("says the sender wants to duo", () => {
    expect(superPingPush("Priya")).toEqual({ title: "Super Ping", body: "Priya wants to duo with you." });
  });

  it("has no dating line, no exclamation and no em or en dash", () => {
    const { title, body } = superPingPush("Sam");
    const text = `${title} ${body}`;
    expect(text).not.toMatch(/interested/i);
    expect(text).not.toContain("!");
    // The two dashes spelled by code, so this file carries neither character.
    expect(text).not.toContain(String.fromCharCode(0x2013));
    expect(text).not.toContain(String.fromCharCode(0x2014));
  });
});
