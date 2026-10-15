import { describe, expect, it } from "vitest";

import {
  APP_STATUS_URL,
  compareVersions,
  gateDecision,
  parseAppStatus,
  parseVersion,
  statusCheckUrl,
} from "./appStatus";

/**
 * The minimum-version gate fails open on everything unexpected: a wrong block locks out every
 * player and App Review, a wrong pass costs nothing. So every odd input below must come out
 * "open", and only a clean "this binary is older than minVersion" blocks.
 */
describe("parseVersion", () => {
  it("accepts one to four numeric segments", () => {
    expect(parseVersion("1")).toEqual([1]);
    expect(parseVersion("1.0")).toEqual([1, 0]);
    expect(parseVersion("1.0.2")).toEqual([1, 0, 2]);
    expect(parseVersion("1.0.2.3")).toEqual([1, 0, 2, 3]);
  });

  it("rejects everything else", () => {
    for (const bad of ["", "v1.0.2", "1.0.x", "1..2", "1.0.2.3.4", "-1.0", " 1.0.2", "1.0.2 ", "12345.0", 102, null, undefined, {}]) {
      expect(parseVersion(bad)).toBeNull();
    }
  });
});

describe("compareVersions", () => {
  it("compares numerically, segment by segment", () => {
    expect(compareVersions("1.0.10", "1.0.9")).toBe(1);
    expect(compareVersions("1.0.1", "1.0.2")).toBe(-1);
    expect(compareVersions("2", "1.9.9")).toBe(1);
    expect(compareVersions("1.0.2", "1.0.2")).toBe(0);
  });

  it("counts missing trailing segments as zero", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1", "1.0.0.0")).toBe(0);
    expect(compareVersions("1.0.0.1", "1")).toBe(1);
  });

  it("is null when either side is invalid", () => {
    expect(compareVersions("1.0.x", "1.0.1")).toBeNull();
    expect(compareVersions("1.0.1", null)).toBeNull();
    expect(compareVersions(undefined, undefined)).toBeNull();
  });
});

describe("parseAppStatus", () => {
  it("accepts a plain object whose minVersion parses, ignoring extra fields", () => {
    expect(parseAppStatus({ minVersion: "1.0.1" })).toEqual({ minVersion: "1.0.1" });
    expect(parseAppStatus({ minVersion: "1.0.1", note: "hello" })).toEqual({ minVersion: "1.0.1" });
  });

  it("is null for anything else", () => {
    for (const bad of [null, undefined, [], "1.0.1", {}, { minVersion: 101 }, { minVersion: "latest" }, [{ minVersion: "1.0.1" }]]) {
      expect(parseAppStatus(bad)).toBeNull();
    }
  });
});

describe("gateDecision", () => {
  const status = { minVersion: "1.0.2" };

  it("blocks only a binary older than minVersion", () => {
    expect(gateDecision({ appVersion: "1.0.1", status })).toBe("update-required");
    expect(gateDecision({ appVersion: "1.0.2", status })).toBe("open");
    expect(gateDecision({ appVersion: "1.0.3", status })).toBe("open");
    expect(gateDecision({ appVersion: "2.0", status })).toBe("open");
  });

  it("fails open on a missing status or an unreadable version", () => {
    expect(gateDecision({ appVersion: "1.0.1", status: null })).toBe("open");
    expect(gateDecision({ appVersion: null, status })).toBe("open");
    expect(gateDecision({ appVersion: undefined, status })).toBe("open");
    expect(gateDecision({ appVersion: "garbage", status })).toBe("open");
    expect(gateDecision({ appVersion: "1.0.1", status: { minVersion: "nope" } })).toBe("open");
  });
});

describe("statusCheckUrl", () => {
  it("is the status file with a minute-long cache key", () => {
    const at = Date.UTC(2026, 9, 15, 3, 0, 5);
    expect(statusCheckUrl(at)).toBe(`${APP_STATUS_URL}?v=${Math.floor(at / 60000)}`);
    expect(statusCheckUrl(at + 30_000)).toBe(statusCheckUrl(at));
    expect(statusCheckUrl(at + 60_000)).not.toBe(statusCheckUrl(at));
  });

  it("points at duoqueue.io, not Supabase", () => {
    expect(APP_STATUS_URL).toBe("https://duoqueue.io/app-status.json");
  });
});
