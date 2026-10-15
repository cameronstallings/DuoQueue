import { describe, expect, it } from "vitest";

import { buildDeviceStamp, versionLabel } from "./appStamp";

/**
 * The version stamp saved beside a push token (which builds and OTAs are in use, and whether the
 * publishable key reached each phone), and the build line under Settings > Legal.
 */
const NOW = new Date("2026-10-15T06:30:00.000Z");

const FULL = {
  appVersion: "1.0.2",
  build: "19",
  runtimeVersion: "1.0.2",
  updateId: "d5ebe82f-1234-4abc-9def-0123456789ab",
  channel: "production",
  embedded: false,
  os: "ios",
  osVersion: "18.6",
  keyKind: "publishable",
};

describe("buildDeviceStamp", () => {
  it("writes every field in snake_case from a full input", () => {
    expect(buildDeviceStamp(FULL, NOW)).toEqual({
      app_version: "1.0.2",
      build: "19",
      runtime_version: "1.0.2",
      update_id: "d5ebe82f-1234-4abc-9def-0123456789ab",
      channel: "production",
      embedded: false,
      os: "ios",
      os_version: "18.6",
      key_kind: "publishable",
      stamped_at: "2026-10-15T06:30:00.000Z",
    });
  });

  it("trims strings and cuts them to 64 characters", () => {
    const stamp = buildDeviceStamp({ ...FULL, channel: `  ${"x".repeat(100)}  `, osVersion: " 18.6 " }, NOW);
    expect(stamp.channel).toBe("x".repeat(64));
    expect(stamp.os_version).toBe("18.6");
  });

  it("turns numbers, empty strings and missing values into null", () => {
    const stamp = buildDeviceStamp({ appVersion: 102, build: "", runtimeVersion: "   ", updateId: undefined, channel: null }, NOW);
    expect(stamp.app_version).toBeNull();
    expect(stamp.build).toBeNull();
    expect(stamp.runtime_version).toBeNull();
    expect(stamp.update_id).toBeNull();
    expect(stamp.channel).toBeNull();
    expect(stamp.os_version).toBeNull();
  });

  it("calls a missing os unknown", () => {
    expect(buildDeviceStamp({}, NOW).os).toBe("unknown");
    expect(buildDeviceStamp({ os: "" }, NOW).os).toBe("unknown");
    expect(buildDeviceStamp({ os: 7 }, NOW).os).toBe("unknown");
  });

  it("keeps embedded only when it is a boolean", () => {
    expect(buildDeviceStamp({ embedded: true }, NOW).embedded).toBe(true);
    expect(buildDeviceStamp({ embedded: false }, NOW).embedded).toBe(false);
    expect(buildDeviceStamp({ embedded: "false" }, NOW).embedded).toBeNull();
    expect(buildDeviceStamp({ embedded: 0 }, NOW).embedded).toBeNull();
    expect(buildDeviceStamp({}, NOW).embedded).toBeNull();
  });

  it("names only the public key kinds", () => {
    expect(buildDeviceStamp({ keyKind: "publishable" }, NOW).key_kind).toBe("publishable");
    expect(buildDeviceStamp({ keyKind: "legacy" }, NOW).key_kind).toBe("legacy");
    expect(buildDeviceStamp({ keyKind: "secret" }, NOW).key_kind).toBe("unknown");
    expect(buildDeviceStamp({}, NOW).key_kind).toBe("unknown");
  });

  it("stays well under the 2048-byte row limit even at the 64-character cut", () => {
    const long = "y".repeat(500);
    const stamp = buildDeviceStamp(
      { appVersion: long, build: long, runtimeVersion: long, updateId: long, channel: long, os: long, osVersion: long, embedded: true, keyKind: "legacy" },
      NOW,
    );
    expect(new TextEncoder().encode(JSON.stringify(stamp)).length).toBeLessThan(2048);
  });
});

describe("versionLabel", () => {
  it("shows the version and build", () => {
    expect(versionLabel({ version: "1.0.2", build: "19", updateId: null, embedded: true })).toBe("DuoQueue 1.0.2 (19)");
  });

  it("adds the update's first 8 characters when an OTA is running", () => {
    expect(versionLabel({ version: "1.0.2", build: "19", updateId: "d5ebe82f-1234-4abc-9def-0123456789ab", embedded: false })).toBe(
      "DuoQueue 1.0.2 (19) · update d5ebe82f",
    );
  });

  it("hides the update id on the embedded bundle", () => {
    expect(versionLabel({ version: "1.0.2", build: "19", updateId: "d5ebe82f-1234", embedded: true })).toBe("DuoQueue 1.0.2 (19)");
    expect(versionLabel({ version: "1.0.2", build: "19", updateId: "d5ebe82f-1234", embedded: null })).toBe("DuoQueue 1.0.2 (19)");
  });

  it("leaves out a missing build", () => {
    expect(versionLabel({ version: "1.0.2", build: null, updateId: null, embedded: true })).toBe("DuoQueue 1.0.2");
  });

  it("is just the name without a version", () => {
    expect(versionLabel({ version: null, build: "19", updateId: "d5ebe82f", embedded: false })).toBe("DuoQueue");
  });

  it("uses no em or en dashes", () => {
    const label = versionLabel({ version: "1.0.2", build: "19", updateId: "d5ebe82f-1234", embedded: false });
    // The two dashes by code point (U+2014, U+2013), so this file holds neither character itself.
    expect(label).not.toContain(String.fromCharCode(0x2014));
    expect(label).not.toContain(String.fromCharCode(0x2013));
  });
});
