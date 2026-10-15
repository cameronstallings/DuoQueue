import { existsSync, readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import { DUO_POP_PUSH_CATEGORY, DUO_POP_SOUND_FILE, shouldPlayForegroundSound } from "./pushSound";

/**
 * In the foreground only a Duo Pop makes a sound (its ten-minute window is the point); every other
 * push stays a silent banner. The sound itself is a bundled WAV, checked here by its header bytes
 * only: nothing in this repo ever plays it (Cameron's standing rule).
 */
describe("shouldPlayForegroundSound", () => {
  it("plays for a Duo Pop, with or without its pop id", () => {
    expect(shouldPlayForegroundSound({ category: "duo_pop" })).toBe(true);
    expect(shouldPlayForegroundSound({ category: "duo_pop", popId: "6f1c0d4e-1111-4222-8333-944455556666" })).toBe(true);
    expect(shouldPlayForegroundSound({ category: DUO_POP_PUSH_CATEGORY })).toBe(true);
  });

  it("stays silent for every other category, including the settings column's name", () => {
    for (const category of ["queue_pop", "new_match", "new_message", "new_player", "announcement", "DUO_POP"]) {
      expect(shouldPlayForegroundSound({ category })).toBe(false);
    }
  });

  it("stays silent for anything that is not an object with that category", () => {
    for (const data of [null, undefined, "duo_pop", ["duo_pop"], [{ category: "duo_pop" }], 0, {}]) {
      expect(shouldPlayForegroundSound(data)).toBe(false);
    }
  });
});

describe("duo-pop.wav", () => {
  const wav = readFileSync(new URL("../../assets/sounds/duo-pop.wav", import.meta.url));
  const ascii = (start: number, end: number) => wav.toString("ascii", start, end);

  it("is a canonical 16-bit PCM mono 44.1 kHz WAV", () => {
    expect(ascii(0, 4)).toBe("RIFF");
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(ascii(8, 12)).toBe("WAVE");
    expect(ascii(12, 16)).toBe("fmt ");
    expect(wav.readUInt16LE(20)).toBe(1);
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(44100);
    expect(wav.readUInt16LE(34)).toBe(16);
    expect(ascii(36, 40)).toBe("data");
  });

  it("has an even data size equal to the file size minus the header", () => {
    const dataBytes = wav.readUInt32LE(40);
    expect(dataBytes % 2).toBe(0);
    expect(dataBytes).toBe(wav.length - 44);
  });

  it("is short, never clips and stays small", () => {
    const samples = wav.readUInt32LE(40) / 2;
    const seconds = samples / 44100;
    expect(seconds).toBeGreaterThan(0.2);
    expect(seconds).toBeLessThan(1.0);
    let peak = 0;
    for (let i = 0; i < samples; i++) peak = Math.max(peak, Math.abs(wav.readInt16LE(44 + i * 2)));
    expect(peak).toBeLessThan(32767);
    expect(peak).toBeGreaterThan(0);
    expect(wav.length).toBeLessThan(100 * 1024);
  });
});

describe("app.json", () => {
  const appJson = JSON.parse(readFileSync(new URL("../../app.json", import.meta.url), "utf8")) as {
    expo: { version: string; plugins: (string | [string, Record<string, unknown>])[] };
  };

  it("is version 1.0.2", () => {
    expect(appJson.expo.version).toBe("1.0.2");
  });

  it("bundles the Duo Pop sound through the expo-notifications plugin, under the name the push uses", () => {
    const entry = appJson.expo.plugins.find(
      (plugin): plugin is [string, Record<string, unknown>] => Array.isArray(plugin) && plugin[0] === "expo-notifications",
    );
    expect(entry).toBeDefined();
    const sounds = entry?.[1].sounds as string[] | undefined;
    expect(sounds).toContain("./assets/sounds/duo-pop.wav");
    const bundled = sounds?.find((path) => path.endsWith(".wav")) ?? "";
    expect(bundled.split("/").pop()).toBe(DUO_POP_SOUND_FILE);
  });
});

/**
 * The server names the sound and the category in its own file (Group S's
 * supabase/functions/send-push-notification/events.ts), read here as text only. iOS plays the
 * default chime, with no error anywhere, when the pushed name and the bundled file differ, so a
 * rename on one side alone (for example to duo_pop.wav, the name an Android build will need; see
 * pushSound.ts) fails here instead of on a phone.
 */
describe("the server push agrees with the app", () => {
  const eventsUrl = new URL("../../../../supabase/functions/send-push-notification/events.ts", import.meta.url);
  const events = existsSync(eventsUrl) ? readFileSync(eventsUrl, "utf8") : "";
  const constant = (name: string) => new RegExp(`export const ${name} = "([^"]*)";`).exec(events)?.[1];

  it.skipIf(events === "")("sends the bundled sound file's name", () => {
    expect(constant("DUO_POP_SOUND")).toBe(DUO_POP_SOUND_FILE);
  });

  it.skipIf(events === "")("sends the category the app routes and plays", () => {
    expect(constant("DUO_POP_CATEGORY")).toBe(DUO_POP_PUSH_CATEGORY);
  });
});
