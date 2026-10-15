import { readFileSync } from "node:fs";
import { URL } from "node:url";

import { describe, expect, it } from "vitest";

import { compareVersions, parseAppStatus } from "./appStatus";

/**
 * The committed status file and its two readers.
 *
 * site/app-status.json is what every 1.0.2+ phone reads at launch. If its minVersion were above
 * this build's own version, the reviewed build would block itself (App Review included), so that
 * is pinned here against app.json. And scripts/app-status.mjs (the site deploy guard) holds a twin
 * of parseAppStatus and compareVersions; the shared table below keeps the two from drifting.
 */
const statusText = readFileSync(new URL("../../../../../site/app-status.json", import.meta.url), "utf8");
const appJson = JSON.parse(readFileSync(new URL("../../../app.json", import.meta.url), "utf8")) as {
  expo: { version: string };
};

type Twin = {
  parseAppStatus: (raw: unknown) => { minVersion: string } | null;
  compareVersions: (a: unknown, b: unknown) => -1 | 0 | 1 | null;
};

async function loadScript(): Promise<Twin> {
  // A non-literal specifier, so TypeScript needs no declaration for the .mjs file.
  return (await import(new URL("../../../../../scripts/app-status.mjs", import.meta.url).href)) as Twin;
}

describe("site/app-status.json", () => {
  it("is exactly one line of JSON with a parseable minVersion", () => {
    const parsed = parseAppStatus(JSON.parse(statusText));
    expect(parsed).not.toBeNull();
    expect(statusText.trim()).toBe(JSON.stringify(parsed));
  });

  it("never blocks the build it ships with", () => {
    const parsed = parseAppStatus(JSON.parse(statusText));
    expect(compareVersions(appJson.expo.version, parsed?.minVersion)).not.toBeNull();
    expect(compareVersions(appJson.expo.version, parsed?.minVersion)).toBeGreaterThanOrEqual(0);
  });
});

describe("scripts/app-status.mjs agrees with appStatus.ts", () => {
  const COMPARE_CASES: [unknown, unknown][] = [
    ["1.0.10", "1.0.9"],
    ["1.0.9", "1.0.10"],
    ["1.0", "1.0.0"],
    ["1.0.1", "1.0.2"],
    ["2", "1.9.9"],
    ["1.0.2", "1.0.2"],
    ["1.0.0.1", "1"],
    ["10.0", "9.99.99.99"],
    ["1.0.x", "1.0.1"],
    ["v1.0.2", "1.0.2"],
    ["1..2", "1.2"],
    ["1.0.2.3.4", "1.0.2"],
    [" 1.0.2", "1.0.2"],
    ["", "1"],
    [102, "1.0.2"],
    [null, "1.0.1"],
    [undefined, undefined],
    ["12345", "1"],
  ];

  const STATUS_CASES: unknown[] = [
    { minVersion: "1.0.1" },
    { minVersion: "1.0.1", note: "extra" },
    { minVersion: "1.0" },
    null,
    undefined,
    [],
    "1.0.1",
    {},
    { minVersion: 101 },
    { minVersion: "latest" },
    { minVersion: "1.0.2.3.4" },
    [{ minVersion: "1.0.1" }],
  ];

  it("compareVersions", async () => {
    const script = await loadScript();
    for (const [a, b] of COMPARE_CASES) {
      expect(script.compareVersions(a, b), `${String(a)} vs ${String(b)}`).toBe(compareVersions(a, b));
    }
  });

  it("parseAppStatus", async () => {
    const script = await loadScript();
    for (const raw of STATUS_CASES) {
      expect(script.parseAppStatus(raw), JSON.stringify(raw)).toEqual(parseAppStatus(raw));
    }
  });

  it("covers at least 15 shared cases", () => {
    expect(COMPARE_CASES.length + STATUS_CASES.length).toBeGreaterThanOrEqual(15);
  });
});
