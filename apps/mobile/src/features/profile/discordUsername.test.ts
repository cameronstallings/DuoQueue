import { describe, expect, it } from "vitest";

import { DISCORD_COPY, discordSaveErrorMessage, parseDiscordInput } from "./discordUsername";

describe("parseDiscordInput", () => {
  it("accepts a valid name and trims it", () => {
    expect(parseDiscordInput(" Name.Gg ")).toEqual({ ok: true, value: "Name.Gg" });
    expect(parseDiscordInput("ab")).toEqual({ ok: true, value: "ab" });
    expect(parseDiscordInput("a_b.c9")).toEqual({ ok: true, value: "a_b.c9" });
    expect(parseDiscordInput("x".repeat(32))).toEqual({ ok: true, value: "x".repeat(32) });
  });

  it("reads empty or blank as no Discord (remove it)", () => {
    expect(parseDiscordInput("")).toEqual({ ok: true, value: null });
    expect(parseDiscordInput("   ")).toEqual({ ok: true, value: null });
  });

  it("refuses a name that is too short or too long", () => {
    expect(parseDiscordInput("a")).toEqual({ ok: false, error: "Enter a valid Discord username." });
    expect(parseDiscordInput("x".repeat(33))).toEqual({ ok: false, error: "Enter a valid Discord username." });
  });

  it("refuses characters Discord does not allow, with the format line", () => {
    expect(parseDiscordInput("bad name!")).toEqual({
      ok: false,
      error: "Discord usernames can only use letters, numbers, dots and underscores.",
    });
    expect(parseDiscordInput("name#1234")).toEqual({
      ok: false,
      error: "Discord usernames can only use letters, numbers, dots and underscores.",
    });
  });
});

describe("discordSaveErrorMessage", () => {
  it("explains the 0049 format check", () => {
    const err = {
      code: "23514",
      message: 'new row for relation "profiles" violates check constraint "discord_username_format"',
      details: null,
      hint: null,
    };
    expect(discordSaveErrorMessage(err)).toBe(
      "Discord usernames can only use letters, numbers, dots and underscores.",
    );
  });

  it("never shows a raw error", () => {
    expect(discordSaveErrorMessage({ code: "23514", message: 'violates check constraint "bio_length"' })).toBe(
      "Couldn't save your Discord. Try again.",
    );
    expect(discordSaveErrorMessage({ code: "42501", message: "permission denied for table profiles" })).toBe(
      "Couldn't save your Discord. Try again.",
    );
    expect(discordSaveErrorMessage(new Error("Network request failed"))).toBe("Couldn't save your Discord. Try again.");
    expect(discordSaveErrorMessage(null)).toBe("Couldn't save your Discord. Try again.");
  });
});

describe("Discord copy", () => {
  const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

  it("is the approved wording", () => {
    expect(DISCORD_COPY.body).toBe("It stays private until you tap Share my Discord in a chat.");
    expect(DISCORD_COPY.connectionsIntro).toBe(
      "Add your Discord so you can share it in a chat with one tap. Nobody sees it until you do.",
    );
    expect(DISCORD_COPY.settingsHint).toBe("Your Discord and game accounts");
  });

  it("has no dashes, no 'beats' and no dating words", () => {
    for (const text of Object.values(DISCORD_COPY)) {
      expect(text).not.toMatch(dashes);
      expect(text).not.toMatch(/\bbeats?\b/i);
      expect(text).not.toMatch(/dating|singles|hookup|nearby|meet people|match with singles/i);
    }
  });
});
